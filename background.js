// ─── AutoAssess · background.js (Service Worker) ─────────────────────────────

const CONFIG_KEY = 'autoassess_config';
const RUNTIME_STATE_KEY = 'autoassess_runtime_state';
const LOGS_KEY = 'autoassess_logs';
const EXTRACTED_QUESTIONS_KEY = 'autoassess_extracted_questions';
const BATCH_ANSWERS_KEY = 'autoassess_batch_answers';

const DEFAULT_CONFIG = {
  baseUrl:        'http://localhost:11434/v1',
  apiKey:         'ollama',
  model:          'nvidia/nvidia/nemotron-3-super-120b-a12b',
  maxTokens:      1024,
  delayMs:        2000,
  maxRetries:     2,
  timeoutSecs:    60,
  fallbackAction: 'guess_a', // 'guess_a' | 'pause'
};

let session = {
  mode:        'live',  // 'live' | 'batch'
  active:      false,
  paused:      false,
  tabId:       null,
  currentQNum: 0,
  totalQs:     0,
  solvedCount: 0,
  lastQNorm:   '',
  batchAnswers:{},      // { qNum: answerIdx }
  config:      { ...DEFAULT_CONFIG },
};

// ── Persistence Helpers ───────────────────────────────────────────────────────
async function loadState() {
  const data = await chrome.storage.local.get([CONFIG_KEY, RUNTIME_STATE_KEY, BATCH_ANSWERS_KEY]);
  session.config = { ...DEFAULT_CONFIG, ...(data[CONFIG_KEY] || {}) };
  if (data[BATCH_ANSWERS_KEY]) {
    session.batchAnswers = data[BATCH_ANSWERS_KEY];
  }
  if (data[RUNTIME_STATE_KEY]) {
    const s = data[RUNTIME_STATE_KEY];
    session.mode        = s.mode || 'live';
    session.active      = !!s.active;
    session.paused      = !!s.paused;
    session.tabId       = s.tabId || null;
    session.currentQNum = s.currentQNum || 0;
    session.totalQs     = s.totalQs || 0;
    session.solvedCount = s.solvedCount || 0;
    session.lastQNorm   = s.lastQNorm || '';
  }
}

async function persistRuntimeState() {
  await chrome.storage.local.set({
    [RUNTIME_STATE_KEY]: {
      mode:        session.mode,
      active:      session.active,
      paused:      session.paused,
      tabId:       session.tabId,
      currentQNum: session.currentQNum,
      totalQs:     session.totalQs,
      solvedCount: session.solvedCount,
      lastQNorm:   session.lastQNorm,
    }
  });
}

async function appendLog(msg, level = 'info') {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const entry = { ts, msg, level };
  
  chrome.runtime.sendMessage({ type: 'log', ...entry }).catch(() => {});

  try {
    const res = await chrome.storage.local.get([LOGS_KEY]);
    const logs = res[LOGS_KEY] || [];
    logs.push(entry);
    if (logs.length > 100) logs.shift();
    await chrome.storage.local.set({ [LOGS_KEY]: logs });
  } catch (e) {}
}

function notifyStatus(phase, text) {
  chrome.runtime.sendMessage({ type: 'status', phase, text, mode: session.mode }).catch(() => {});
}

