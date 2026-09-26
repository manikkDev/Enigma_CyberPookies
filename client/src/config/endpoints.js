/**
 * endpoints.js
 *
 * Centralized backend endpoint configuration.
 * 
 * Architecture note:
 * - MAIN_API: Main chatbot backend (port 5001) - handles chat, auth, threats, alerts, cases
 * - GRAPH_API: Legacy backend (port 5002) - provides Neo4j graph endpoints (transitional)
 * - ML_API: Python ML server (port 8000) - pattern classification for AML P1-P6
 */

// Main backend (primary product backend)
export const MAIN_API = process.env.MAIN_API_URL || 
                        process.env.NEXT_PUBLIC_MAIN_API_URL || 
                        'http://localhost:5001';

// Legacy graph backend (transitional - will be migrated to MAIN_API)
export const GRAPH_API = process.env.NEXT_PUBLIC_GRAPH_API_URL || 
                         'http://localhost:5002';

// ML classification server
export const ML_API = process.env.NEXT_PUBLIC_ML_API_URL || 
                      'http://localhost:8000';

// Convenience exports for common patterns
export const ENDPOINTS = {
  // Chat & Conversations
  chat: `${MAIN_API}/api/chat`,
  chatStream: `${MAIN_API}/api/chat/stream`,
  conversations: `${MAIN_API}/api/conversations`,
  
  // Auth
  auth: `${MAIN_API}/api/auth`,
  users: `${MAIN_API}/api/users`,
  
  // Threat Analysis
  threats: `${MAIN_API}/api/threats`,
  threatsNormalize: `${MAIN_API}/api/threats/normalize`,
  threatsAnalyze: `${MAIN_API}/api/threats/analyze`,
  threatsGraph: `${MAIN_API}/api/threats/graph`,
  threatsCorrelate: `${MAIN_API}/api/threats/correlate`,
  
  // Alerts & Watchlist
  alerts: `${MAIN_API}/api/alerts`,
  alertsStream: `${MAIN_API}/api/alerts/stream`,
  watchlist: `${MAIN_API}/api/alerts/watchlist`,
  
  // Cases
  cases: `${MAIN_API}/api/cases`,
  
  // Actions
  actions: `${MAIN_API}/api/actions`,
  
  // Graph (legacy - transitional)
  graphQuery: `${GRAPH_API}/api/graph/query`,
  graphVisualize: `${GRAPH_API}/api/graph/visualize`,
  
  // ML Classification
  mlClassify: `${ML_API}/classify`,
  mlThreatClassify: `${ML_API}/threat/classify`,
  mlThreatHealth: `${ML_API}/threat/health`,
  
  // Email Monitoring
  emailConnect: `${MAIN_API}/api/email/connect`,
  emailDisconnect: `${MAIN_API}/api/email/disconnect`,
  emailStatus: `${MAIN_API}/api/email/status`,
  emailFeed: `${MAIN_API}/api/email/feed`,
  emailHistory: `${MAIN_API}/api/email/history`,
  
  // SMS Monitoring
  smsWebhook: `${MAIN_API}/api/sms/webhook`,
  smsConnect: `${MAIN_API}/api/sms/connect`,
  smsDisconnect: `${MAIN_API}/api/sms/disconnect`,
  smsStatus: `${MAIN_API}/api/sms/status`,
  smsFeed: `${MAIN_API}/api/sms/feed`,
  smsHistory: `${MAIN_API}/api/sms/history`,
  
  // Social Media Monitoring
  socialWebhook: `${MAIN_API}/api/social/webhook`,
  socialConnect: `${MAIN_API}/api/social/connect`,
  socialDisconnect: `${MAIN_API}/api/social/disconnect`,
  socialStatus: `${MAIN_API}/api/social/status`,
  socialFeed: `${MAIN_API}/api/social/feed`,
  socialHistory: `${MAIN_API}/api/social/history`,
};

// Export individual APIs for backward compatibility
export const SERVER_URL_1 = MAIN_API;  // Preferred name going forward
export const SERVER_URL = GRAPH_API;    // Legacy name, will be phased out

export default ENDPOINTS;
