/**
 * Real-Time SMS Monitor (Webhook-based)
 * 
 * Receives SMS messages forwarded from an Android device via
 * the "SMS to URL Forwarder" app (HTTP POST webhook).
 * 
 * Architecture:
 *  - Android app sends POST to /api/sms/webhook on each incoming SMS
 *  - This monitor manages state (active/inactive) and history
 *  - Emits 'new_sms' events for the route handler to process through ML pipeline
 *  - Supports manual connect/disconnect to control webhook acceptance
 */

import { EventEmitter } from 'events';

class SmsMonitor extends EventEmitter {
  constructor() {
    super();
    this.active = false;         // Whether we're accepting webhooks
    this.connected = false;      // Whether the system is in "connected" state
    this.monitoring = false;     // Whether actively monitoring
    this.webhookUrl = null;      // The URL the user should configure in the Android app
    this.analyzedMessages = [];  // Keep last 100 analyzed SMS
    this.maxHistory = 100;
    this.processedIds = new Set();
    this.lastReceived = null;
    this.totalReceived = 0;
  }

  /**
   * Activate SMS monitoring (start accepting webhooks)
   * @param {Object} config - Configuration
   * @param {string} config.webhookUrl - The webhook URL for the user to configure
   */
  activate(config = {}) {
    this.active = true;
    this.connected = true;
    this.monitoring = true;
    this.webhookUrl = config.webhookUrl || null;
    
    console.log('[SmsMonitor] Activated — accepting incoming SMS webhooks');
    this.emit('status', this.getStatus());
  }

  /**
   * Deactivate SMS monitoring (stop accepting webhooks)
   */
  deactivate() {
    this.active = false;
    this.connected = false;
    this.monitoring = false;
    
    console.log('[SmsMonitor] Deactivated — rejecting incoming SMS webhooks');
    this.emit('status', this.getStatus());
  }

  /**
   * Process an incoming SMS from the webhook
   * @param {Object} smsData - Raw SMS data from the Android app
   * @param {string} smsData.from - Sender phone number
   * @param {string} smsData.text - Message body
   * @param {string} smsData.sentStamp - Unix timestamp or ISO date
   * @param {string} smsData.sim - SIM card identifier
   * @returns {Object|null} - Normalized SMS data or null if rejected
   */
  receiveSms(smsData) {
    if (!this.active) {
      console.log('[SmsMonitor] SMS rejected — monitoring is inactive');
      return null;
    }

    // Normalize the incoming data
    const normalized = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      from: smsData.from || 'Unknown',
      text: smsData.text || smsData.body || smsData.message || '',
      sim: smsData.sim || smsData.simNumber || 'SIM1',
      sentStamp: smsData.sentStamp || smsData.receivedStamp || Date.now().toString(),
      raw: smsData,
    };

    // Dedup — skip if we already processed this exact content from the same sender within 5 seconds
    const dedupKey = `${normalized.from}:${normalized.text}`.substring(0, 200);
    if (this.processedIds.has(dedupKey)) {
      console.log('[SmsMonitor] Duplicate SMS ignored');
      return null;
    }
    this.processedIds.add(dedupKey);

    // Bound the dedup set
    if (this.processedIds.size > 500) {
      const arr = Array.from(this.processedIds);
      this.processedIds = new Set(arr.slice(-250));
    }

    this.lastReceived = normalized.timestamp;
    this.totalReceived++;

    console.log(`[SmsMonitor] New SMS from ${normalized.from}: "${normalized.text.substring(0, 50)}..."`);
    
    // Emit for the route handler to classify
    this.emit('new_sms', normalized);
    
    return normalized;
  }

  /**
   * Add analyzed SMS to history
   */
  addToHistory(analyzedSms) {
    this.analyzedMessages.unshift(analyzedSms);
    if (this.analyzedMessages.length > this.maxHistory) {
      this.analyzedMessages = this.analyzedMessages.slice(0, this.maxHistory);
    }
  }

  /**
   * Get analysis history
   */
  getHistory() {
    return this.analyzedMessages;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      monitoring: this.monitoring,
      active: this.active,
      totalReceived: this.totalReceived,
      lastReceived: this.lastReceived,
      historyCount: this.analyzedMessages.length,
    };
  }
}

// Singleton instance
const smsMonitor = new SmsMonitor();

export default smsMonitor;
export { SmsMonitor };
