/**
 * Real-Time Email Monitor (IMAP IDLE)
 * 
 * Connects to a user's email via IMAP and listens for new emails.
 * When a new email arrives, it extracts and analyzes it automatically.
 * 
 * Uses ImapFlow for IMAP IDLE support.
 */

import { ImapFlow } from 'imapflow';
import { EventEmitter } from 'events';
import { simpleParser } from 'mailparser';

class EmailMonitor extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.lock = null;
    this.connected = false;
    this.monitoring = false;
    this.config = null;
    this.processedIds = new Set();
    this.reconnectTimer = null;
    this.analyzedEmails = []; // Keep last 50 analyzed emails
    this.maxHistory = 50;
  }

  /**
   * Connect to email server and start monitoring
   * @param {Object} config - IMAP configuration
   * @param {string} config.host - IMAP host (e.g., 'imap.gmail.com')
   * @param {number} config.port - IMAP port (default: 993)
   * @param {string} config.email - Email address
   * @param {string} config.password - App password
   */
  async connect(config) {
    if (this.connected) {
      await this.disconnect();
    }

    this.config = {
      host: config.host || 'imap.gmail.com',
      port: config.port || 993,
      secure: config.secure !== false,
      auth: {
        user: config.email,
        pass: config.password,
      },
      logger: false,
    };

    try {
      this.client = new ImapFlow(this.config);

      // Handle connection errors
      this.client.on('error', (err) => {
        console.error('[EmailMonitor] Connection error:', err.message);
        this.emit('error', { type: 'connection', message: err.message });
        this.attemptReconnect();
      });

      this.client.on('close', () => {
        console.log('[EmailMonitor] Connection closed');
        this.connected = false;
        this.monitoring = false;
        this.emit('status', { connected: false, monitoring: false });
        this.attemptReconnect();
      });

      await this.client.connect();
      this.connected = true;
      console.log('[EmailMonitor] Connected to', this.config.host);
      this.emit('status', { connected: true, monitoring: false, host: this.config.host });

      // Start monitoring
      await this.startMonitoring();

    } catch (error) {
      console.error('[EmailMonitor] Failed to connect:', error.message);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Start monitoring inbox for new emails
   */
  async startMonitoring() {
    if (!this.connected || !this.client) return;

    try {
      this.lock = await this.client.getMailboxLock('INBOX');
      this.monitoring = true;
      console.log('[EmailMonitor] Monitoring INBOX via IDLE');
      this.emit('status', { connected: true, monitoring: true });

      // Listen for new emails
      this.client.on('exists', async (data) => {
        console.log(`[EmailMonitor] New email detected! Count: ${data.count}`);
        await this.fetchLatestEmail();
      });

    } catch (error) {
      console.error('[EmailMonitor] Failed to start monitoring:', error.message);
      this.monitoring = false;
      throw error;
    }
  }

  /**
   * Fetch and analyze the latest email
   */
  async fetchLatestEmail() {
    try {
      // Fetch the latest message
      const message = await this.client.fetchOne('*', {
        source: true,
        envelope: true,
        uid: true,
      });

      if (!message) return;

      // Skip if already processed
      const msgId = message.uid?.toString() || message.seq?.toString();
      if (this.processedIds.has(msgId)) return;
      this.processedIds.add(msgId);

      // Keep processedIds bounded
      if (this.processedIds.size > 500) {
        const arr = Array.from(this.processedIds);
        this.processedIds = new Set(arr.slice(-250));
      }

      // Parse the email
      const parsed = await simpleParser(message.source);
      const emailData = {
        id: msgId,
        timestamp: new Date().toISOString(),
        from: parsed.from?.text || message.envelope?.from?.[0]?.address || 'Unknown',
        to: parsed.to?.text || message.envelope?.to?.[0]?.address || 'Unknown',
        subject: parsed.subject || message.envelope?.subject || '(No Subject)',
        body: parsed.text || '',
        html: parsed.html || '',
        headers: {
          from: parsed.from?.text,
          to: parsed.to?.text,
          subject: parsed.subject,
          date: parsed.date?.toISOString(),
          messageId: parsed.messageId,
          replyTo: parsed.replyTo?.text,
          returnPath: parsed.headers?.get('return-path'),
        },
        attachments: (parsed.attachments || []).map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      };

      console.log(`[EmailMonitor] New email: "${emailData.subject}" from ${emailData.from}`);
      this.emit('new_email', emailData);

    } catch (error) {
      console.error('[EmailMonitor] Error fetching email:', error.message);
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  attemptReconnect() {
    if (this.reconnectTimer || !this.config) return;

    console.log('[EmailMonitor] Will attempt reconnect in 10 seconds...');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect(this.config.auth ? {
          host: this.config.host,
          port: this.config.port,
          email: this.config.auth.user,
          password: this.config.auth.pass,
        } : this.config);
        console.log('[EmailMonitor] Reconnected successfully');
      } catch (error) {
        console.error('[EmailMonitor] Reconnect failed:', error.message);
        this.attemptReconnect();
      }
    }, 10000);
  }

  /**
   * Disconnect and stop monitoring
   */
  async disconnect() {
    this.config = null; // Clear config to prevent auto-reconnect loops
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.lock) {
      try {
        this.lock.release();
      } catch (e) {
        // Ignore
      }
      this.lock = null;
    }

    if (this.client) {
      try {
        await this.client.logout();
      } catch (e) {
        // Ignore
      }
      this.client = null;
    }

    this.connected = false;
    this.monitoring = false;
    this.emit('status', { connected: false, monitoring: false });
    console.log('[EmailMonitor] Disconnected');
  }

  /**
   * Add analyzed email to history
   */
  addToHistory(analyzedEmail) {
    this.analyzedEmails.unshift(analyzedEmail);
    if (this.analyzedEmails.length > this.maxHistory) {
      this.analyzedEmails = this.analyzedEmails.slice(0, this.maxHistory);
    }
  }

  /**
   * Get analysis history
   */
  getHistory() {
    return this.analyzedEmails;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      monitoring: this.monitoring,
      host: this.config?.host || null,
      email: this.config?.auth?.user || null,
      processedCount: this.processedIds.size,
      historyCount: this.analyzedEmails.length,
    };
  }
}

// Singleton instance
const emailMonitor = new EmailMonitor();

export default emailMonitor;
export { EmailMonitor };
