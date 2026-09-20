// ─── Recera Precision Assessment Engine · Slide-Out Dock ───────────────
// Runs on: *://*.adityauniversity.in/* and *://*.technicalhub.io/*

(function () {
  'use strict';

  if (window.__RECERA_INITIALIZED__) return;
  window.__RECERA_INITIALIZED__ = true;

  console.log('[Recera] Mounting precision slide-out dock.');

  // ── 1. Neutralize Anti-Cheat / Blur / Visibility Detectors ──────────────────
  try {
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('focusout', (e) => e.stopImmediatePropagation(), true);
    document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
  } catch (e) {}

  // ── 2. Intercept Accidental Form Submissions (Prevents Page Reloads) ─────────
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ── 3. Embedded Slide-Out Drawer CSS ─────────────────────────────────────────
  const INLINE_CSS = `
    :host {
      all: initial;
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      color: #f1f5f9;
      letter-spacing: -0.01em;
      -webkit-font-smoothing: antialiased;
      pointer-events: none;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Edge Pull Tab (Always Visible on the Right Margin) */
    #recera-tab {
      pointer-events: auto;
      position: fixed;
      top: 45%;
      right: 0;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(16px) saturate(190%);
      -webkit-backdrop-filter: blur(16px) saturate(190%);
      color: #f8fafc;
      padding: 11px 11px 11px 13px;
      border-top-left-radius: 12px;
      border-bottom-left-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-right: none;
      box-shadow: -4px 10px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      cursor: pointer;
      user-select: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }

    #recera-tab:hover {
      padding-right: 14px;
      background: rgba(30, 41, 59, 0.98);
      border-color: rgba(56, 189, 248, 0.45);
      box-shadow: -6px 14px 36px rgba(0, 0, 0, 0.6);
    }

    .tab-indicator {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #0284c7;
      box-shadow: 0 0 8px rgba(2, 132, 199, 0.7);
      flex-shrink: 0;
      margin-bottom: 4px;
    }

    .tab-indicator.running {
      background: #10b981;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.9);
      animation: recera-tab-pulse 1.6s cubic-bezier(0.24, 0, 0.38, 1) infinite;
    }

    @keyframes recera-tab-pulse {
      0% { transform: scale(0.9); opacity: 0.9; }
      50% { transform: scale(1.4); opacity: 0.4; }
      100% { transform: scale(0.9); opacity: 0.9; }
    }

    .tab-text {
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Dimmed Backdrop (Click to Dismiss Drawer) */
    #recera-backdrop {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      opacity: 0;
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }

    #recera-backdrop.active {
      display: block;
      opacity: 1;
      pointer-events: auto;
    }

    /* Slide-Out Drawer Panel */
    #recera-drawer {
      pointer-events: auto;
      position: fixed;
      top: 0;
      right: -420px;
      width: 400px;
      height: 100vh;
      background: rgba(11, 17, 32, 0.96);
      backdrop-filter: blur(28px) saturate(200%);
      -webkit-backdrop-filter: blur(28px) saturate(200%);
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: -15px 0 50px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      transition: right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483647;
      overflow: hidden;
    }

    #recera-drawer.open {
      right: 0;
    }

    /* Drawer Header */
    .drawer-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-logo {
      width: 22px;
      height: 22px;
    }

    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #f8fafc;
    }

    .brand-badge {
      font-size: 10px;
      font-weight: 600;
      background: rgba(2, 132, 199, 0.2);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 7px;
      border-radius: 4px;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      transition: all 0.15s ease;
    }

    .btn-close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
    }

    /* Navigation Tabs */
    .nav-tabs {
      display: flex;
      background: rgba(0, 0, 0, 0.25);
      padding: 5px 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      gap: 5px;
    }

    .tab-btn {
      flex: 1;
      padding: 9px 12px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 8px;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.18s ease;
      user-select: none;
    }

    .tab-btn:hover {
      color: #f8fafc;
      background: rgba(255, 255, 255, 0.04);
    }

    .tab-btn.active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    /* Content Area */
    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }

    .tab-view {
      display: none;
    }

    .tab-view.active {
      display: block;
    }

    /* Status Pill */
    .status-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 11px 14px;
      margin-bottom: 14px;
    }

    .dot-status {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #64748b;
      flex-shrink: 0;
      transition: background 0.3s;
    }
    .dot-status.idle    { background: #64748b; }
    .dot-status.running { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.7); }
    .dot-status.paused  { background: #f59e0b; }
    .dot-status.done    { background: #38bdf8; }

    .text-status {
      font-size: 13px;
      font-weight: 500;
      color: #e2e8f0;
    }

    .counter-display {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      color: #94a3b8;
    }

    .counter-display strong {
      color: #f8fafc;
      font-weight: 600;
    }

    /* Action Buttons */
    .action-grid {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }

    /* Inline Timing Setting */
    .speed-setting {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 8px;
      padding: 9px 12px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .speed-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }

    .speed-val {
      font-weight: 700;
      color: #38bdf8;
      font-variant-numeric: tabular-nums;
    }

    .speed-slider {
      width: 100%;
      height: 4px;
      accent-color: #38bdf8;
      background: #1e293b;
      border-radius: 2px;
      cursor: pointer;
      outline: none;
    }

    .action-btn {
      flex: 1;
      padding: 10px 0;
      border: 1px solid transparent;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.15s ease;
      user-select: none;
    }

    .action-btn:active { transform: scale(0.97); }
    .action-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    .btn-primary-solve {
      background: linear-gradient(180deg, #10b981 0%, #059669 100%);
      color: #022c22;
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    .btn-primary-solve:hover:not(:disabled) { filter: brightness(1.08); }

    .btn-pause-action { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
    .btn-stop-action  { background: rgba(244, 63, 94, 0.15); color: #fb7185; border-color: rgba(244, 63, 94, 0.3); }
    .btn-reset-action { background: rgba(255, 255, 255, 0.05); color: #cbd5e1; border-color: rgba(255, 255, 255, 0.08); }
    .btn-cyan         { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }
    .btn-cyan:hover   { background: rgba(56, 189, 248, 0.25); }

    .terminal-window {
      height: 220px;
      overflow-y: auto;
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 11px;
      line-height: 1.55;
      scrollbar-width: thin;
      scrollbar-color: #334155 transparent;
    }

    .line-log { display: flex; gap: 8px; margin-bottom: 3px; }
    .line-ts   { color: #475569; flex-shrink: 0; }
    .line-info { color: #94a3b8; }
    .line-ok   { color: #34d399; }
    .line-warn { color: #fbbf24; }
    .line-err  { color: #f87171; }
    .line-req  { color: #38bdf8; }

    /* Flow Section */
    .flow-section {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
    }

    .section-badge.ready {
      color: #34d399;
      border-color: rgba(52, 211, 153, 0.35);
      background: rgba(16, 185, 129, 0.1);
    }

    .input-code {
      width: 100%;
      height: 94px;
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 7px;
      color: #f8fafc;
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 11px;
      padding: 8px 10px;
      resize: vertical;
      outline: none;
    }
    .input-code:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.3);
    }

    .chips-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-height: 80px;
      overflow-y: auto;
      background: #020617;
      padding: 6px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin-top: 8px;
    }

    .chip-answer {
      font-size: 10px;
      background: rgba(255, 255, 255, 0.06);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
    }
    .chip-answer strong { color: #38bdf8; }

    /* Footer */
    .drawer-footer {
      background: rgba(0, 0, 0, 0.3);
      padding: 12px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }

    .footer-link {
      color: #38bdf8;
      text-decoration: none;
      cursor: pointer;
      font-weight: 500;
    }
    .footer-link:hover { text-decoration: underline; }

    .footer-caption {
      color: #64748b;
      font-size: 11px;
    }
  `;

  // ── 4. Inject Host & Elements ───────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'recera-root';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = INLINE_CSS;
  shadow.appendChild(styleEl);

  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Edge Pull Tab -->
    <div id="recera-tab" title="Open Recera Sidebar">
      <div class="tab-indicator" id="tabIndicator"></div>
      <span class="tab-text">RECERA</span>
    </div>

    <!-- Backdrop -->
    <div id="recera-backdrop"></div>

    <!-- Slide-Out Drawer -->
    <div id="recera-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="brand-group">
          <svg class="brand-logo" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="16" rx="3.5" fill="#0284c7"/>
            <path d="M3.8 12.5V3.5h4.4c1.8 0 3 1.1 3 2.7 0 1.3-.8 2.2-2 2.5l2.4 3.8h-2.1L7.4 8.9H5.6v3.6H3.8zm1.8-5.1h2.5c.8 0 1.3-.5 1.3-1.2s-.5-1.2-1.3-1.2H5.6v2.4z" fill="#f8fafc"/>
            <circle cx="12.5" cy="3.5" r="1.2" fill="#38bdf8"/>
          </svg>
          <span class="brand-title">Recera</span>
          <span class="brand-badge">v2.1</span>
        </div>
        <button class="btn-close" id="btnCloseDrawer" title="Close sidebar">✕</button>
      </div>

      <!-- Segmented Tabs -->
      <div class="nav-tabs">
        <button class="tab-btn active" id="tabLive">⚡ Live AI Solver</button>
        <button class="tab-btn" id="tabBatch">📋 Batch Prompt & Fill</button>
      </div>

      <!-- Scrollable Drawer Content -->
      <div class="drawer-content">

        <!-- Universal Speed & Timing Controller -->
        <div class="speed-setting">
          <div class="speed-header">
            <span>⏱️ Solving Speed / Delay</span>
            <span class="speed-val" id="speedDisplay">2.0s (2000ms)</span>
          </div>
          <input type="range" class="speed-slider" id="speedSlider" min="200" max="8000" step="100" value="2000">
        </div>

        <!-- Tab 1: Live AI Solver -->
        <div class="tab-view active" id="viewLive">
          <div class="status-pill">
            <div class="dot-status" id="liveDot"></div>
            <span class="text-status" id="liveText">Engine Ready</span>
            <div class="counter-display">
              Q <strong id="liveCurrent">0</strong> / <strong id="liveTotal">0</strong>
            </div>
          </div>

          <div class="action-grid">
            <button class="action-btn btn-primary-solve" id="btnLiveStart">▶ Start</button>
            <button class="action-btn btn-pause-action"   id="btnLivePause" disabled>⏸ Pause</button>
            <button class="action-btn btn-stop-action"    id="btnLiveStop"  disabled>■ Stop</button>
            <button class="action-btn btn-reset-action"   id="btnLiveReset" title="Reset Session">↺</button>
          </div>

          <div class="terminal-window" id="liveLogs"></div>
        </div>

        <!-- Tab 2: Batch Prompt & Fill -->
        <div class="tab-view" id="viewBatch">
          <div class="flow-section">
            <div class="section-head">
              <span class="section-title">1. Export Questions</span>
              <span class="section-badge" id="batchExportBadge">0 extracted</span>
            </div>
            <div class="action-grid" style="margin-bottom:0;">
              <button class="action-btn btn-cyan" id="btnBatchExtract">📥 Extract All</button>
              <button class="action-btn btn-reset-action" id="btnBatchCopy" disabled>📋 Copy Prompt</button>
            </div>
          </div>

          <div class="flow-section">
            <div class="section-head">
              <span class="section-title">2. Paste Answers</span>
              <span class="section-badge" id="batchAnswersBadge">0 loaded</span>
            </div>
            <textarea class="input-code" id="batchInput" placeholder="Paste model output (e.g. 1. A, 2. B, Q1: C, or JSON)..."></textarea>
            <button class="action-btn btn-reset-action" id="btnBatchParse" style="margin-top:8px; width:100%;">🔍 Parse Answers</button>
            <div class="chips-wrapper" id="batchChips" style="display:none;"></div>
          </div>

          <div class="flow-section" style="margin-bottom:0;">
            <div class="section-head">
              <span class="section-title">3. Auto-Fill Answers</span>
              <span class="section-badge" id="batchFillBadge">Idle</span>
            </div>
            <div class="action-grid" style="margin-bottom:0;">
              <button class="action-btn btn-primary-solve" id="btnBatchStart" disabled>▶ Start Fill</button>
              <button class="action-btn btn-pause-action"   id="btnBatchPause" disabled>⏸ Pause</button>
              <button class="action-btn btn-stop-action"    id="btnBatchStop"  disabled>■ Stop</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Drawer Footer -->
      <div class="drawer-footer">
        <a class="footer-link" id="btnSettings">⚙ Settings</a>
        <span class="footer-caption" id="footerModel">Model: Ready</span>
      </div>
    </div>
  `;

  shadow.appendChild(container);

  // Prevent input key events inside the sidebar from bubbling to host page
  container.addEventListener('keydown', (e) => e.stopPropagation());
  container.addEventListener('keyup', (e) => e.stopPropagation());
  container.addEventListener('keypress', (e) => e.stopPropagation());

  // ── Element Bindings ────────────────────────────────────────────────────────
  const edgeTab        = shadow.getElementById('recera-tab');
  const tabIndicator   = shadow.getElementById('tabIndicator');
  const backdrop       = shadow.getElementById('recera-backdrop');
  const drawer         = shadow.getElementById('recera-drawer');
  const btnCloseDrawer = shadow.getElementById('btnCloseDrawer');

  const tabLive        = shadow.getElementById('tabLive');
  const tabBatch       = shadow.getElementById('tabBatch');
  const viewLive       = shadow.getElementById('viewLive');
  const viewBatch      = shadow.getElementById('viewBatch');

  const liveDot        = shadow.getElementById('liveDot');
  const liveText       = shadow.getElementById('liveText');
  const liveCurrent    = shadow.getElementById('liveCurrent');
  const liveTotal      = shadow.getElementById('liveTotal');
  const btnLiveStart   = shadow.getElementById('btnLiveStart');
  const btnLivePause   = shadow.getElementById('btnLivePause');
  const btnLiveStop    = shadow.getElementById('btnLiveStop');
  const btnLiveReset   = shadow.getElementById('btnLiveReset');
  const liveLogs       = shadow.getElementById('liveLogs');

  const batchExportBadge = shadow.getElementById('batchExportBadge');
  const btnBatchExtract  = shadow.getElementById('btnBatchExtract');
  const btnBatchCopy     = shadow.getElementById('btnBatchCopy');
  const batchAnswersBadge= shadow.getElementById('batchAnswersBadge');
  const batchInput       = shadow.getElementById('batchInput');
  const btnBatchParse    = shadow.getElementById('btnBatchParse');
  const batchChips       = shadow.getElementById('batchChips');
  const batchFillBadge   = shadow.getElementById('batchFillBadge');
  const btnBatchStart    = shadow.getElementById('btnBatchStart');
  const btnBatchPause    = shadow.getElementById('btnBatchPause');
  const btnBatchStop     = shadow.getElementById('btnBatchStop');

  const btnSettings    = shadow.getElementById('btnSettings');
  const footerModel    = shadow.getElementById('footerModel');

  const speedSlider    = shadow.getElementById('speedSlider');
  const speedDisplay   = shadow.getElementById('speedDisplay');
  let currentDelayMs   = 2000;

  speedSlider.addEventListener('input', (e) => {
    currentDelayMs = parseInt(e.target.value, 10);
    speedDisplay.textContent = `${(currentDelayMs / 1000).toFixed(1)}s (${currentDelayMs}ms)`;
    chrome.storage.local.get(['autoassess_config'], (data) => {
      const cfg = data.autoassess_config || {};
      cfg.delayMs = currentDelayMs;
      chrome.storage.local.set({ autoassess_config: cfg });
    });
    chrome.runtime.sendMessage({ action: 'saveConfig', config: { delayMs: currentDelayMs } }).catch(() => {});
  });

  let extractedPromptText = '';
  let inPageBatchAnswers  = {};
  let isBatchFilling      = false;
  let isBatchPaused       = false;

  // ── Sidebar Opening / Closing Mechanics ────────────────────────────────────
  function openSidebar() {
    drawer.classList.add('open');
    backdrop.classList.add('active');
  }

  function closeSidebar() {
    drawer.classList.remove('open');
    backdrop.classList.remove('active');
  }

  edgeTab.addEventListener('click', openSidebar);
  btnCloseDrawer.addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  tabLive.addEventListener('click', () => {
    tabLive.classList.add('active');
    tabBatch.classList.remove('active');
    viewLive.classList.add('active');
    viewBatch.classList.remove('active');
  });

  tabBatch.addEventListener('click', () => {
    tabBatch.classList.add('active');
    tabLive.classList.remove('active');
    viewBatch.classList.add('active');
    viewLive.classList.remove('active');
  });

  // ── In-Page Helper Primitives ──────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function addLog(ts, msg, type = 'info') {
    const div = document.createElement('div');
    div.className = 'line-log';
    div.innerHTML = `<span class="line-ts">${ts}</span><span class="line-${type}">${escapeHtml(msg)}</span>`;
    liveLogs.appendChild(div);
    liveLogs.scrollTop = liveLogs.scrollHeight;
  }

  function extractCurrentQuestion() {
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

    if (!questionText) return null;

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
      const m = el.textContent.trim().match(/Question\s+(\d+)\s+of\s+(\d+)/i);
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
      total: total || navItems.length || 0,
    };
  }

  function selectRadio(optionIdx) {
    const label = document.querySelector('label[for^="question"], label.col-form-label, label.form-label');
    const questionName = label ? (label.htmlFor || label.getAttribute('for')) : '';

    let radios = [];
    if (questionName) {
      radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${questionName}"]`));
    }
    if (radios.length === 0) {
      radios = Array.from(document.querySelectorAll('input.form-check-input[type="radio"]'));
    }

    if (radios.length === 0 || optionIdx < 0 || optionIdx >= radios.length) {
      return false;
    }

    const radio = radios[optionIdx];
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    if (descriptor && descriptor.set) {
      descriptor.set.call(radio, true);
    } else {
      radio.checked = true;
    }

    radio.dispatchEvent(new Event('input', { bubbles: true }));
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    radio.click();

    return radio.checked;
  }

  function clickNext() {
    const card = document.querySelector('.card-body:has(input[type="radio"])') || document.querySelector('.card-body') || document;
    const buttons = Array.from(card.querySelectorAll('button[type="button"], button'));
    
    const nextBtn = buttons.find(b => {
      const txt = b.textContent.trim().toLowerCase();
      return (txt === 'next' || txt.includes('next')) && !b.disabled && !b.classList.contains('submit-button');
    });

    if (nextBtn) {
      nextBtn.setAttribute('type', 'button');
      nextBtn.click();
      return 'next';
    }

    const submitBtn = buttons.find(b => {
      const txt = b.textContent.trim().toLowerCase();
      return (txt === 'submit' || txt === 'finish' || txt.includes('complete')) && !b.disabled && !b.classList.contains('submit-button');
    });

    if (submitBtn) {
      submitBtn.setAttribute('type', 'button');
      submitBtn.click();
      return 'submit';
    }

    return null;
  }

  function navigateToQuestion(qNum) {
    const navItems = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]')).filter(
      el => /^\d+$/.test(el.textContent.trim())
    );
    const target = navItems.find(el => parseInt(el.textContent.trim(), 10) === qNum);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  function getGridTotal() {
    const navItems = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]')).filter(
      el => /^\d+$/.test(el.textContent.trim())
    );
    return navItems.length;
  }

  // ── Batch Export Handler ───────────────────────────────────────────────────
  btnBatchExtract.addEventListener('click', async () => {
    btnBatchExtract.disabled = true;
    btnBatchExtract.textContent = '⏳ Extracting…';
    batchExportBadge.textContent = 'Extracting…';

    try {
      const total = getGridTotal() || 60;
      const collected = [];

      navigateToQuestion(1);
      await sleep(350);

      for (let q = 1; q <= total; q++) {
        navigateToQuestion(q);
        await sleep(250);

        const data = extractCurrentQuestion();
        if (data && data.question) {
          collected.push({ qNum: q, question: data.question, options: data.options });
        } else {
          collected.push({ qNum: q, question: `[Question ${q}]`, options: [] });
        }

        if (q % 5 === 0 || q === total) {
          batchExportBadge.textContent = `${q}/${total} Qs`;
        }
      }

      // Re-navigate directly back to Question 1 so solver starts at the beginning
      navigateToQuestion(1);
      await sleep(350);

      let prompt = `Please solve all the following multiple-choice questions accurately.
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

      collected.forEach(item => {
        prompt += `Q${item.qNum}: ${item.question}\n`;
        item.options.forEach((opt, idx) => {
          prompt += `   ${String.fromCharCode(65 + idx)}) ${opt}\n`;
        });
        prompt += `\n`;
      });

      prompt += `==================================================
Conclude your response with the answer key enclosed in a code block:
\`\`\`
1. [Letter]
2. [Letter]
...
\`\`\``;

      extractedPromptText = prompt;
      batchExportBadge.textContent = `✓ ${collected.length} Qs`;
      batchExportBadge.className = 'section-badge ready';
      btnBatchCopy.disabled = false;
      btnBatchExtract.textContent = '✓ Extracted';

      chrome.storage.local.set({
        autoassess_extracted_questions: {
          total: collected.length,
          questions: collected,
          promptText: prompt
        }
      });

    } catch (e) {
      alert('Extraction failed: ' + e.message);
      btnBatchExtract.textContent = '📥 Extract All';
      btnBatchExtract.disabled = false;
    }
  });

  btnBatchCopy.addEventListener('click', () => {
    if (!extractedPromptText) return;
    navigator.clipboard.writeText(extractedPromptText).then(() => {
      const old = btnBatchCopy.textContent;
      btnBatchCopy.textContent = '✓ Copied!';
      setTimeout(() => btnBatchCopy.textContent = old, 1800);
    });
  });

  // ── Batch Parse Answers ─────────────────────────────────────────────────────
  function parseAnswersText(text) {
    const map = {};
    if (!text) return map;

    try {
      const m = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed)) {
          parsed.forEach((item, idx) => {
            const letter = (item.answer || item.choice || item.letter || item || '').toString().trim().toUpperCase();
            const lm = letter.match(/([A-D])/);
            if (lm) map[idx + 1] = lm[1].charCodeAt(0) - 65;
          });
          if (Object.keys(map).length > 0) return map;
        } else if (typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            const qNum = parseInt(k.replace(/\D/g, ''), 10);
            const lm = String(v).toUpperCase().match(/([A-D])/);
            if (qNum && lm) map[qNum] = lm[1].charCodeAt(0) - 65;
          }
          if (Object.keys(map).length > 0) return map;
        }
      }
    } catch (e) {}

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^(?:Q|Question)?\s*(\d+)[\.\:\)\-\s]+.*?([A-D])\b/i);
      if (m) {
        const qNum = parseInt(m[1], 10);
        const letter = m[2].toUpperCase();
        map[qNum] = letter.charCodeAt(0) - 65;
      }
    }

    if (Object.keys(map).length === 0) {
      const letters = text.match(/\b([A-D])\b/gi);
      if (letters && letters.length >= 2) {
        letters.forEach((lettr, idx) => {
          map[idx + 1] = lettr.toUpperCase().charCodeAt(0) - 65;
        });
      }
    }

    return map;
  }

  btnBatchParse.addEventListener('click', () => {
    const val = batchInput.value.trim();
    if (!val) {
      alert('Paste model output first.');
      return;
    }

    inPageBatchAnswers = parseAnswersText(val);
    const count = Object.keys(inPageBatchAnswers).length;
    if (count === 0) {
      alert('Could not parse answers. Format as 1. A, 2. B or Q1: C.');
      return;
    }

    batchAnswersBadge.textContent = `✓ ${count} loaded`;
    batchAnswersBadge.className = 'section-badge ready';
    btnBatchStart.disabled = false;

    batchChips.innerHTML = '';
    batchChips.style.display = 'flex';
    const sorted = Object.keys(inPageBatchAnswers).map(Number).sort((a, b) => a - b);
    sorted.forEach(k => {
      const chip = document.createElement('span');
      chip.className = 'chip-answer';
      chip.innerHTML = `Q${k}: <strong>${String.fromCharCode(65 + inPageBatchAnswers[k])}</strong>`;
      batchChips.appendChild(chip);
    });

    chrome.storage.local.set({ autoassess_batch_answers: inPageBatchAnswers });
  });

  // ── In-Page Auto-Fill Execution Loop ────────────────────────────────────────
  async function runDirectBatchFill() {
    isBatchFilling = true;
    isBatchPaused  = false;

    // Reset view to Question 1 before starting fill loop
    navigateToQuestion(1);
    await sleep(400);

    btnBatchStart.disabled = true;
    btnBatchPause.disabled = false;
    btnBatchStop.disabled  = false;
    batchFillBadge.textContent = 'FILLING';
    batchFillBadge.className = 'section-badge ready';
    tabIndicator.className = 'tab-indicator running';

    try {
      const total = Object.keys(inPageBatchAnswers).length || getGridTotal() || 60;
      let lastQuestionText = '';

      for (let step = 1; step <= 120; step++) {
        if (!isBatchFilling) break;

        while (isBatchPaused && isBatchFilling) {
          await sleep(400);
        }

        const data = extractCurrentQuestion();
        if (!data || !data.question) {
          break;
        }

        const currentNum = data.current;
        const normalized = data.question.replace(/\s+/g, ' ').trim().toLowerCase();

        if (lastQuestionText && normalized === lastQuestionText) {
          await sleep(600);
          continue;
        }

        batchFillBadge.textContent = `Q ${currentNum}/${total}`;

        const targetIdx = inPageBatchAnswers[currentNum] !== undefined
          ? inPageBatchAnswers[currentNum]
          : (inPageBatchAnswers[String(currentNum)] !== undefined ? inPageBatchAnswers[String(currentNum)] : 0);

        selectRadio(targetIdx);
        await sleep(350);
        selectRadio(targetIdx);
        await sleep(450);

        const action = clickNext();
        lastQuestionText = normalized;

        if (action === 'submit' || (total && currentNum >= total)) {
          batchFillBadge.textContent = 'COMPLETED';
          break;
        }

        let waited = 0;
        while (waited < 3500 && isBatchFilling) {
          await sleep(350);
          waited += 350;
          const nextData = extractCurrentQuestion();
          if (nextData && nextData.question) {
            const nextNorm = nextData.question.replace(/\s+/g, ' ').trim().toLowerCase();
            if (nextNorm !== lastQuestionText) break;
          }
        }

        // Apply dynamically updated delay instantly
        await sleep(currentDelayMs);
      }

    } finally {
      isBatchFilling = false;
      btnBatchStart.disabled = false;
      btnBatchPause.disabled = true;
      btnBatchStop.disabled  = true;
      tabIndicator.className = 'tab-indicator';
    }
  }

  btnBatchStart.addEventListener('click', () => {
    let count = Object.keys(inPageBatchAnswers).length;
    if (count === 0) {
      const raw = batchInput.value.trim();
      if (raw) {
        inPageBatchAnswers = parseAnswersText(raw);
        count = Object.keys(inPageBatchAnswers).length;
      }
    }

    if (count === 0) {
      alert('Please paste answers in the box first.');
      return;
    }

    runDirectBatchFill();
  });

  btnBatchPause.addEventListener('click', () => {
    isBatchPaused = !isBatchPaused;
    btnBatchPause.textContent = isBatchPaused ? '▶ Resume' : '⏸ Pause';
    batchFillBadge.textContent = isBatchPaused ? 'PAUSED' : 'FILLING';
  });

  btnBatchStop.addEventListener('click', () => {
    isBatchFilling = false;
    isBatchPaused  = false;
    batchFillBadge.textContent = 'STOPPED';
    btnBatchStart.disabled = false;
    btnBatchPause.disabled = true;
    btnBatchStop.disabled  = true;
  });

  // ── Live AI Solver Bridge ───────────────────────────────────────────────────
  btnLiveStart.addEventListener('click', () => {
    liveDot.className = 'dot-status running';
    liveText.textContent = 'Solving with model…';
    tabIndicator.className = 'tab-indicator running';
    btnLiveStart.disabled = true;
    btnLivePause.disabled = false;
    btnLiveStop.disabled  = false;
    chrome.runtime.sendMessage({ action: 'startLive' });
  });

  btnLivePause.addEventListener('click', () => {
    liveDot.className = 'dot-status paused';
    liveText.textContent = 'Paused';
    chrome.runtime.sendMessage({ action: 'pause' });
  });

  btnLiveStop.addEventListener('click', () => {
    liveDot.className = 'dot-status idle';
    liveText.textContent = 'Stopped';
    tabIndicator.className = 'tab-indicator';
    btnLiveStart.disabled = false;
    btnLivePause.disabled = true;
    btnLiveStop.disabled  = true;
    chrome.runtime.sendMessage({ action: 'stop' });
  });

  btnLiveReset.addEventListener('click', () => {
    liveLogs.innerHTML = '';
    liveCurrent.textContent = '0';
    liveTotal.textContent = '0';
    liveDot.className = 'dot-status idle';
    liveText.textContent = 'Engine Ready';
    chrome.runtime.sendMessage({ action: 'reset' });
  });

  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Background Broadcast Updates ────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'progress') {
      liveCurrent.textContent = msg.current;
      liveTotal.textContent = msg.total;
    } else if (msg.type === 'log') {
      addLog(msg.ts || new Date().toLocaleTimeString('en-GB'), msg.msg, msg.level || 'info');
    } else if (msg.type === 'status') {
      liveDot.className = 'dot-status ' + msg.phase;
      liveText.textContent = msg.text || msg.phase;
      if (msg.phase === 'running') tabIndicator.className = 'tab-indicator running';
      else tabIndicator.className = 'tab-indicator';
    } else if (msg.type === 'configUpdated') {
      if (msg.config && msg.config.delayMs) {
        currentDelayMs = msg.config.delayMs;
        speedSlider.value = currentDelayMs;
        speedDisplay.textContent = `${(currentDelayMs / 1000).toFixed(1)}s (${currentDelayMs}ms)`;
      }
    } else if (msg.type === 'done') {
      liveDot.className = 'dot-status done';
      liveText.textContent = 'Completed';
      tabIndicator.className = 'tab-indicator';
    }
  });

  // ── Hydration on Page Load ──────────────────────────────────────────────────
  chrome.storage.local.get(['autoassess_config', 'autoassess_extracted_questions', 'autoassess_batch_answers'], (data) => {
    if (data.autoassess_config) {
      if (data.autoassess_config.model) {
        footerModel.textContent = `Model: ${data.autoassess_config.model.split('/').pop()}`;
      }
      if (data.autoassess_config.delayMs) {
        currentDelayMs = data.autoassess_config.delayMs;
        speedSlider.value = currentDelayMs;
        speedDisplay.textContent = `${(currentDelayMs / 1000).toFixed(1)}s (${currentDelayMs}ms)`;
      }
    }
    if (data.autoassess_extracted_questions && data.autoassess_extracted_questions.promptText) {
      extractedPromptText = data.autoassess_extracted_questions.promptText;
      batchExportBadge.textContent = `✓ ${data.autoassess_extracted_questions.total} Qs`;
      batchExportBadge.className = 'section-badge ready';
      btnBatchCopy.disabled = false;
    }
    if (data.autoassess_batch_answers && Object.keys(data.autoassess_batch_answers).length > 0) {
      inPageBatchAnswers = data.autoassess_batch_answers;
      const count = Object.keys(inPageBatchAnswers).length;
      batchAnswersBadge.textContent = `✓ ${count} loaded`;
      batchAnswersBadge.className = 'section-badge ready';
      btnBatchStart.disabled = false;

      batchChips.innerHTML = '';
      batchChips.style.display = 'flex';
      const sorted = Object.keys(inPageBatchAnswers).map(Number).sort((a, b) => a - b);
      sorted.forEach(k => {
        const chip = document.createElement('span');
        chip.className = 'chip-answer';
        chip.innerHTML = `Q${k}: <strong>${String.fromCharCode(65 + inPageBatchAnswers[k])}</strong>`;
        batchChips.appendChild(chip);
      });
    }
  });

})();