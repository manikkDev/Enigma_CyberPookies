/**
 * Real-Time Social Media Monitor (Notification Webhook)
 * 
 * Receives social media message notifications forwarded from an Android
 * device via MacroDroid's NotificationListenerService + HTTP Request action.
 * 
 * Architecture:
 *   - MacroDroid intercepts WhatsApp/Instagram/Telegram notifications
 *   - Sends HTTP POST to /api/social/webhook with {title, text, app_name, package}
 *   - This monitor normalises, deduplicates, and emits 'new_notification' events
 *   - The route handler runs the ML pipeline and pushes results to SSE clients
 * 
 * Supports manual connect/disconnect to honour user consent.
 */

import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', '..', '.social_state.json');

function loadPersistedState() {
  try {
    if (existsSync(STATE_FILE)) {
      const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      return { active: !!s.active };
    }
  } catch { /* ignore */ }
  return { active: false };
}

function persistState(active) {
  try { writeFileSync(STATE_FILE, JSON.stringify({ active, updatedAt: new Date().toISOString() })); } catch { /* ignore */ }
}

/* ─── Platform Mapping ───────────────────────────────────────────────────── */

const PLATFORM_MAP = {
  'com.whatsapp':            { label: 'WhatsApp',          color: '#25D366', icon: 'whatsapp' },
  'com.whatsapp.w4b':        { label: 'WhatsApp Business', color: '#25D366', icon: 'whatsapp' },
  'com.instagram.android':   { label: 'Instagram',         color: '#E4405F', icon: 'instagram' },
  'org.telegram.messenger':  { label: 'Telegram',          color: '#0088CC', icon: 'telegram' },
  'com.facebook.orca':       { label: 'Messenger',         color: '#0084FF', icon: 'messenger' },
  'com.snapchat.android':    { label: 'Snapchat',          color: '#FFFC00', icon: 'snapchat' },
  'com.discord':             { label: 'Discord',           color: '#5865F2', icon: 'discord' },
  'com.twitter.android':     { label: 'X (Twitter)',       color: '#1DA1F2', icon: 'twitter' },
  'com.linkedin.android':    { label: 'LinkedIn',          color: '#0A66C2', icon: 'linkedin' },
};

function resolvePlatform(packageName, appName) {
  if (packageName && PLATFORM_MAP[packageName]) {
    return PLATFORM_MAP[packageName];
  }
  // Fallback — guess from app_name string
  const lower = (appName || '').toLowerCase();
  if (lower.includes('whatsapp'))  return PLATFORM_MAP['com.whatsapp'];
  if (lower.includes('instagram')) return PLATFORM_MAP['com.instagram.android'];
  if (lower.includes('telegram'))  return PLATFORM_MAP['org.telegram.messenger'];
  if (lower.includes('messenger')) return PLATFORM_MAP['com.facebook.orca'];
  if (lower.includes('snapchat'))  return PLATFORM_MAP['com.snapchat.android'];
  if (lower.includes('discord'))   return PLATFORM_MAP['com.discord'];
  if (lower.includes('twitter') || lower.includes(' x ')) return PLATFORM_MAP['com.twitter.android'];
  return { label: appName || 'Unknown App', color: '#888888', icon: 'unknown' };
}

/* ─── Monitor Class ──────────────────────────────────────────────────────── */

class SocialMonitor extends EventEmitter {
  constructor() {
    super();
    const saved = loadPersistedState();
    this.active = saved.active;
    this.connected = saved.active;
    this.monitoring = saved.active;
    this.analyzedMessages = [];
    this.maxHistory = 150;
    this.processedIds = new Set();
    this.lastReceived = null;
    this.totalReceived = 0;
    this.platformStats = {};
    if (saved.active) {
      console.log('[SocialMonitor] Restored active state from persistence — webhook accepting');
    }
  }

  /**
   * Activate social monitoring (start accepting webhooks)
   */
  activate() {
    this.active = true;
    this.connected = true;
    this.monitoring = true;
    persistState(true);
    console.log('[SocialMonitor] Activated — accepting notification webhooks');
    this.emit('status', this.getStatus());
  }

  /**
   * Deactivate social monitoring (stop accepting webhooks)
   */
  deactivate() {
    this.active = false;
    this.connected = false;
    this.monitoring = false;
    persistState(false);
    console.log('[SocialMonitor] Deactivated — rejecting notification webhooks');
    this.emit('status', this.getStatus());
  }

  /**
   * Process an incoming notification from the webhook.
   *
   * @param {Object}  data
   * @param {string}  data.title     – Notification title (sender name)
   * @param {string}  data.text      – Notification body (message text)
   * @param {string}  data.app_name  – Human-readable app name
   * @param {string}  data.package   – Android package name
   * @returns {Object|null}
   */
  receiveNotification(data) {
    if (!this.active) {
      console.log('[SocialMonitor] Notification rejected — monitoring inactive');
      return null;
    }

    const text  = (data.text || data.message || data.notification || '').trim();
    const title = (data.title || data.not_title || '').trim();

    if (!text) {
      console.log('[SocialMonitor] Empty notification body — skipping');
      return null;
    }

    // Resolve platform
    const platform = resolvePlatform(data.package || data.not_app_package, data.app_name || data.not_app_name);

    // Normalise
    const normalized = {
      id: `social_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      sender: title || 'Unknown',
      text,
      platform: platform.icon,
      platformLabel: platform.label,
      platformColor: platform.color,
      appPackage: data.package || data.not_app_package || '',
      raw: data,
    };

    // Deduplication — same sender + first 120 chars of text
    const dedupKey = `${normalized.platformLabel}:${normalized.sender}:${text.substring(0, 120)}`;
    if (this.processedIds.has(dedupKey)) {
      console.log('[SocialMonitor] Duplicate notification ignored');
      return null;
    }
    this.processedIds.add(dedupKey);

    // Bound the set
    if (this.processedIds.size > 500) {
      const arr = Array.from(this.processedIds);
      this.processedIds = new Set(arr.slice(-250));
    }

    this.lastReceived = normalized.timestamp;
    this.totalReceived++;
    this.platformStats[platform.label] = (this.platformStats[platform.label] || 0) + 1;

    console.log(`[SocialMonitor] New ${platform.label} msg from "${normalized.sender}": "${text.substring(0, 50)}..."`);

    this.emit('new_notification', normalized);
    return normalized;
  }

  addToHistory(analyzed) {
    this.analyzedMessages.unshift(analyzed);
    if (this.analyzedMessages.length > this.maxHistory) {
      this.analyzedMessages = this.analyzedMessages.slice(0, this.maxHistory);
    }
  }

  getHistory() {
    return this.analyzedMessages;
  }

  deleteFromHistory(id) {
    this.analyzedMessages = this.analyzedMessages.filter(m => m.id !== id);
  }

  clearHistory() {
    this.analyzedMessages = [];
  }


  getStatus() {
    return {
      connected: this.connected,
      monitoring: this.monitoring,
      active: this.active,
      totalReceived: this.totalReceived,
      lastReceived: this.lastReceived,
      historyCount: this.analyzedMessages.length,
      platformStats: this.platformStats,
    };
  }
}

// Singleton
const socialMonitor = new SocialMonitor();

export default socialMonitor;
export { SocialMonitor, PLATFORM_MAP, resolvePlatform };
