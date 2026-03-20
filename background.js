// Productive and unproductive site lists
const PRODUCTIVE = [
  'github.com', 'stackoverflow.com', 'leetcode.com',
  'codecademy.com', 'freecodecamp.org', 'developer.mozilla.org',
  'medium.com', 'docs.google.com', 'notion.so', 'figma.com'
];

const UNPRODUCTIVE = [
  'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'reddit.com', 'tiktok.com', 'netflix.com', 'snapchat.com',
  'twitch.tv', 'pinterest.com'
];

let activeTab = null;
let startTime = null;

// Get domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Classify site
function classify(domain) {
  if (PRODUCTIVE.some(s => domain.includes(s))) return 'productive';
  if (UNPRODUCTIVE.some(s => domain.includes(s))) return 'unproductive';
  return 'neutral';
}

// Save time for a domain
async function saveTime(domain, seconds) {
  if (!domain || seconds < 1) return;

  const today = new Date().toISOString().split('T')[0];
  const key = `time_${today}`;

  const result = await chrome.storage.local.get([key]);
  const data = result[key] || {};

  data[domain] = (data[domain] || 0) + seconds;
  await chrome.storage.local.set({ [key]: data });
}

// Track when tab changes
async function handleTabChange(url) {
  const now = Date.now();

  // Save time for previous tab
  if (activeTab && startTime) {
    const elapsed = Math.round((now - startTime) / 1000);
    await saveTime(activeTab, elapsed);
  }

  // Start tracking new tab
  const domain = getDomain(url);
  if (domain && !url.startsWith('chrome://')) {
    activeTab = domain;
    startTime = now;
  } else {
    activeTab = null;
    startTime = null;
  }
}

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (info) => {
  const tab = await chrome.tabs.get(info.tabId);
  if (tab.url) handleTabChange(tab.url);
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    handleTabChange(tab.url);
  }
});

// Save time every 30 seconds (in case user doesn't switch tabs)
chrome.alarms.create('saveInterval', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'saveInterval' && activeTab && startTime) {
    const now = Date.now();
    const elapsed = Math.round((now - startTime) / 1000);
    await saveTime(activeTab, elapsed);
    startTime = now; // Reset start time
  }
});

// Save when window loses focus
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (activeTab && startTime) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      await saveTime(activeTab, elapsed);
      startTime = null;
    }
  } else {
    startTime = Date.now();
  }
});

// Expose classify function for popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'classify') {
    sendResponse({ category: classify(msg.domain) });
  }
  return true;
});