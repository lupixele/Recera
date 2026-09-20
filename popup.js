// ─── AutoAssess · popup.js ────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const LOGS_KEY = 'autoassess_logs';

let currentTab = 'live'; // 'live' | 'batch'
let parsedBatchAnswers = {}; // { qNum: answerIdx }
let extractedPrompt = '';

// ── Tab Navigation ───────────────────────────────────────────────────────────
$('tabLiveBtn').addEventListener('click', () => switchTab('live'));
$('tabBatchBtn').addEventListener('click', () => switchTab('batch'));

function switchTab(tab) {
  currentTab = tab;
  $('tabLiveBtn').classList.toggle('active', tab === 'live');
  $('tabBatchBtn').classList.toggle('active', tab === 'batch');
  $('tabLiveContent').classList.toggle('active', tab === 'live');
  $('tabBatchContent').classList.toggle('active', tab === 'batch');
}

// ── Logging Helpers ──────────────────────────────────────────────────────────
function renderLogLine(ts, msg, type = 'info') {
  const el = $('liveLogContainer');
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-ts">${ts}</span><span class="log-${type}">${escapeHtml(msg)}</span>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function log(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  renderLogLine(ts, msg, type);
}

// ── Status & Buttons ──────────────────────────────────────────────────────────
function updateLiveStatus(phase, text) {
  $('liveStatusDot').className = 'status-dot ' + phase;
  $('liveStatusText').textContent = text || phase;

  $('btnLiveStart').disabled = (phase === 'running');
  $('btnLivePause').disabled = (phase !== 'running');
  $('btnLiveStop').disabled  = (phase === 'idle' || phase === 'done');
}

function updateBatchStatus(phase, text) {
  $('fillStatusDot').className = 'status-dot ' + phase;
  $('fillStatusText').textContent = text || phase;
  $('fillStatusBadge').textContent = phase.toUpperCase();

  const hasAnswers = Object.keys(parsedBatchAnswers).length > 0;
  $('btnFillStart').disabled = (phase === 'running' || !hasAnswers);
  $('btnFillPause').disabled = (phase !== 'running');
  $('btnFillStop').disabled  = (phase === 'idle' || phase === 'done');
}

// ── Message Bridge to Background ──────────────────────────────────────────────
function sendBg(action, data = {}) {
  return new Promise((res, rej) => {
    chrome.runtime.sendMessage({ action, ...data }, r => {
      if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
      else res(r);
    });
  });
}

// ── Live Model Mode Wiring ───────────────────────────────────────────────────
$('btnLiveStart').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      log('✗ No active tab found.', 'err');
      return;
    }
    updateLiveStatus('running', 'Solving with model…');
    await sendBg('startLive', { tabId: tab.id });
  } catch (e) {
    log('✗ Error: ' + e.message, 'err');
    updateLiveStatus('idle', 'Ready');
  }
});

$('btnLivePause').addEventListener('click', async () => {
  updateLiveStatus('paused', 'Paused');
  await sendBg('pause');
});

$('btnLiveStop').addEventListener('click', async () => {
  updateLiveStatus('idle', 'Stopped');
  await sendBg('stop');
});

$('btnLiveReset').addEventListener('click', async () => {
  $('liveLogContainer').innerHTML = '';
  $('liveQCurrent').textContent = '0';
  $('liveQTotal').textContent = '0';
  updateLiveStatus('idle', 'Ready');
  await sendBg('reset');
});

// ── Batch Mode: Step 1 - Extract All Questions ───────────────────────────────
$('btnExtractAll').addEventListener('click', async () => {
  const btn = $('btnExtractAll');
  btn.disabled = true;
  btn.textContent = '⏳ Extracting…';
  $('exportBadge').textContent = 'Extracting…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      alert('Please switch to the Grand Assessment tab first.');
      btn.disabled = false;
      btn.textContent = '📥 Extract All Questions';
      return;
    }

    const res = await sendBg('extractAll', { tabId: tab.id });
    if (res && res.success) {
      extractedPrompt = res.promptText;
      $('exportBadge').textContent = `✓ ${res.count} extracted`;
      $('exportBadge').className = 'step-badge ready';
      $('btnCopyPrompt').disabled = false;

      const preview = $('promptPreviewText');
      preview.value = extractedPrompt;
      preview.style.display = 'block';

      btn.textContent = '✓ Extracted';
    } else {
      alert('Extraction failed: ' + (res?.error || 'Unknown error'));
      btn.textContent = '📥 Extract All Questions';
      btn.disabled = false;
    }
  } catch (e) {
    alert('Extraction error: ' + e.message);
    btn.textContent = '📥 Extract All Questions';
    btn.disabled = false;
  }
});

