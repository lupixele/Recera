// ─── AutoAssess · options.js ──────────────────────────────────────────────────

const CONFIG_KEY = 'autoassess_config';
const DEFAULTS = {
  baseUrl:        'http://localhost:11434/v1',
  apiKey:         'ollama',
  model:          'nvidia/nvidia/nemotron-3-super-120b-a12b',
  maxTokens:      1024,
  delayMs:        2000,
  maxRetries:     2,
  timeoutSecs:    60,
  fallbackAction: 'guess_a',
};

// Presets using exact Model IDs
const PRESETS = {
  nemotron: {
    baseUrl:   'http://localhost:20128/v1',
    apiKey:    'hermes',
    model:     'nvidia/nvidia/nemotron-3-super-120b-a12b',
    maxTokens: 1024,
  },
  ollama: {
    baseUrl:   'http://localhost:11434/v1',
    apiKey:    'ollama',
    model:     'llama3.2',
    maxTokens: 512,
  },
  lmstudio: {
    baseUrl:   'http://localhost:1234/v1',
    apiKey:    'lm-studio',
    model:     'local-model',
    maxTokens: 512,
  },
  openai: {
    baseUrl:   'https://api.openai.com/v1',
    apiKey:    '',
    model:     'gpt-4o-mini',
    maxTokens: 512,
  },
  groq: {
    baseUrl:   'https://api.groq.com/openai/v1',
    apiKey:    '',
    model:     'llama-3.1-8b-instant',
    maxTokens: 512,
  },
};

const $ = id => document.getElementById(id);

// ── Load & populate ───────────────────────────────────────────────────────────
async function load() {
  const stored = await new Promise(r => chrome.storage.local.get([CONFIG_KEY], r));
  const cfg    = { ...DEFAULTS, ...(stored[CONFIG_KEY] || {}) };
  $('baseUrl').value        = cfg.baseUrl;
  $('apiKey').value         = cfg.apiKey;
  $('model').value          = cfg.model;
  $('maxTokens').value      = cfg.maxTokens || 1024;
  $('timeout').value        = cfg.timeoutSecs || 60;
  $('maxRetries').value     = cfg.maxRetries ?? 2;
  $('delayMs').value        = cfg.delayMs || 2000;
  $('delayVal').textContent = (cfg.delayMs || 2000) + ' ms';
  $('fallbackAction').value = cfg.fallbackAction || 'guess_a';
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function save() {
  const cfg = {
    baseUrl:        $('baseUrl').value.trim(),
    apiKey:         $('apiKey').value.trim(),
    model:          $('model').value.trim(),
    maxTokens:      parseInt($('maxTokens').value, 10) || 1024,
    timeoutSecs:    parseInt($('timeout').value, 10) || 60,
    maxRetries:     parseInt($('maxRetries').value, 10) || 2,
    delayMs:        parseInt($('delayMs').value, 10) || 2000,
    fallbackAction: $('fallbackAction').value,
  };
  await new Promise(r => chrome.storage.local.set({ [CONFIG_KEY]: cfg }, r));
  showToast();
}

// ── Test connection ───────────────────────────────────────────────────────────
async function testConnection() {
  const baseUrl   = $('baseUrl').value.trim();
  const apiKey    = $('apiKey').value.trim();
  const model     = $('model').value.trim();
  const maxTokens = parseInt($('maxTokens').value, 10) || 512;
  const resEl     = $('testResult');

  if (!baseUrl || !model) {
    resEl.className = 'test-result err';
    resEl.textContent = '⚠ Fill in Base URL and Model ID first.';
    return;
  }

  resEl.className = 'test-result';
  resEl.style.display = 'block';
  resEl.textContent = '⏳ Testing connection with model…';
  resEl.style.background = '#1e293b';
  resEl.style.color = '#94a3b8';
  resEl.style.border = '1px solid #334155';

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 20000);

    const testPrompt = `Solve: What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\n\nReturn your answer formatted as FINAL_ANSWER: X (where X is A, B, C, or D).`;

    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && apiKey !== 'ollama' ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: maxTokens,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    const data = await resp.json().catch(() => ({}));
    const raw = data?.choices?.[0]?.message?.content || '';

    if (resp.ok && raw) {
      resEl.className = 'test-result ok';
      resEl.textContent = `✅ Connected! Model output: "${raw.slice(0, 120).trim()}…"`;
    } else {
      resEl.className = 'test-result err';
      resEl.textContent = `⚠ HTTP ${resp.status} — ${JSON.stringify(data).slice(0, 120)}`;
    }
  } catch (e) {
    resEl.className = 'test-result err';
    resEl.textContent = `✗ Connection failed: ${e.message}`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showToast() {
  const t = $('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Event bindings ────────────────────────────────────────────────────────────
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    if (!preset) return;
    if (preset.baseUrl)   $('baseUrl').value   = preset.baseUrl;
    if (preset.apiKey !== undefined) $('apiKey').value = preset.apiKey;
    if (preset.model)     $('model').value     = preset.model;
    if (preset.maxTokens) $('maxTokens').value = preset.maxTokens;
  });
});

$('delayMs').addEventListener('input', e => {
  $('delayVal').textContent = e.target.value + ' ms';
});

$('btnSave').addEventListener('click', save);
$('btnTest').addEventListener('click', testConnection);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    save();
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────
load();