function notifyProgress(current, total, question) {
  session.currentQNum = current;
  session.totalQs = total;
  chrome.runtime.sendMessage({ type: 'progress', current, total, question, mode: session.mode }).catch(() => {});
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── In-page DOM Functions (Serialized & Injected) ─────────────────────────────

// 1. Extract the currently visible question
function domExtractQuestion() {
  try {
    let questionText = '';
    let questionName = '';

    const label = document.querySelector('label[for^="question"], label.col-form-label, label.form-label');
    if (label) {
      questionText = label.textContent.trim();
      questionName = label.htmlFor || label.getAttribute('for') || '';
    } else {
      const cardText = document.querySelector('.card-text');
      if (cardText) questionText = cardText.textContent.trim();
    }

    if (!questionText) {
      return { question: null, options: [], current: 0, total: 0 };
    }

    let radios = [];
    if (questionName) {
      radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${questionName}"]`));
    }
    if (radios.length === 0) {
      radios = Array.from(document.querySelectorAll('input.form-check-input[type="radio"]'));
    }

    const options = [];
    radios.forEach((radio, idx) => {
      let optText = '';
      if (radio.id) {
        const optLabel = document.querySelector(`label[for="${radio.id}"]`);
        if (optLabel) optText = optLabel.textContent.trim();
      }
      if (!optText) {
        const parent = radio.closest('.form-check');
        if (parent) {
          const lbl = parent.querySelector('.form-check-label, label');
          if (lbl) optText = lbl.textContent.trim();
        }
      }
      if (!optText) optText = radio.value || `Option ${idx + 1}`;
      options.push(optText);
    });

    let current = 0;
    let total = 0;

    const allEls = Array.from(document.querySelectorAll('span, p, div, h6'));
    for (const el of allEls) {
      const text = el.textContent.trim();
      const m = text.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
      if (m) {
        current = parseInt(m[1], 10);
        total = parseInt(m[2], 10);
        break;
      }
    }

    if (!current && questionName) {
      const m = questionName.match(/question(\d+)/i);
      if (m) current = parseInt(m[1], 10) + 1;
    }

    const navItems = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]')).filter(
      el => /^\d+$/.test(el.textContent.trim())
    );
    if (navItems.length > 0) {
      if (!total) total = navItems.length;
      if (!current) {
        navItems.forEach((item, i) => {
          const style = item.getAttribute('style') || '';
          if (style.includes('3px') || style.includes('bold') || style.includes('0, 135, 48')) {
            current = i + 1;
          }
        });
      }
    }

    return {
      question: questionText,
      options,
      current: current || 1,
      total: total || 0,
    };
  } catch (e) {
    return { error: e.message, question: null, options: [], current: 0, total: 0 };
  }
}

// 2. Select radio button using React-compatible setter
function domSelectAnswer(answerIdx) {
  try {
    const label = document.querySelector('label[for^="question"], label.col-form-label, label.form-label');
    const questionName = label ? (label.htmlFor || label.getAttribute('for')) : '';

    let radios = [];
    if (questionName) {
      radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${questionName}"]`));
    }
    if (radios.length === 0) {
      radios = Array.from(document.querySelectorAll('input.form-check-input[type="radio"]'));
    }

    if (radios.length === 0 || answerIdx < 0 || answerIdx >= radios.length) {
      return { success: false, reason: 'radio_not_found', count: radios.length };
    }

    const radio = radios[answerIdx];

    const nativeCheckedDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    if (nativeCheckedDescriptor && nativeCheckedDescriptor.set) {
      nativeCheckedDescriptor.set.call(radio, true);
    } else {
      radio.checked = true;
    }

    radio.dispatchEvent(new Event('input', { bubbles: true }));
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    radio.click();

    return { success: radio.checked, selectedIndex: answerIdx };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 3. Click Next button in page
function domClickNext() {
  try {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextBtn = buttons.find(b => {
      const txt = b.textContent.trim().toLowerCase();
      return (txt === 'next' || txt.includes('next')) && !b.disabled;
    });

    if (nextBtn) {
      nextBtn.setAttribute('type', 'button');
      nextBtn.click();
      return { action: 'next', success: true };
    }

    const submitBtn = buttons.find(b => {
      const txt = b.textContent.trim().toLowerCase();
      return (txt === 'submit' || txt === 'finish' || txt.includes('complete')) && !b.disabled;
    });

    if (submitBtn) {
      submitBtn.setAttribute('type', 'button');
      submitBtn.click();
      return { action: 'submit', success: true };
    }

    return { action: 'none', success: false };
  } catch (e) {
    return { action: 'error', error: e.message };
  }
}

// 4. Navigate directly to a question in the grid by number (1-indexed)
function domNavigateToQuestion(targetQNum) {
  try {
    const navItems = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]')).filter(
      el => /^\d+$/.test(el.textContent.trim())
    );
    const targetItem = navItems.find(el => parseInt(el.textContent.trim(), 10) === targetQNum);
    if (targetItem) {
      targetItem.click();
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// 5. Get total count of question buttons from grid
function domGetTotalQuestionsCount() {
  try {
    const navItems = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]')).filter(
      el => /^\d+$/.test(el.textContent.trim())
    );
    return navItems.length;
  } catch (e) {
    return 0;
  }
}

// ── Multi-Strategy Answer Parser ─────────────────────────────────────────────
function parseAnswerFromResponse(raw, options) {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!cleaned) cleaned = raw.trim();

  const finalMatch = cleaned.match(/FINAL_ANSWER\s*[:=\-]?\s*\(?([A-D])\)?/i);
  if (finalMatch) {
    return finalMatch[1].toUpperCase().charCodeAt(0) - 65;
  }

  const patterns = [
    /(?:correct\s+(?:option|choice|answer)|answer\s+is|option\s+is|choice\s+is|the\s+answer\s+is)\s*[:=\-]?\s*\(?([A-D])\)?/gi,
    /(?:therefore|hence|thus|so)\s*,?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option|choice)\s*(?:is)?\s*[:=\-]?\s*\(?([A-D])\)?/gi,
    /\*\*([A-D])\*\*/g,
    /Option\s+([A-D])\b/gi,
    /Answer\s*[:=\-]\s*\(?([A-D])\)?/gi,
    /\(([A-D])\)/g,
  ];

  for (const pattern of patterns) {
    const matches = Array.from(cleaned.matchAll(pattern));
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const letter = (last[1] || last[0]).replace(/[^A-D]/gi, '').toUpperCase();
      if (letter.length === 1) {
        return letter.charCodeAt(0) - 65;
      }
    }
  }

  if (Array.isArray(options)) {
    for (let i = 0; i < options.length; i++) {
      const opt = (options[i] || '').trim().toLowerCase();
      if (opt.length > 2) {
        const idx = cleaned.toLowerCase().lastIndexOf(opt);
        if (idx !== -1) {
          return i;
        }
      }
    }
  }

  const letterMatches = Array.from(cleaned.matchAll(/\b([A-D])\b/g));
  if (letterMatches.length > 0) {
    const last = letterMatches[letterMatches.length - 1][1].toUpperCase();
    return last.charCodeAt(0) - 65;
  }

  return null;
}