$('btnCopyPrompt').addEventListener('click', () => {
  if (!extractedPrompt) return;
  navigator.clipboard.writeText(extractedPrompt).then(() => {
    const btn = $('btnCopyPrompt');
    const old = btn.textContent;
    btn.textContent = '✓ Copied to Clipboard!';
    setTimeout(() => btn.textContent = old, 2000);
  });
});

// ── Batch Mode: Step 2 - Parse Answers ───────────────────────────────────────
function parsePastedAnswers(rawText) {
  const mapping = {};
  if (!rawText || typeof rawText !== 'string') return mapping;

  // 1. JSON
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/) || rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const q = item.q || item.question || item.qnum || (idx + 1);
            const a = (item.answer || item.choice || item.letter || item.opt || '').toString().trim().toUpperCase();
            if (a.length === 1 && a >= 'A' && a <= 'D') {
              mapping[parseInt(q, 10)] = a.charCodeAt(0) - 65;
            }
          } else if (typeof item === 'string') {
            const m = item.match(/([A-D])/i);
            if (m) mapping[idx + 1] = m[1].toUpperCase().charCodeAt(0) - 65;
          }
        });
        if (Object.keys(mapping).length > 0) return mapping;
      } else if (typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const qNum = parseInt(k.replace(/\D/g, ''), 10);
          const ans = String(v).trim().toUpperCase();
          const m = ans.match(/([A-D])/);
          if (qNum && m) {
            mapping[qNum] = m[1].charCodeAt(0) - 65;
          }
        }
        if (Object.keys(mapping).length > 0) return mapping;
      }
    }
  } catch (e) {}

  // 2. Line-by-line: "1. A", "1) B", "Q1: C", "1: D", "1 - A"
  const lines = rawText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(?:Q|Question)?\s*(\d+)[\.\:\)\-\s]+.*?([A-D])\b/i);
    if (m) {
      const qNum = parseInt(m[1], 10);
      const letter = m[2].toUpperCase();
      mapping[qNum] = letter.charCodeAt(0) - 65;
    }
  }

  // 3. Fallback: Letter sequence "A, B, C, D..."
  if (Object.keys(mapping).length === 0) {
    const letters = rawText.match(/\b([A-D])\b/gi);
    if (letters && letters.length >= 2) {
      letters.forEach((l, i) => {
        mapping[i + 1] = l.toUpperCase().charCodeAt(0) - 65;
      });
    }
  }

  return mapping;
}

$('btnParseAnswers').addEventListener('click', () => {
  const text = $('pastedAnswersInput').value.trim();
  if (!text) {
    alert('Please paste answers from Claude/ChatGPT first.');
    return;
  }

  parsedBatchAnswers = parsePastedAnswers(text);
  const count = Object.keys(parsedBatchAnswers).length;

  if (count === 0) {
    alert('Could not parse any answers. Ensure format is like "1. A", "2. B" or JSON.');
    return;
  }

  // Update UI
  $('answersCountBadge').textContent = `✓ ${count} loaded`;
  $('answersCountBadge').className = 'step-badge ready';

  const preview = $('answersPreviewList');
  preview.innerHTML = '';
  preview.style.display = 'flex';

  const sortedKeys = Object.keys(parsedBatchAnswers).map(Number).sort((a, b) => a - b);
  sortedKeys.forEach(k => {
    const chip = document.createElement('span');
    chip.className = 'ans-chip';
    chip.innerHTML = `Q${k}: <strong>${String.fromCharCode(65 + parsedBatchAnswers[k])}</strong>`;
    preview.appendChild(chip);
  });

  // Enable Start Fill button
  $('btnFillStart').disabled = false;
  $('fillQTotal').textContent = count;
});

// ── Batch Mode: Step 3 - Start Auto-Fill ─────────────────────────────────────
$('btnFillStart').addEventListener('click', async () => {
  let count = Object.keys(parsedBatchAnswers).length;
  if (count === 0) {
    const raw = $('pastedAnswersInput').value.trim();
    if (raw) {
      parsedBatchAnswers = parsePastedAnswers(raw);
      count = Object.keys(parsedBatchAnswers).length;
    }
  }

  if (count === 0) {
    alert('Please paste your answers into the box first (e.g. 1. A, 2. B, or Q1: C).');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      alert('Assessment tab not found. Open the Grand Assessment tab.');
      return;
    }

    updateBatchStatus('running', 'Filling answers on page…');
    await sendBg('startBatchFill', { tabId: tab.id, answers: parsedBatchAnswers });
  } catch (e) {
    alert('Failed to start fill: ' + e.message);
    updateBatchStatus('idle', 'Ready');
  }
});

