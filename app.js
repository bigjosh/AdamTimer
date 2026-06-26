(function () {
  'use strict';

  // Shared asset root. app.js is served from the site root but runs on pages
  // nested under /g/<id>/; window.APP.base is '' at the root build and '../../'
  // in a group bundle. Asset fetches resolve against the page, so prefix them.
  var ASSET_BASE = (window.APP && window.APP.base) || '';
  function assetUrl(p) { return ASSET_BASE + p; }

  // --- Elements ---
  const startScreen = document.getElementById('start-screen');
  const timerScreen = document.getElementById('timer-screen');
  const completeScreen = document.getElementById('complete-screen');
  const menuScreen = document.getElementById('menu-screen');
  const statsScreen = document.getElementById('stats-screen');
  const detailScreen = document.getElementById('detail-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const screens = [startScreen, timerScreen, completeScreen, menuScreen, statsScreen, detailScreen, settingsScreen];

  const hamburgerBtn = document.getElementById('hamburger-btn');
  const menuCloseBtn = document.getElementById('menu-close');
  const menuStatistics = document.getElementById('menu-statistics');
  const menuSoundsBtn = document.getElementById('menu-sounds');
  const menuEmailBtn = document.getElementById('menu-email');
  const menuUpdateBtn = document.getElementById('menu-update');
  const menuInstallBtn = document.getElementById('menu-install');
  const menuIosEl = document.getElementById('menu-ios');
  const statsCloseBtn = document.getElementById('stats-close');
  const detailCloseBtn = document.getElementById('detail-close');
  const detailBtn = document.getElementById('detail-btn');
  const graphsContainer = document.getElementById('graphs-container');
  const statsDatePicker = document.getElementById('stats-date-picker');
  const sessionListEl = document.getElementById('session-list');
  const statsSummaryEl = document.getElementById('stats-summary');
  const settingsCloseBtn = document.getElementById('settings-close');
  const soundLeadInSelect = document.getElementById('sound-leadin');
  const soundMeditationSelect = document.getElementById('sound-meditation');
  const soundLeadOutSelect = document.getElementById('sound-leadout');
  const emailDialogOverlay = document.getElementById('email-dialog-overlay');
  const emailForm = document.getElementById('email-form');
  const emailInput = document.getElementById('email-input');
  const emailSkipBtn = document.getElementById('email-skip');
  const emailDeleteBtn = document.getElementById('email-delete');
  const emailDialogMessage = document.getElementById('email-dialog-message');

  const leadInInput = document.getElementById('lead-in');
  const meditationInput = document.getElementById('meditation');
  const leadOutInput = document.getElementById('lead-out');
  const startBtn = document.getElementById('start-btn');
  const startUpdateBtn = document.getElementById('start-update-btn');

  const timerDisplay = document.getElementById('timer-display');
  const pauseBtn = document.getElementById('pause-btn');
  const endBtn = document.getElementById('end-btn');

  const statTotal = document.getElementById('stat-total');
  const statLeadIn = document.getElementById('stat-leadin');
  const statMeditation = document.getElementById('stat-meditation');
  const statLeadOut = document.getElementById('stat-leadout');
  const logYes = document.getElementById('log-yes');
  const logNo = document.getElementById('log-no');
  const statAdditional = document.getElementById('stat-additional');
  const additionalDisplay = document.getElementById('additional-display');
  const additionalPlusBtn = document.getElementById('additional-plus');

  var SOUND_OPTIONS = [
    { name: 'Gong 1', label: 'Singing Bowl', file: 'sounds/Gong 1.m4a' },
    { name: 'Gong 2', label: 'Sanctuary Gong', file: 'sounds/Gong 2.wav' },
    { name: 'Gong 3', label: 'Chinese Gong', file: 'sounds/Gong 3.wav' },
    { name: 'Gong 4', label: 'Brass Bowl', file: 'sounds/Gong 4.wav' },
    { name: 'Gong 5', label: 'Short Bell', file: 'sounds/Gong 5.wav' },
    { name: 'Wood Block', label: 'Wood Block', file: 'sounds/Wood Block.m4a' }
  ];
  var SOUND_DEFAULTS = { leadIn: 'Wood Block', meditation: 'Gong 1', leadOut: 'Gong 5' };

  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbztPI-tkV2t_d3e7QQv_WZ7kOL8QWu5cmrsss8vTc2W8bpJDX9MS4lXWPFV_0F5_LX3sw/exec';

  var audioLeadIn, audioMeditation, audioLeadOut;

  let noSleep;
  try { noSleep = new NoSleep(); } catch (e) { /* ignore */ }

  // --- State ---
  const phases = ['LEADIN', 'MEDITATION', 'LEADOUT'];
  let currentPhase = null;
  let phaseIndex = 0;
  let phaseDurations = {}; // seconds per phase
  let endTime = 0;       // wall-clock ms target
  let paused = false;
  let pausedRemaining = 0; // ms remaining when paused
  let timerRAF = null;
  let sessionData = {};

  // Additional time state
  let meditationStartTime = 0; // ms timestamp, 0 = not started
  let endedEarly = 0;          // 0 or ms timestamp when End pressed
  let additionalRAF = null;
  let currentPhasePausedMs = 0; // accumulated pause ms for current phase
  let emailDialogMode = 'settings';
  let emailDialogReturnFocusEl = null;
  const phaseDataKey = { LEADIN: 'leadIn', MEDITATION: 'meditation', LEADOUT: 'leadOut' };

  // --- Helpers ---
  function fmt(totalSeconds, forceHours) {
    totalSeconds = Math.round(totalSeconds);
    if (forceHours || totalSeconds >= 3600) {
      var h = Math.floor(totalSeconds / 3600);
      var m = Math.floor((totalSeconds % 3600) / 60);
      var s = totalSeconds % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function formatTimeDisplay(totalSec) {
    if (totalSec === 0) return '0';
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var parts = [];
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    if (s > 0) parts.push(s + 's');
    return parts.join(' ');
  }

  function clampInput(el) {
    let v = parseInt(el.dataset.value) || 0;
    if (v < 0) v = 0;
    if (v > 59940) v = 59940; // 999 minutes
    v = Math.round(v / 10) * 10; // round to nearest 10s
    el.dataset.value = v;
    el.value = formatTimeDisplay(v);
    return v;
  }

  function getAdditionalSeconds() {
    if (!meditationStartTime) return 0;
    var now = endedEarly || Date.now();
    var elapsed = (now - meditationStartTime) / 1000;
    return Math.max(0, Math.floor(elapsed - phaseDurations.MEDITATION));
  }

  function updateAdditionalDisplay() {
    additionalDisplay.textContent = 'Add ' + fmt(getAdditionalSeconds());
  }

  function tickAdditional() {
    if (endedEarly) return;
    updateAdditionalDisplay();
    additionalRAF = requestAnimationFrame(tickAdditional);
  }

  function setStartUpdateAvailable(available) {
    startUpdateBtn.style.display = available ? 'inline-block' : 'none';
    startUpdateBtn.disabled = false;
    startUpdateBtn.textContent = 'Update to Latest Version';
  }

  function sendServiceWorkerMessage(message) {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);

    return navigator.serviceWorker.ready.then(function (registration) {
      return new Promise(function (resolve, reject) {
        var worker = registration.active || navigator.serviceWorker.controller;
        if (!worker) {
          resolve(null);
          return;
        }

        var channel = new MessageChannel();
        var timeout = setTimeout(function () {
          reject(new Error('Timed out waiting for service worker response'));
        }, 5000);

        channel.port1.onmessage = function (event) {
          clearTimeout(timeout);
          resolve(event.data || null);
        };

        worker.postMessage(message, [channel.port2]);
      });
    });
  }

  function refreshStartScreenUpdateState() {
    return sendServiceWorkerMessage({ type: 'CHECK_FOR_UPDATE' })
      .then(function (result) {
        setStartUpdateAvailable(!!(result && result.available));
      })
      .catch(function () {});
  }

  function onStartScreenActivated() {
    refreshStartScreenUpdateState();
  }

  function normalizeEmailAddress(value) {
    return String(value || '').trim();
  }

  function isValidEmailAddress(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function loadEmailAddress() {
    try {
      return normalizeEmailAddress(localStorage.getItem('meditation-email') || '');
    } catch (e) { return ''; }
  }

  function hasAskedForEmail() {
    try {
      return localStorage.getItem('meditation-email-prompted') === '1';
    } catch (e) { return true; }
  }

  function markEmailPrompted() {
    try { localStorage.setItem('meditation-email-prompted', '1'); } catch (e) {}
  }

  function saveEmailAddress(value) {
    var email = normalizeEmailAddress(value);
    try {
      if (email) localStorage.setItem('meditation-email', email);
      else localStorage.removeItem('meditation-email');
      localStorage.setItem('meditation-email-prompted', '1');
    } catch (e) {}
  }

  function clearEmailAddress() {
    try {
      localStorage.removeItem('meditation-email');
      localStorage.setItem('meditation-email-prompted', '1');
    } catch (e) {}
  }

  function setEmailDialogMessage(message) {
    emailDialogMessage.textContent = message || '';
  }

  function getEmailDialogReturnFocus() {
    if (emailDialogReturnFocusEl &&
        typeof emailDialogReturnFocusEl.focus === 'function' &&
        document.contains(emailDialogReturnFocusEl) &&
        !emailDialogReturnFocusEl.disabled) {
      return emailDialogReturnFocusEl;
    }
    return hamburgerBtn;
  }

  function openEmailDialog(mode) {
    var storedEmail = loadEmailAddress();
    emailDialogReturnFocusEl = document.activeElement;
    emailDialogMode = mode || 'settings';
    emailInput.value = storedEmail;
    emailDeleteBtn.style.display = emailDialogMode === 'settings' && storedEmail ? '' : 'none';
    emailSkipBtn.textContent = emailDialogMode === 'first-run' ? 'Skip' : 'Cancel';
    setEmailDialogMessage('');
    emailDialogOverlay.removeAttribute('inert');
    emailDialogOverlay.classList.add('active');
    setTimeout(function () {
      emailInput.focus();
      emailInput.select();
    }, 0);
  }

  function closeEmailDialog() {
    if (emailDialogOverlay.contains(document.activeElement)) {
      getEmailDialogReturnFocus().focus();
    }
    emailDialogOverlay.classList.remove('active');
    emailDialogOverlay.setAttribute('inert', '');
    setEmailDialogMessage('');
  }

  function maybePromptForEmail() {
    // Skip if we've already asked, or if an email was inherited from the other
    // context (Safari <-> installed app) via identity sync.
    if (hasAskedForEmail() || loadEmailAddress()) return;
    openEmailDialog('first-run');
  }

  // --- localStorage persistence ---
  function loadSettings() {
    try {
      const s = localStorage.getItem('meditation-settings');
      if (s) {
        const d = JSON.parse(s);
        var factor = d.v ? 1 : 60; // migrate old minutes to seconds
        if (d.leadIn != null) leadInInput.dataset.value = d.leadIn * factor;
        if (d.meditation != null) meditationInput.dataset.value = d.meditation * factor;
        if (d.leadOut != null) leadOutInput.dataset.value = d.leadOut * factor;
      }
    } catch (e) { /* private browsing */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem('meditation-settings', JSON.stringify({
        v: 2,
        leadIn: clampInput(leadInInput),
        meditation: clampInput(meditationInput),
        leadOut: clampInput(leadOutInput)
      }));
    } catch (e) { /* private browsing */ }
  }

  function loadHistory() {
    try {
      const h = localStorage.getItem('meditation-history');
      if (!h) return [];
      var arr = JSON.parse(h);
      var migrated = false;
      arr.forEach(function(s) {
        if (!s.v) {
          // v1: minutes → seconds
          s.leadIn = (s.leadIn || 0) * 60;
          s.meditation = (s.meditation || 0) * 60;
          s.leadOut = (s.leadOut || 0) * 60;
          delete s.totalMinutes;
        }
        if (!s.v || s.v < 3) {
          // v1/v2 → v3: add per-phase tracking
          s.leadInCompleted = s.leadIn || 0;
          s.meditationCompleted = s.meditation || 0;
          s.leadOutCompleted = s.leadOut || 0;
          s.leadInPaused = 0;
          s.meditationPaused = 0;
          s.meditationLogged = s.meditation || 0;
          delete s.totalSeconds;
          delete s.completedFull;
          s.v = 3;
          migrated = true;
        }
      });
      if (migrated) {
        localStorage.setItem('meditation-history', JSON.stringify(arr));
      }
      return arr;
    } catch (e) { return []; }
  }

  function saveSession(data) {
    try {
      const history = loadHistory();
      var entry = Object.assign({}, data);
      ['leadInPaused', 'leadInCompleted', 'meditationPaused', 'meditationCompleted',
       'leadOutCompleted', 'meditationLogged'].forEach(function(k) {
        if (entry[k] != null) entry[k] = Math.round(entry[k]);
      });
      history.push(entry);
      localStorage.setItem('meditation-history', JSON.stringify(history));
    } catch (e) { /* ignore */ }
  }

  // --- POST queue for sheet logging ---
  function loadPostQueue() {
    try {
      var stored = localStorage.getItem('meditation-post-queue');
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  }

  function savePostQueue(queue) {
    try {
      localStorage.setItem('meditation-post-queue', JSON.stringify(queue));
    } catch (e) { /* ignore */ }
  }

  var LOG_VERSION = 3;

  function createLogPayload(action) {
    var payload = {
      action: action,
      date: new Date().toISOString(),
      v: LOG_VERSION,
      userId: appUserId
    };
    if (appGroupId) payload.groupId = appGroupId;
    var email = loadEmailAddress();
    if (email) payload.email = email;
    return payload;
  }

  function enqueueAndFlush(payload) {
    var queue = loadPostQueue();
    queue.push(payload);
    savePostQueue(queue);
    flushPostQueue();
  }

  function logSession(data) {
    var payload = createLogPayload('session');
    payload.date = data.date;
    payload.leadIn = data.leadIn;
    payload.meditation = data.meditation;
    payload.leadOut = data.leadOut;
    payload.leadInPaused = data.leadInPaused;
    payload.leadInCompleted = data.leadInCompleted;
    payload.meditationPaused = data.meditationPaused;
    payload.meditationCompleted = data.meditationCompleted;
    payload.leadOutCompleted = data.leadOutCompleted;
    payload.meditationLogged = data.meditationLogged;
    enqueueAndFlush(payload);
  }

  function logInstall() {
    enqueueAndFlush(createLogPayload('install'));
  }

  // Fired once, on the first time the app is launched as an installed PWA.
  // This is distinct from the 'install' action (the browser's appinstalled
  // event), which iOS never fires. The "already logged" flag lives entirely
  // within the standalone context, so localStorage is safe here — it never
  // needs to cross the Safari <-> standalone storage boundary.
  function logInstalledOnFirstLaunch() {
    if (!isStandalone()) return;
    try {
      if (localStorage.getItem('meditation-installed') === '1') return;
      localStorage.setItem('meditation-installed', '1');
    } catch (e) { /* if storage is unavailable, fall through and log once */ }
    enqueueAndFlush(createLogPayload('installed'));
  }

  function flushPostQueue() {
    if (!SHEET_URL) return;
    var queue = loadPostQueue();
    if (!queue.length) return;

    var item = queue.shift();
    savePostQueue(queue);

    fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(item)
    }).then(function () {
      flushPostQueue();
    }).catch(function () {
      queue = loadPostQueue();
      queue.unshift(item);
      savePostQueue(queue);
    });
  }

  // --- Statistics ---
  function toLocalDateStr(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function formatDuration(totalSec) {
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  function formatDateNice(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function computeStats(history) {
    var totalSessions = history.length;

    var totalMeditationSec = 0;
    history.forEach(function (s) {
      totalMeditationSec += (s.meditationLogged || 0);
    });

    var now = new Date();
    var cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 14);
    var recentMeditationSec = 0;
    history.forEach(function (s) {
      if (new Date(s.date) >= cutoff) {
        recentMeditationSec += (s.meditationLogged || 0);
      }
    });

    var uniqueDates = [];
    var seen = {};
    history.forEach(function (s) {
      var ds = toLocalDateStr(new Date(s.date));
      if (!seen[ds]) { seen[ds] = true; uniqueDates.push(ds); }
    });
    uniqueDates.sort();

    // Current streak: walk backwards from today
    var currentStreak = 0;
    var check = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (true) {
      var cs = toLocalDateStr(check);
      if (seen[cs]) {
        currentStreak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak
    var longestStreak = 0;
    var longestEnd = '';
    if (uniqueDates.length > 0) {
      var streak = 1;
      var streakEnd = uniqueDates[0];
      for (var i = 1; i < uniqueDates.length; i++) {
        var prev = new Date(uniqueDates[i - 1] + 'T12:00:00');
        var curr = new Date(uniqueDates[i] + 'T12:00:00');
        var diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak++;
          streakEnd = uniqueDates[i];
        } else {
          if (streak > longestStreak) {
            longestStreak = streak;
            longestEnd = streakEnd;
          }
          streak = 1;
          streakEnd = uniqueDates[i];
        }
      }
      if (streak > longestStreak) {
        longestStreak = streak;
        longestEnd = streakEnd;
      }
    }

    return {
      totalSessions: totalSessions,
      totalMeditationSec: totalMeditationSec,
      recentMeditationSec: recentMeditationSec,
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      longestEnd: longestEnd
    };
  }

  function renderStatsSummary(stats) {
    var html = '';
    if (appGroupId) {
      var gname = (window.APP && window.APP.group && window.APP.group.name) || '';
      var gesc = gname.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
      var gval = gesc ? gesc + ' (' + appGroupId + ')' : appGroupId;
      html += '<div class="stat-row"><span class="stat-label">Group</span><span class="stat-value">' + gval + '</span></div>';
    }
    html += '<div class="stat-row"><span class="stat-label">Total Sessions</span><span class="stat-value">' + stats.totalSessions + '</span></div>';
    html += '<div class="stat-row"><span class="stat-label">Total Meditation</span><span class="stat-value">' + formatDuration(stats.totalMeditationSec) + '</span></div>';
    html += '<div class="stat-row"><span class="stat-label">Last 14 Days</span><span class="stat-value">' + formatDuration(stats.recentMeditationSec) + '</span></div>';
    html += '<div class="stat-row"><span class="stat-label">Current Streak</span><span class="stat-value">' + stats.currentStreak + (stats.currentStreak === 1 ? ' day' : ' days') + '</span></div>';
    var longestText = stats.longestStreak + (stats.longestStreak === 1 ? ' day' : ' days');
    if (stats.longestEnd) longestText += ' (' + formatDateNice(stats.longestEnd) + ')';
    html += '<div class="stat-row"><span class="stat-label">Longest Streak</span><span class="stat-value">' + longestText + '</span></div>';
    statsSummaryEl.innerHTML = html;
  }

  function renderSessionList(history) {
    var sorted = history.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var html = '';
    sorted.forEach(function (s) {
      var d = new Date(s.date);
      var dateStr = toLocalDateStr(d);
      var timeStr = d.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
      var completed = (s.leadInCompleted === s.leadIn) &&
        (s.meditationCompleted === s.meditation) && (s.leadOutCompleted === s.leadOut);
      var status = completed ? 'Completed' : 'Ended early';

      html += '<div class="session-entry" data-date="' + dateStr + '">';
      html += '<div class="session-entry-date">' + timeStr + '</div>';
      html += '<div class="session-entry-details">';
      html += formatTimeDisplay(s.meditationLogged || 0) + ' &middot; ' + status;
      html += '</div></div>';
    });

    if (sorted.length === 0) {
      html = '<div class="session-entry-details" style="text-align:center;opacity:0.4">No sessions logged yet</div>';
    }

    sessionListEl.innerHTML = html;
  }

  function niceMax(val) {
    if (val <= 0) return 0;
    var exp = Math.floor(Math.log10(val));
    var base = Math.pow(10, exp);
    var frac = val / base;
    if (frac <= 1) return base;
    if (frac <= 2) return 2 * base;
    if (frac <= 3) return 3 * base;
    if (frac <= 4) return 4 * base;
    if (frac <= 5) return 5 * base;
    return 10 * base;
  }

  function renderBarGraph(data, title) {
    var rawMax = 0;
    data.values.forEach(function(v) { if (v > rawMax) rawMax = v; });
    var maxVal = niceMax(rawMax);

    var html = '<div class="graph">';
    html += '<div class="graph-title">' + title + '</div>';
    html += '<div class="graph-body">';

    // Y-axis ticks and gridlines
    if (maxVal > 0) {
      var mid = maxVal / 2;
      html += '<div class="graph-y-tick" style="top:0">' + Math.round(maxVal) + 'm</div>';
      html += '<div class="graph-gridline" style="top:0"></div>';
      html += '<div class="graph-y-tick" style="top:50px">' + Math.round(mid) + 'm</div>';
      html += '<div class="graph-gridline" style="top:50px"></div>';
    }

    html += '<div class="graph-bars">';
    data.values.forEach(function(v) {
      var pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
      html += '<div class="graph-col"><div class="graph-bar" style="height:' + pct + '%"></div></div>';
    });
    html += '</div>';
    html += '<div class="graph-labels">';
    data.labels.forEach(function(l) {
      html += '<div class="graph-label">' + l + '</div>';
    });
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function renderGraphs(history) {
    var byDate = {};
    history.forEach(function(s) {
      var ds = toLocalDateStr(new Date(s.date));
      if (!byDate[ds]) byDate[ds] = 0;
      byDate[ds] += Number(s.meditationLogged) || 0;
    });

    var html = '';
    var today = new Date();

    // 1. Daily — Last 14 Days
    var dailyLabels = [];
    var dailyValues = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var ds = toLocalDateStr(d);
      dailyLabels.push(d.getDate());
      dailyValues.push((byDate[ds] || 0) / 60);
    }
    html += renderBarGraph({ labels: dailyLabels, values: dailyValues }, 'Daily \u2014 Last 14 Days');

    // Determine earliest session date
    var earliest = null;
    history.forEach(function(s) {
      var sd = new Date(s.date);
      if (!earliest || sd < earliest) earliest = sd;
    });

    if (earliest) {
      var weeksAgo = (today - earliest) / (1000 * 60 * 60 * 24 * 7);

      // 2. Weekly Avg — Last 12 Weeks
      if (weeksAgo >= 3) {
        var weekLabels = [];
        var weekValues = [];
        for (var w = 11; w >= 0; w--) {
          var weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() - w * 7);
          var weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() - 6);
          var sum = 0;
          for (var di = 0; di < 7; di++) {
            var dd = new Date(weekStart);
            dd.setDate(dd.getDate() + di);
            var dds = toLocalDateStr(dd);
            sum += (byDate[dds] || 0);
          }
          weekLabels.push(12 - w);
          weekValues.push((sum / 7) / 60);
        }
        html += renderBarGraph({ labels: weekLabels, values: weekValues }, 'Weekly Avg \u2014 Last 12 Weeks');
      }

      // 3. Monthly Avg — Last 12 Months
      var monthsAgo = (today.getFullYear() - earliest.getFullYear()) * 12 + (today.getMonth() - earliest.getMonth());
      if (monthsAgo >= 3) {
        var monthLabels = [];
        var monthValues = [];
        var monthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        for (var m = 11; m >= 0; m--) {
          var md = new Date(today.getFullYear(), today.getMonth() - m, 1);
          var daysInMonth = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate();
          var sum = 0;
          for (var di = 1; di <= daysInMonth; di++) {
            var dds = md.getFullYear() + '-' + String(md.getMonth() + 1).padStart(2, '0') + '-' + String(di).padStart(2, '0');
            sum += (byDate[dds] || 0);
          }
          monthLabels.push(monthAbbr[md.getMonth()]);
          monthValues.push((sum / daysInMonth) / 60);
        }
        html += renderBarGraph({ labels: monthLabels, values: monthValues }, 'Monthly Avg \u2014 Last 12 Months');
      }
    }

    graphsContainer.innerHTML = html;
  }

  // --- Validation ---
  function validateInputs() {
    const li = clampInput(leadInInput);
    const med = clampInput(meditationInput);
    const lo = clampInput(leadOutInput);
    const total = li + med + lo;
    startBtn.disabled = total === 0;
  }

  // --- Screen transitions ---
  var FADE_MS = 500;

  function showScreen(target) {
    return new Promise(resolve => {
      const current = screens.find(s => s.classList.contains('active'));

      if (current && current !== target) {
        current.classList.add('fade-out');
        current.classList.remove('fade-in');
        setTimeout(() => {
          current.classList.remove('active', 'fade-out');
          current.style.opacity = '';
          target.classList.add('active', 'fade-in');
          setTimeout(() => {
            target.classList.remove('fade-in');
            if (target === startScreen) onStartScreenActivated();
            resolve();
          }, FADE_MS);
        }, FADE_MS);
      } else {
        target.classList.add('active', 'fade-in');
        setTimeout(() => {
          target.classList.remove('fade-in');
          if (target === startScreen) onStartScreenActivated();
          resolve();
        }, FADE_MS);
      }
    });
  }

  // --- Audio ---
  function primeAudio() {
    [audioLeadIn, audioMeditation, audioLeadOut].forEach(function (a) {
      a.play().catch(function () {});
    });
  }

  function playSound(audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.muted = false;
    audioEl.play().catch(function () {});
  }

  // --- Timer ---
  function startPhaseTimer(durationSec) {
    paused = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.display = currentPhase === 'LEADOUT' ? 'none' : '';
    timerDisplay.classList.remove('heartbeat');
    if (currentPhase === 'MEDITATION') {
      meditationStartTime = Date.now();
    }
    endTime = Date.now() + durationSec * 1000;
    tick();
  }

  function tick() {
    if (paused) return;

    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const secs = Math.ceil(remaining / 1000);

    var useHours = phaseDurations[currentPhase] >= 3600;
    if (currentPhase === 'LEADOUT') {
      timerDisplay.textContent = fmt(phaseDurations[currentPhase] - secs, useHours);
    } else {
      timerDisplay.textContent = fmt(secs, useHours);
    }

    if (remaining <= 0) {
      timerDisplay.textContent = currentPhase === 'LEADOUT' ? fmt(phaseDurations[currentPhase], useHours) : fmt(0, useHours);
      onPhaseComplete();
      return;
    }

    timerRAF = requestAnimationFrame(tick);
  }

  function onPhaseComplete() {
    cancelAnimationFrame(timerRAF);

    // Save phase data
    var key = phaseDataKey[currentPhase];
    sessionData[key + 'Completed'] = phaseDurations[currentPhase];
    if (currentPhase !== 'LEADOUT') {
      sessionData[key + 'Paused'] = currentPhasePausedMs / 1000;
    }
    currentPhasePausedMs = 0;

    // Play sound for completed phase
    if (currentPhase === 'LEADIN') {
      playSound(audioLeadIn);
    } else if (currentPhase === 'MEDITATION') {
      playSound(audioMeditation);
    } else if (currentPhase === 'LEADOUT') {
      playSound(audioLeadOut);
    }

    // Brief pause for sound, then advance
    setTimeout(() => advancePhase(), 400);
  }

  function advancePhase() {
    phaseIndex++;

    // Find next non-zero phase
    while (phaseIndex < phases.length && phaseDurations[phases[phaseIndex]] === 0) {
      phaseIndex++;
    }

    if (phaseIndex >= phases.length) {
      // All phases done
      finishSession(false);
      return;
    }

    currentPhase = phases[phaseIndex];
    transitionTimerPhase();
  }

  function transitionTimerPhase() {
    // Fade out current background
    timerScreen.classList.add('fade-out');
    timerScreen.classList.remove('fade-in');

    setTimeout(() => {
      // Set new time and background while invisible
      setTimerBackground(currentPhase);
      timerDisplay.textContent = currentPhase === 'LEADOUT' ? fmt(0, phaseDurations[currentPhase] >= 3600) : fmt(phaseDurations[currentPhase]);

      timerScreen.classList.remove('fade-out');
      timerScreen.classList.add('fade-in');

      setTimeout(() => {
        timerScreen.classList.remove('fade-in');
      }, FADE_MS);

      startPhaseTimer(phaseDurations[currentPhase]);
    }, FADE_MS);
  }

  function setTimerBackground(phase) {
    if (phase === 'LEADIN') {
      timerScreen.style.backgroundImage = 'none';
      timerScreen.style.backgroundColor = '#111';
    } else if (phase === 'MEDITATION') {
      timerScreen.style.backgroundImage = 'url(' + assetUrl('sand.jpg') + ')';
      timerScreen.style.backgroundColor = '#000';
    } else {
      timerScreen.style.backgroundImage = 'url(' + assetUrl('sea.jpg') + ')';
      timerScreen.style.backgroundColor = '#000';
    }
  }

  // --- Session flow ---
  function startSession() {
    startBtn.disabled = true;

    const li = clampInput(leadInInput);
    let med = clampInput(meditationInput);
    const lo = clampInput(leadOutInput);

    // Default meditation to 20 if all zeros handled by validation,
    // but if meditation specifically is 0/NaN and others exist, keep it 0
    if (li + med + lo === 0) return;

    phaseDurations = {
      LEADIN: li,
      MEDITATION: med,
      LEADOUT: lo
    };

    sessionData = {
      v: 3,
      date: new Date().toISOString(),
      leadIn: li,
      meditation: med,
      leadOut: lo,
      leadInPaused: 0,
      leadInCompleted: 0,
      meditationPaused: 0,
      meditationCompleted: 0,
      leadOutCompleted: 0,
      meditationLogged: 0
    };

    // Reset additional time state
    meditationStartTime = 0;
    endedEarly = 0;
    currentPhasePausedMs = 0;
    cancelAnimationFrame(additionalRAF);

    // Fresh audio objects for this session, then prime on user gesture
    createSessionAudio();
    primeAudio();

    // Wake lock enabled in click handler above

    // Find first non-zero phase
    phaseIndex = 0;
    while (phaseIndex < phases.length && phaseDurations[phases[phaseIndex]] === 0) {
      phaseIndex++;
    }

    if (phaseIndex >= phases.length) return; // shouldn't happen due to validation

    currentPhase = phases[phaseIndex];
    setTimerBackground(currentPhase);
    timerDisplay.textContent = currentPhase === 'LEADOUT' ? fmt(0, phaseDurations[currentPhase] >= 3600) : fmt(phaseDurations[currentPhase]);

    showScreen(timerScreen).then(() => {
      startPhaseTimer(phaseDurations[currentPhase]);
    });
  }

  function finishSession(early) {
    cancelAnimationFrame(timerRAF);

    if (early) {
      // Save partial phase data before clearing pause state
      var remainingMs = paused ? pausedRemaining : Math.max(0, endTime - Date.now());
      var key = phaseDataKey[currentPhase];
      sessionData[key + 'Completed'] = phaseDurations[currentPhase] - remainingMs / 1000;
      if (currentPhase !== 'LEADOUT') {
        sessionData[key + 'Paused'] = currentPhasePausedMs / 1000;
      }
      endedEarly = Date.now();
    }

    sessionData.meditationLogged = sessionData.meditationCompleted;

    paused = false;
    timerDisplay.classList.remove('heartbeat');

    try { noSleep && noSleep.disable(); } catch (e) { /* ignore */ }

    // Build stats
    statTotal.textContent = fmt(sessionData.meditation);

    // Show/hide additional time
    if (meditationStartTime && (!endedEarly || getAdditionalSeconds() > 0)) {
      updateAdditionalDisplay();
      statAdditional.style.display = '';
      if (!endedEarly) {
        tickAdditional();
      }
    } else {
      statAdditional.style.display = 'none';
    }

    showScreen(completeScreen);
  }

  // --- Pause ---
  function togglePause() {
    if (paused) {
      // Resume — accumulate pause duration
      paused = false;
      var pauseDurationMs = Date.now() - endTime + pausedRemaining;
      currentPhasePausedMs += pauseDurationMs;
      if (meditationStartTime) {
        meditationStartTime += pauseDurationMs;
      }
      endTime = Date.now() + pausedRemaining;
      pauseBtn.textContent = 'Pause';
      timerDisplay.classList.remove('heartbeat');
      tick();
    } else {
      // Pause
      paused = true;
      cancelAnimationFrame(timerRAF);
      pausedRemaining = Math.max(0, endTime - Date.now());
      pauseBtn.textContent = 'Resume';
      timerDisplay.classList.add('heartbeat');
    }
  }

  // --- Preset buttons ---
  document.querySelectorAll('.preset-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.closest('.setting').querySelector('input');
      if (btn.dataset.clear !== undefined) {
        input.dataset.value = 0;
      } else {
        input.dataset.value = (parseInt(input.dataset.value) || 0) + parseInt(btn.dataset.add);
      }
      clampInput(input);
      validateInputs();
      saveSettings();
    });
  });

  // --- Event listeners ---
  [leadInInput, meditationInput, leadOutInput].forEach(input => {
    input.addEventListener('input', () => {
      validateInputs();
      saveSettings();
    });
    input.addEventListener('blur', () => {
      clampInput(input);
      validateInputs();
      saveSettings();
    });
  });

  emailForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = normalizeEmailAddress(emailInput.value);
    if (!email) {
      setEmailDialogMessage('Enter an email address or press ' + emailSkipBtn.textContent + '.');
      emailInput.focus();
      return;
    }
    if (!isValidEmailAddress(email)) {
      setEmailDialogMessage('Please enter a valid email address.');
      emailInput.focus();
      return;
    }
    saveEmailAddress(email);
    closeEmailDialog();
  });

  emailSkipBtn.addEventListener('click', function () {
    if (emailDialogMode === 'first-run') {
      markEmailPrompted();
    }
    closeEmailDialog();
  });

  emailDeleteBtn.addEventListener('click', function () {
    clearEmailAddress();
    closeEmailDialog();
  });

  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;
    // Enable wake lock immediately on user gesture (iOS requires this)
    try { noSleep && noSleep.enable(); } catch (e) { /* ignore */ }
    startSession();
  });

  startUpdateBtn.addEventListener('click', function () {
    startUpdateBtn.disabled = true;
    startUpdateBtn.textContent = 'Updating\u2026';

    sendServiceWorkerMessage({ type: 'APPLY_UPDATE' })
      .then(function (result) {
        if (result && result.applied) {
          location.reload();
          return;
        }

        setStartUpdateAvailable(false);
      })
      .catch(function () {
        startUpdateBtn.disabled = false;
        startUpdateBtn.textContent = 'Update to Latest Version';
      });
  });

  pauseBtn.addEventListener('click', togglePause);

  endBtn.addEventListener('click', () => {
    finishSession(true);
  });

  logYes.addEventListener('click', () => {
    cancelAnimationFrame(additionalRAF);
    saveSession(sessionData);
    logSession(sessionData);
    showScreen(startScreen).then(() => {
      startBtn.disabled = false;
      validateInputs();
    });
  });

  logNo.addEventListener('click', () => {
    cancelAnimationFrame(additionalRAF);
    showScreen(startScreen).then(() => {
      startBtn.disabled = false;
      validateInputs();
    });
  });

  additionalPlusBtn.addEventListener('click', () => {
    cancelAnimationFrame(additionalRAF);
    if (!endedEarly) endedEarly = Date.now();
    var addSec = getAdditionalSeconds();
    sessionData.meditationLogged = sessionData.meditationCompleted + addSec;
    saveSession(sessionData);
    logSession(sessionData);
    showScreen(startScreen).then(() => {
      startBtn.disabled = false;
      validateInputs();
    });
  });

  // --- Sound Settings ---
  function findSoundFile(name) {
    var opt = SOUND_OPTIONS.find(function (o) { return o.name === name; });
    return opt ? assetUrl(opt.file) : '';
  }

  function loadSoundSettings() {
    var settings = SOUND_DEFAULTS;
    try {
      var stored = localStorage.getItem('meditation-sounds');
      if (stored) settings = JSON.parse(stored);
    } catch (e) {}
    return {
      leadIn: settings.leadIn || SOUND_DEFAULTS.leadIn,
      meditation: settings.meditation || SOUND_DEFAULTS.meditation,
      leadOut: settings.leadOut || SOUND_DEFAULTS.leadOut
    };
  }

  function createSessionAudio() {
    var settings = loadSoundSettings();
    audioLeadIn = new Audio(findSoundFile(settings.leadIn));
    audioMeditation = new Audio(findSoundFile(settings.meditation));
    audioLeadOut = new Audio(findSoundFile(settings.leadOut));
    audioLeadIn.muted = true;
    audioMeditation.muted = true;
    audioLeadOut.muted = true;
  }

  function saveSoundSettings(obj) {
    try { localStorage.setItem('meditation-sounds', JSON.stringify(obj)); } catch (e) {}
  }

  function cacheAllSounds() {
    if (!('caches' in window)) return;
    caches.open('meditation-v3').then(function (cache) {
      SOUND_OPTIONS.forEach(function (opt) {
        cache.match(assetUrl(opt.file)).then(function (cached) {
          if (!cached) cache.add(assetUrl(opt.file));
        });
      });
    });
  }

  function populateSoundSelects(settings) {
    [soundLeadInSelect, soundMeditationSelect, soundLeadOutSelect].forEach(function (sel) {
      sel.innerHTML = '';
      SOUND_OPTIONS.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.name;
        o.textContent = opt.label;
        sel.appendChild(o);
      });
    });
    soundLeadInSelect.value = settings.leadIn || SOUND_DEFAULTS.leadIn;
    soundMeditationSelect.value = settings.meditation || SOUND_DEFAULTS.meditation;
    soundLeadOutSelect.value = settings.leadOut || SOUND_DEFAULTS.leadOut;
  }

  function getCurrentSoundSettings() {
    return {
      leadIn: soundLeadInSelect.value,
      meditation: soundMeditationSelect.value,
      leadOut: soundLeadOutSelect.value
    };
  }

  function onSoundSelectChange() {
    saveSoundSettings(getCurrentSoundSettings());
  }

  soundLeadInSelect.addEventListener('change', onSoundSelectChange);
  soundMeditationSelect.addEventListener('change', onSoundSelectChange);
  soundLeadOutSelect.addEventListener('change', onSoundSelectChange);

  function previewSound(selectEl) {
    var file = findSoundFile(selectEl.value);
    if (file) {
      var preview = new Audio(file);
      preview.play().catch(function () {});
    }
  }

  document.getElementById('preview-leadin').addEventListener('click', function () { previewSound(soundLeadInSelect); });
  document.getElementById('preview-meditation').addEventListener('click', function () { previewSound(soundMeditationSelect); });
  document.getElementById('preview-leadout').addEventListener('click', function () { previewSound(soundLeadOutSelect); });

  // --- Menu navigation ---
  hamburgerBtn.addEventListener('click', () => {
    showScreen(menuScreen);
  });

  menuCloseBtn.addEventListener('click', () => {
    showScreen(startScreen);
  });

  menuSoundsBtn.addEventListener('click', () => {
    showScreen(settingsScreen);
  });

  menuEmailBtn.addEventListener('click', () => {
    openEmailDialog('settings');
  });

  settingsCloseBtn.addEventListener('click', () => {
    showScreen(menuScreen);
  });

  statsCloseBtn.addEventListener('click', () => {
    showScreen(startScreen);
  });

  menuStatistics.addEventListener('click', () => {
    var history = loadHistory();
    var stats = computeStats(history);
    renderStatsSummary(stats);
    renderGraphs(history);
    showScreen(statsScreen);
  });

  detailBtn.addEventListener('click', () => {
    var history = loadHistory();
    renderSessionList(history);
    statsDatePicker.value = '';
    showScreen(detailScreen);
  });

  detailCloseBtn.addEventListener('click', () => {
    showScreen(statsScreen);
  });

  statsDatePicker.addEventListener('change', () => {
    var target = statsDatePicker.value;
    if (!target) return;
    var entries = sessionListEl.querySelectorAll('.session-entry');
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].dataset.date === target) {
        entries[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  });

  // --- Force update ---
  menuUpdateBtn.addEventListener('click', async () => {
    menuUpdateBtn.textContent = 'Updating\u2026';
    menuUpdateBtn.style.opacity = '0.4';
    menuUpdateBtn.style.pointerEvents = 'none';
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    } catch (e) {}
    location.reload();
  });

  // --- Install prompt ---
  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    menuInstallBtn.style.display = '';
  });

  menuInstallBtn.addEventListener('click', () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
      deferredInstallPrompt = null;
      if (result.outcome === 'accepted') {
        menuInstallBtn.style.display = 'none';
      }
    });
  });

  window.addEventListener('appinstalled', () => {
    menuInstallBtn.style.display = 'none';
    deferredInstallPrompt = null;
  });

  // --- iOS install gate ---
  // On iOS, only Safari gives an installed web app its OWN storage, separate
  // from the browser tab. That split is what causes "asked for email twice" and
  // lost group context. So we FORCE iOS *Safari* users to install before using
  // the timer. Other iOS browsers (Chrome/Firefox/Edge/in-app) keep one shared
  // storage whether "installed" (a bookmark) or not, so there's nothing to
  // force — they just get the optional Add-to-Home-Screen hint in the menu.
  function isIOSDevice() {
    return (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !window.MSStream;
  }
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function isIOSSafari() {
    var ua = navigator.userAgent;
    // Real Safari has both "Safari" and "Version/"; every other iOS browser and
    // in-app webview carries a distinguishing token (or lacks "Version/").
    return /Safari/.test(ua) && /Version\//.test(ua) &&
      !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|FBAN|FBAV|FBIOS|Instagram|Line|MicroMessenger|Snapchat|Twitter|Pinterest|LinkedIn)/.test(ua);
  }

  function showInstallScreen() {
    var name = (window.APP && window.APP.group && window.APP.group.name) || 'this timer';
    var nameEls = document.querySelectorAll('.install-app-name');
    for (var i = 0; i < nameEls.length; i++) nameEls[i].textContent = name;
    document.getElementById('loading-screen').classList.remove('active');
    document.getElementById('install-screen').classList.add('active');
  }

  var installGated = false;
  (function () {
    if (!isIOSDevice() || isStandalone()) return;   // desktop/Android, or already installed
    if (isIOSSafari()) {
      installGated = true;       // boot skips the timer; install-screen takes over
      showInstallScreen();
    } else {
      menuIosEl.style.display = '';   // non-Safari iOS: optional hint, no forcing
    }
  })();

  // --- User ID ---
  var ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';

  function generateUserId() {
    var s = '';
    for (var i = 0; i < 10; i++) s += ZBASE32[Math.floor(Math.random() * 32)];
    return s;
  }

  function initUserId() {
    try {
      var stored = localStorage.getItem('meditation-user-id');
      if (stored) return stored;
      var legacy = localStorage.getItem('meditation-source');
      if (legacy) {
        localStorage.setItem('meditation-user-id', legacy);
        localStorage.removeItem('meditation-source');
        return legacy;
      }
    } catch (e) {}
    var generated = generateUserId();
    try { localStorage.setItem('meditation-user-id', generated); } catch (e) {}
    return generated;
  }

  // --- Group ID (baked into the page by the generator; see window.APP) ---
  function initGroupId() {
    return (window.APP && window.APP.group && window.APP.group.id) || '';
  }

  var appUserId = initUserId();
  var appGroupId = initGroupId();

  // Log the first launch as an installed PWA (covers iOS, which never fires
  // the appinstalled event).
  logInstalledOnFirstLaunch();

  // --- Init ---
  var PRECACHE_ASSETS = [
    'sand.jpg',
    'sea.jpg',
    'icon-192.png',
    'icon-512.png',
    'favicon.svg',
    'NoSleep.min.js'
  ].concat(SOUND_OPTIONS.map(function (o) { return o.file; }));

  Promise.all(PRECACHE_ASSETS.map(function (url) {
    return fetch(assetUrl(url)).catch(function () {});
  })).then(function () {
    if (installGated) return;   // iOS Safari, not installed: install-screen is showing
    document.getElementById('loading-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
    onStartScreenActivated();
    maybePromptForEmail();
  });

  loadSettings();
  populateSoundSelects(loadSoundSettings());
  cacheAllSounds();
  createSessionAudio();
  validateInputs();
  window.addEventListener('appinstalled', logInstall);
  flushPostQueue();
  window.addEventListener('online', flushPostQueue);

  // Register service worker uniformly across local and deployed environments.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .catch(function () {});
  }
})();