// ── LLM Gateway Call ──────────────────────────────────────────────────────────
async function askModel(questionText, options) {
  const { baseUrl, apiKey, model, maxTokens, timeoutSecs, maxRetries, fallbackAction } = session.config;
  if (!baseUrl || !model) throw new Error('Model gateway or Model ID not configured in Settings.');

  const optStr = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');
  const tokenBudget = maxTokens || 1024;
  const timeoutMs = (timeoutSecs || 60) * 1000;

  let lastErr;
  let lastRaw = '';

  for (let attempt = 0; attempt <= (maxRetries ?? 2); attempt++) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);

      const prompt = attempt === 0
        ? `Solve this multiple-choice question step by step if needed, but you MUST conclude your answer on the last line in this exact format:
FINAL_ANSWER: X
(where X is A, B, C, or D).

Question:
${questionText}

Options:
${optStr}

Answer:`
        : `Answer this multiple-choice question. Reply with ONLY the letter A, B, C, or D. No explanation.

Question:
${questionText}

Options:
${optStr}

FINAL_ANSWER:`;

      const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && apiKey !== 'ollama' ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert examination solver. Analyze carefully and always conclude with FINAL_ANSWER: [A/B/C/D].'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: tokenBudget,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
      clearTimeout(tid);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 150)}`);
      }

      const data = await resp.json();
      const raw = data?.choices?.[0]?.message?.content || '';
      lastRaw = raw;

      const answerIndex = parseAnswerFromResponse(raw, options);
      if (answerIndex !== null && answerIndex >= 0 && answerIndex < options.length) {
        return { index: answerIndex, raw };
      }

      throw new Error(`Could not parse letter answer from output: "${raw.slice(0, 80).trim()}…"`);

    } catch (e) {
      lastErr = e;
      if (e.name === 'AbortError') lastErr = new Error(`Request timed out after ${timeoutSecs}s`);
      if (attempt < (maxRetries ?? 2)) {
        await sleep(1500);
      }
    }
  }

  if (fallbackAction === 'guess_a') {
    await appendLog(`⚠️ Could not parse model answer. Falling back to Option A to prevent stall.`, 'warn');
    return { index: 0, raw: lastRaw, fallback: true };
  }

  throw lastErr;
}

// ── Full Question Extraction Engine ──────────────────────────────────────────
let extracting = false;

async function extractAllQuestions(tabId) {
  if (extracting) return { error: 'Extraction already running' };
  extracting = true;

  try {
    await appendLog('🔍 Starting full assessment question extraction…', 'req');

    // 1. Get total question count from the grid
    const countRes = await chrome.scripting.executeScript({
      target: { tabId },
      func: domGetTotalQuestionsCount,
    });

    let total = countRes?.[0]?.result || 0;
    if (total === 0) {
      // Try extracting current to see if page has a counter
      const curRes = await chrome.scripting.executeScript({
        target: { tabId },
        func: domExtractQuestion,
      });
      total = curRes?.[0]?.result?.total || 60;
    }

    await appendLog(`Found ${total} questions in the test. Extracting sequentially…`, 'info');

    const allQuestions = [];

    // Navigate to Question 1 first
    await chrome.scripting.executeScript({
      target: { tabId },
      func: domNavigateToQuestion,
      args: [1],
    });
    await sleep(400);

    for (let q = 1; q <= total; q++) {
      // Click question button in grid
      await chrome.scripting.executeScript({
        target: { tabId },
        func: domNavigateToQuestion,
        args: [q],
      });

      // Allow DOM to render
      await sleep(250);

      const qData = await chrome.scripting.executeScript({
        target: { tabId },
        func: domExtractQuestion,
      });

      const res = qData?.[0]?.result;
      if (res && res.question) {
        allQuestions.push({
          qNum: q,
          question: res.question,
          options: res.options || [],
        });
      } else {
        allQuestions.push({
          qNum: q,
          question: `[Question ${q} - Content not loaded]`,
          options: [],
        });
      }

      if (q % 5 === 0 || q === total) {
        await appendLog(`Extracted ${q}/${total} questions…`, 'info');
      }
    }

    // Re-navigate back to Question 1 so the user is at the start
    await chrome.scripting.executeScript({
      target: { tabId },
      func: domNavigateToQuestion,
      args: [1],
    }).catch(() => {});
    await sleep(350);

    // Build the clean copyable prompt
    const promptText = buildBulkPrompt(allQuestions);

    // Save to storage
    await chrome.storage.local.set({
      [EXTRACTED_QUESTIONS_KEY]: {
        total: allQuestions.length,
        extractedAt: new Date().toISOString(),
        questions: allQuestions,
        promptText,
      }
    });

    await appendLog(`✅ Extracted all ${allQuestions.length} questions successfully!`, 'ok');
    return { success: true, count: allQuestions.length, promptText, questions: allQuestions };

  } catch (e) {
    await appendLog(`✗ Extraction failed: ${e.message}`, 'err');
    return { success: false, error: e.message };
  } finally {
    extracting = false;
  }
}

function buildBulkPrompt(questions) {
  let out = `Please solve all the following multiple-choice questions accurately.