$('btnFillPause').addEventListener('click', async () => {
  updateBatchStatus('paused', 'Paused');
  await sendBg('pause');
});

$('btnFillStop').addEventListener('click', async () => {
  updateBatchStatus('idle', 'Stopped');
  await sendBg('stop');
});

// ── Settings Link ─────────────────────────────────────────────────────────────
$('openOptions').addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
$('settings-icon').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ── Incoming Messages from Background ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _src, sendResp) => {
  if (msg.type === 'status') {
    if (msg.mode === 'batch') {
      updateBatchStatus(msg.phase, msg.text);
    } else {
      updateLiveStatus(msg.phase, msg.text);
    }
  } else if (msg.type === 'progress') {
    if (msg.mode === 'batch') {
      $('fillQCurrent').textContent = msg.current;
      $('fillQTotal').textContent = msg.total;
    } else {
      $('liveQCurrent').textContent = msg.current;
      $('liveQTotal').textContent = msg.total;
    }
  } else if (msg.type === 'log') {
    renderLogLine(msg.ts || new Date().toLocaleTimeString('en-GB'), msg.msg, msg.level || 'info');
  } else if (msg.type === 'done') {
    updateLiveStatus('done', 'Completed');
    updateBatchStatus('done', 'Completed');
  }
  sendResp({ ok: true });
  return true;
});

// ── State Hydration on Open ───────────────────────────────────────────────────
(async () => {
  try {
    // 1. Restore historical logs
    const storedLogs = await chrome.storage.local.get([LOGS_KEY]);
    const logs = storedLogs[LOGS_KEY] || [];
    const container = $('liveLogContainer');
    container.innerHTML = '';
    logs.forEach(l => renderLogLine(l.ts, l.msg, l.level));

    // 2. Query live state from background
    const res = await sendBg('getState');
    if (res) {
      const { session, config, extracted, batchAnswers } = res;

      $('brandTitle').textContent = 'Recera';
      if (config && config.model) {
        $('activeModelLabel').textContent = `Model: ${config.model.split('/').pop()}`;
      }

      // Restore Extracted Questions
      if (extracted && extracted.questions) {
        extractedPrompt = extracted.promptText || '';
        $('exportBadge').textContent = `✓ ${extracted.total} extracted`;
        $('exportBadge').className = 'step-badge ready';
        $('btnCopyPrompt').disabled = false;
        $('promptPreviewText').value = extractedPrompt;
        $('promptPreviewText').style.display = 'block';
      }

      // Restore Batch Answers
      if (batchAnswers && Object.keys(batchAnswers).length > 0) {
        parsedBatchAnswers = batchAnswers;
        const count = Object.keys(parsedBatchAnswers).length;
        $('answersCountBadge').textContent = `✓ ${count} loaded`;
        $('answersCountBadge').className = 'step-badge ready';
        $('btnFillStart').disabled = false;

        const preview = $('answersPreviewList');
        preview.innerHTML = '';
        preview.style.display = 'flex';
        const sortedKeys = Object.keys(parsedBatchAnswers).map(Number).sort((a, b) => a - b);
        sortedKeys.forEach(k => {
          const chip = document.createElement('span');
          chip.className = 'ans-chip';
          chip.innerHTML = `Q${k}: <strong>${String.fromCharCode(65 + parsedBatchAnswers[k])}</strong>`;
          preview.appendChild(chip);
        });
      }

      // Restore Running / Paused State
      if (session) {
        if (session.mode === 'batch') {
          switchTab('batch');
          $('fillQCurrent').textContent = session.currentQNum || 0;
          $('fillQTotal').textContent = session.totalQs || Object.keys(parsedBatchAnswers).length || 0;
          if (session.active) {
            updateBatchStatus(session.paused ? 'paused' : 'running', session.paused ? 'Paused' : 'Filling answers…');
          }
        } else {
          $('liveQCurrent').textContent = session.currentQNum || 0;
          $('liveQTotal').textContent = session.totalQs || 0;
          if (session.active) {
            updateLiveStatus(session.paused ? 'paused' : 'running', session.paused ? 'Paused' : 'Solving with model…');
          }
        }
      }
    }
  } catch (e) {
    updateLiveStatus('idle', 'Ready');
  }
})();