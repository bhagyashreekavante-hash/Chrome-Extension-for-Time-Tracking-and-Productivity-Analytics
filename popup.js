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

function classify(domain) {
  if (PRODUCTIVE.some(s => domain.includes(s))) return 'productive';
  if (UNPRODUCTIVE.some(s => domain.includes(s))) return 'unproductive';
  return 'neutral';
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getDayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function loadData() {
  const today = getToday();
  const todayKey = `time_${today}`;
  const last7 = getLast7Days().map(d => `time_${d}`);

  const result = await chrome.storage.local.get([todayKey, ...last7]);
  const todayData = result[todayKey] || {};

  // ── Summary ──
  let productive = 0, unproductive = 0, neutral = 0;
  for (const [domain, secs] of Object.entries(todayData)) {
    const cat = classify(domain);
    if (cat === 'productive') productive += secs;
    else if (cat === 'unproductive') unproductive += secs;
    else neutral += secs;
  }

  document.getElementById('productive-time').textContent = formatTime(productive);
  document.getElementById('unproductive-time').textContent = formatTime(unproductive);
  document.getElementById('neutral-time').textContent = formatTime(neutral);

  // ── Score ──
  const total = productive + unproductive + neutral;
  const score = total > 0 ? Math.round((productive / (productive + unproductive || 1)) * 100) : 0;
  document.getElementById('score-bar').style.width = `${score}%`;
  document.getElementById('score-value').textContent = `${score}%`;

  // ── Top Sites ──
  const sitesList = document.getElementById('sites-list');
  const sorted = Object.entries(todayData).sort((a, b) => b[1] - a[1]).slice(0, 6);

  if (sorted.length === 0) {
    sitesList.innerHTML = '<div class="empty">No data yet. Browse some websites!</div>';
  } else {
    sitesList.innerHTML = sorted.map(([domain, secs]) => {
      const cat = classify(domain);
      return `
        <div class="site-row">
          <div class="site-dot ${cat}"></div>
          <div class="site-name">${domain}</div>
          <span class="site-tag ${cat}">${cat}</span>
          <div class="site-time">${formatTime(secs)}</div>
        </div>
      `;
    }).join('');
  }

  // ── Weekly Report ──
  const weeklyList = document.getElementById('weekly-list');
  const days = getLast7Days();

  const weekRows = days.map(day => {
    const data = result[`time_${day}`] || {};
    let prod = 0, unprod = 0;
    for (const [domain, secs] of Object.entries(data)) {
      const cat = classify(domain);
      if (cat === 'productive') prod += secs;
      else if (cat === 'unproductive') unprod += secs;
    }
    const dayScore = (prod + unprod) > 0 ? Math.round((prod / (prod + unprod)) * 100) : 0;
    return { day, dayScore };
  });

  const maxScore = Math.max(...weekRows.map(r => r.dayScore), 1);

  weeklyList.innerHTML = weekRows.map(({ day, dayScore }) => `
    <div class="week-row">
      <div class="week-day">${getDayLabel(day)}</div>
      <div class="week-bar-wrap">
        <div class="week-bar" style="width:${(dayScore / maxScore) * 100}%"></div>
      </div>
      <div class="week-score">${dayScore}%</div>
    </div>
  `).join('');
}

// ── Date display ──
document.getElementById('date').textContent = new Date().toLocaleDateString('en', {
  weekday: 'short', month: 'short', day: 'numeric'
});

// ── Clear today's data ──
document.getElementById('clear-btn').addEventListener('click', async () => {
  const today = getToday();
  await chrome.storage.local.remove(`time_${today}`);
  loadData();
});

// Load on open
loadData();