For EVERY question, provide the correct option letter (A, B, C, or D).

IMPORTANT: Provide your final answer key inside a single triple-backtick markdown code block so it can be copied cleanly in one click, strictly formatted with one question per line:

\`\`\`
1. [Letter]
2. [Letter]
3. [Letter]
...
\`\`\`

Example:
\`\`\`
1. B
2. A
3. D
\`\`\`

Here are the questions:
==================================================\n\n`;

  questions.forEach(item => {
    out += `Q${item.qNum}: ${item.question}\n`;
    item.options.forEach((opt, idx) => {
      out += `   ${String.fromCharCode(65 + idx)}) ${opt}\n`;
    });
    out += `\n`;
  });

  out += `==================================================
Conclude your response with the answer key enclosed in a code block:
\`\`\`
1. [Letter]
2. [Letter]
...
\`\`\``;

  return out;
}

// ── Background Solver Engine (Shared for Live & Batch Fill) ──────────────────
let loopRunning = false;

async function runBackgroundSolver() {
  if (loopRunning) return;
  loopRunning = true;

  try {
    while (session.active && !session.paused) {
      if (!session.tabId) {
        await appendLog('No target tab specified. Pausing.', 'warn');
        session.active = false;
        break;
      }

      // Verify tab still open
      try {
        await chrome.tabs.get(session.tabId);
      } catch (e) {
        await appendLog('Assessment tab was closed or lost. Stopping.', 'warn');
        session.active = false;
        break;
      }

      // 1. Extract active question
      let extractRes;
      try {
        extractRes = await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: domExtractQuestion,
        });
      } catch (e) {
        await appendLog(`Script injection failed: ${e.message}`, 'err');
        await sleep(2000);
        continue;
      }

      const data = extractRes?.[0]?.result;
      if (!data || !data.question) {
        await appendLog('No active question found. Checking completion…', 'info');
        await sleep(1500);
        
        const retryCheck = await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: domExtractQuestion,
        }).catch(() => null);

        if (!retryCheck?.[0]?.result?.question) {
          await appendLog('🏁 Assessment completed or submitted!', 'ok');
          notifyStatus('done', 'Done');
          session.active = false;
          break;
        }
        continue;
      }

      const { question, options, total, current } = data;
      const normalizedQ = question.replace(/\s+/g, ' ').trim().toLowerCase();

      // Guard: Ensure question transitioned
      if (session.lastQNorm && normalizedQ === session.lastQNorm) {
        await sleep(800);
        continue;
      }

      notifyProgress(current, total, question);
      await persistRuntimeState();

      let answerIdx = 0;

      // 2. Decide answer based on mode
      if (session.mode === 'batch') {
        // Look up pre-parsed answer for this question number
        if (session.batchAnswers && session.batchAnswers[current] !== undefined) {
          answerIdx = session.batchAnswers[current];
          const letter = String.fromCharCode(65 + answerIdx);
          await appendLog(`Q${current}/${total || '?'}: Using pasted answer [${letter}]…`, 'info');
        } else {
          await appendLog(`⚠️ No pasted answer found for Q${current}. Defaulting to A.`, 'warn');
          answerIdx = 0;
        }
      } else {
        // Live Model Query
        await appendLog(`Q${current}/${total || '?'}: Querying ${session.config.model}…`, 'req');
        try {
          const res = await askModel(question, options);
          answerIdx = res.index;
        } catch (e) {
          await appendLog(`✗ Q${current}: ${e.message}`, 'err');
          if (session.config.fallbackAction === 'pause') {
            session.paused = true;
            notifyStatus('paused', 'Paused on Error');
            await persistRuntimeState();
            break;
          } else {
            answerIdx = 0;
          }
        }
      }

      const letter = String.fromCharCode(65 + answerIdx);
      const chosenText = options[answerIdx] || '';

      // 3. Select the radio option in DOM
      const selectRes = await chrome.scripting.executeScript({
        target: { tabId: session.tabId },
        func: domSelectAnswer,
        args: [answerIdx],
      });

      if (!selectRes?.[0]?.result?.success) {
        await sleep(300);
        await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: domSelectAnswer,
          args: [answerIdx],
        });
      }

      await appendLog(`✅ Q${current}: ${letter}) ${chosenText}`, 'ok');
      chrome.runtime.sendMessage({
        type: 'answer',
        qnum: current,
        answer: `${letter}) ${chosenText}`,
        mode: session.mode,
      }).catch(() => {});

      // Allow React state to register
      await sleep(500);

      // 4. Click Next or Submit
      const clickRes = await chrome.scripting.executeScript({
        target: { tabId: session.tabId },
        func: domClickNext,
      });

      const navAction = clickRes?.[0]?.result?.action;
      session.lastQNorm = normalizedQ;
      session.solvedCount++;
      await persistRuntimeState();

      if (navAction === 'submit' || (total && current >= total)) {
        await appendLog('🏁 Reached final question. All answers submitted.', 'ok');
        notifyStatus('done', 'Done');
        session.active = false;
        await persistRuntimeState();
        break;
      }

      // 5. Configured delay
      const delay = Math.max(800, session.config.delayMs || 2000);
      await sleep(delay);

      // 6. Transition verification
      let transitionWait = 0;
      while (transitionWait < 4000 && session.active && !session.paused) {
        const verifyRes = await chrome.scripting.executeScript({
          target: { tabId: session.tabId },
          func: domExtractQuestion,
        }).catch(() => null);

        const vData = verifyRes?.[0]?.result;
        if (!vData || !vData.question) break;
        const vNorm = vData.question.replace(/\s+/g, ' ').trim().toLowerCase();
        if (vNorm !== session.lastQNorm) break;
        await sleep(400);
        transitionWait += 400;
      }
    }
  } finally {
    loopRunning = false;
    await persistRuntimeState();
  }
}

// ── Message Handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _src, sendResp) => {
  (async () => {
    switch (msg.action) {
      // ── Live Model Mode ──
      case 'startLive': {
        const tabId = msg.tabId || _src?.tab?.id;
        session.mode        = 'live';
        session.tabId       = tabId;
        session.active      = true;
        session.paused      = false;
        session.solvedCount = 0;
        session.lastQNorm   = '';
        notifyStatus('running', 'Solving with model…');
        await persistRuntimeState();
        await appendLog('▶ Starting Live Model solving session…', 'req');
        runBackgroundSolver();
        break;
      }

      // ── Batch Fill Mode ──
      case 'startBatchFill': {
        const tabId = msg.tabId || _src?.tab?.id;
        session.mode         = 'batch';
        session.tabId        = tabId;
        session.batchAnswers = msg.answers || {};
        session.active       = true;
        session.paused       = false;
        session.solvedCount  = 0;
        session.lastQNorm    = '';
        await chrome.storage.local.set({ [BATCH_ANSWERS_KEY]: session.batchAnswers });
        notifyStatus('running', 'Batch filling answers…');
        await persistRuntimeState();
        await appendLog(`▶ Starting Batch Auto-Fill (${Object.keys(session.batchAnswers).length} answers loaded)…`, 'req');
        
        // Navigate to Q1 first if needed
        await chrome.scripting.executeScript({
          target: { tabId },
          func: domNavigateToQuestion,
          args: [1],
        }).catch(() => {});
        await sleep(400);

        runBackgroundSolver();
        break;
      }

      // ── Extract All Questions ──
      case 'extractAll': {
        const tabId = msg.tabId || _src?.tab?.id;
        const res = await extractAllQuestions(tabId);
        sendResp(res);
        return;
      }

      case 'resume':
        session.paused = false;
        session.active = true;
        notifyStatus('running', session.mode === 'batch' ? 'Filling…' : 'Solving…');
        await persistRuntimeState();
        await appendLog('▶ Resumed.', 'info');
        runBackgroundSolver();
        break;

      case 'pause':
        session.paused = true;
        notifyStatus('paused', 'Paused');
        await persistRuntimeState();
        await appendLog('⏸ Paused.', 'warn');
        break;

      case 'stop':
        session.active = false;
        session.paused = false;
        notifyStatus('idle', 'Stopped');
        await persistRuntimeState();
        await appendLog('■ Stopped.', 'warn');
        break;

      case 'reset':
        session.active      = false;
        session.paused      = false;
        session.currentQNum = 0;
        session.totalQs     = 0;
        session.solvedCount = 0;
        session.lastQNorm   = '';
        notifyStatus('idle', 'Ready');
        await chrome.storage.local.set({ [LOGS_KEY]: [] });
        await persistRuntimeState();
        await appendLog('↺ Session reset. Ready.', 'info');
        break;

      case 'getState': {
        const storedExtract = await chrome.storage.local.get([EXTRACTED_QUESTIONS_KEY, BATCH_ANSWERS_KEY]);
        sendResp({
          session: {
            mode:        session.mode,
            active:      session.active,
            paused:      session.paused,
            currentQNum: session.currentQNum,
            totalQs:     session.totalQs,
            solvedCount: session.solvedCount,
          },
          config: session.config,
          extracted: storedExtract[EXTRACTED_QUESTIONS_KEY] || null,
          batchAnswers: storedExtract[BATCH_ANSWERS_KEY] || session.batchAnswers || {},
        });
        return;
      }

      case 'getConfig':
        sendResp({ config: session.config });
        return;

      case 'saveConfig':
        session.config = { ...session.config, ...msg.config };
        await chrome.storage.local.set({ [CONFIG_KEY]: session.config });
        // Broadcast delay update to all tabs immediately
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((t) => {
            if (t.id) chrome.tabs.sendMessage(t.id, { type: 'configUpdated', config: session.config }).catch(() => {});
          });
        });
        sendResp({ ok: true, config: session.config });
        return;
    }
    sendResp({ ok: true });
  })();
  return true;
});

// Initialize state from storage on startup
loadState().then(() => {
  if (session.active && !session.paused && session.tabId) {
    runBackgroundSolver();
  }
});