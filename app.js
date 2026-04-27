/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  FLUID SORTING SIMULATOR v3.0 — app.js                            ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  NEW FEATURES IN v3.0:                                             ║
 * ║  • Login ID — Associate identification before each session         ║
 * ║  • History — All sessions saved to localStorage, viewable in tab   ║
 * ║  • Export to Excel — Download history as .csv file                 ║
 * ║  • Sound Feedback — Beep on pick, ding on correct, buzz on wrong   ║
 * ║  • Responsive Dimensions — Viewport-relative sizing, CSS/JS synced ║
 * ║  • Error Recovery — Image preload, Arduino reconnect, tab blur     ║
 * ║  • Offline Support — Service worker caches all assets              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                   FLUID SORTING SIMULATOR                          ║
 * ║                         app.js                                     ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                    ║
 * ║  WHAT IS THIS FILE?                                                ║
 * ║  This is the "brain" of the app. It controls everything:           ║
 * ║  • Game logic (conveyor belt movement, picking, dropping)          ║
 * ║  • Score tracking (correct, wrong, missed, etc.)                   ║
 * ║  • Screen switching (menu → game → results)                        ║
 * ║  • Arduino hardware communication (optional)                      ║
 * ║  • Keyboard and touch input handling                               ║
 * ║                                                                    ║
 * ║  HOW THE GAME WORKS:                                               ║
 * ║  1. Player picks a difficulty level (controls conveyor speed)      ║
 * ║  2. 40 shipping labels scroll across a conveyor belt               ║
 * ║  3. Some labels are "relevant" (belong to Node 1-4)               ║
 * ║  4. Some labels are "irrelevant" (node = null, ignore them)       ║
 * ║  5. Player must PICK relevant labels in the pick zone             ║
 * ║  6. Then DROP them into the correct node (1, 2, 3, or 4)         ║
 * ║  7. After all labels pass, a results dashboard shows the score    ║
 * ║                                                                    ║
 * ║  CODE ORGANIZATION (scroll down to find each section):             ║
 * ║  Section 1 — DOM Element References                                ║
 * ║  Section 2 — Arduino Serial Variables                              ║
 * ║  Section 3 — Game State Variables                                  ║
 * ║  Section 4 — Constants (sizes, speeds)                             ║
 * ║  Section 5 — Game Configuration Data (images + levels)             ║
 * ║  Section 6 — Arduino Connection Functions                          ║
 * ║  Section 7 — Screen Management                                     ║
 * ║  Section 8 — Utility Functions                                     ║
 * ║  Section 9 — Conveyor Belt & Animation                             ║
 * ║  Section 10 — Pick & Drop Game Actions                             ║
 * ║  Section 11 — Game Lifecycle (start, end, results)                 ║
 * ║  Section 12 — Event Listeners (clicks, keyboard, Arduino)          ║
 * ║  Section 13 — App Initialization                                   ║
 * ║                                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
(() => {

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 1: DOM REFERENCES
   * ═══════════════════════════════════════════════════════════════ */
  const screenLogin   = document.getElementById('screen-login');
  const screenMenu    = document.getElementById('screen-menu');
  const screenGame    = document.getElementById('screen-game');
  const screenResults = document.getElementById('screen-results');
  const screenHistory = document.getElementById('screen-history');

  const loginInput       = document.getElementById('login-id-input');
  const btnLoginSubmit   = document.getElementById('btn-login-submit');
  const loginError       = document.getElementById('login-error');

  const menuUserDisplay  = document.getElementById('menu-user-display');
  const serialStatusWeb  = document.getElementById('serial-status-web');
  const btnConnectSerial = document.getElementById('btn-connect-serial');
  const conveyorTrack    = document.getElementById('conveyor-track');
  const hudLevel         = document.getElementById('hud-level');
  const hudProgress      = document.getElementById('hud-progress');
  const hudStatus        = document.getElementById('hud-status');
  const hudTimer         = document.getElementById('hud-timer');
  const btnPick          = document.getElementById('btn-pick');
  const btnRestart       = document.getElementById('btn-restart');
  const btnExportCsv     = document.getElementById('btn-export-csv');
  const historyBody      = document.getElementById('history-body');
  const btnBackFromHist  = document.getElementById('btn-back-from-history');
  const btnViewHistory   = document.getElementById('btn-view-history');
  const btnExportHistory = document.getElementById('btn-export-history');

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 2: ARDUINO SERIAL VARIABLES
   * ═══════════════════════════════════════════════════════════════ */
  let serialPort = null;
  let serialReader = null;
  let serialConnected = false;

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 3: GAME STATE
   * ═══════════════════════════════════════════════════════════════ */
  let currentUser     = '';
  let config          = null;
  let gameImages      = [];
  let level           = 1;
  let speedSec        = 10;
  let isPicked        = false;
  let pickedLabel     = null;
  let animationId     = null;
  let conveyorX       = 0;
  let lastTimestamp   = 0;
  let paused          = false;
  let gameStartTime   = 0;
  let gameEndTime     = 0;
  let results         = [];
  let spilloverChecked = new Set();


  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 4: RESPONSIVE CONSTANTS — Single Source of Truth
   *  All dimensions are calculated from viewport width (vw).
   *  CSS uses the same CSS custom properties set by JS on :root.
   * ═══════════════════════════════════════════════════════════════ */
  function getResponsiveDimensions() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Label size = 45% of viewport width, capped at 600px
    const labelW = Math.min(Math.round(vw * 0.45), 600);
    const labelH = Math.round(labelW * 1.25);
    const gap    = Math.round(labelW * 0.1);
    const total  = labelW + gap;
    const pickTolerance = Math.round(labelW * 0.55);
    // Push CSS custom properties so CSS stays in sync
    const root = document.documentElement.style;
    root.setProperty('--label-w', labelW + 'px');
    root.setProperty('--label-h', labelH + 'px');
    root.setProperty('--label-gap', gap + 'px');
    root.setProperty('--pick-zone-offset', pickTolerance + 'px');
    return { labelW, labelH, gap, total, pickTolerance };
  }
  let DIM = getResponsiveDimensions();
  window.addEventListener('resize', () => { DIM = getResponsiveDimensions(); });

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 5: SOUND FEEDBACK — Web Audio API generated tones
   *  No external sound files needed. Generates beep/ding/buzz
   *  programmatically using oscillators.
   * ═══════════════════════════════════════════════════════════════ */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  /** Short beep — played when player picks a label */
  function playBeep() {
    try {
      ensureAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;       // A5 note
      gain.gain.value = 0.3;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);  // 100ms
    } catch (e) { /* audio not available — silent fallback */ }
  }

  /** Pleasant ding — played on correct drop */
  function playDing() {
    try {
      ensureAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200;      // High pleasant tone
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);  // 300ms with fade
    } catch (e) { /* silent fallback */ }
  }

  /** Harsh buzz — played on wrong drop or false pick */
  function playBuzz() {
    try {
      ensureAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';           // Harsh waveform
      osc.frequency.value = 150;       // Low rumble
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) { /* silent fallback */ }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 6: GAME CONFIGURATION DATA
   * ═══════════════════════════════════════════════════════════════ */
  config = {
    "images": [
      { "file": "label_01.png", "node": 1 }, { "file": "label_05.png", "node": 1 },
      { "file": "label_11.png", "node": 1 }, { "file": "label_17.png", "node": 1 },
      { "file": "label_23.png", "node": 1 }, { "file": "label_29.png", "node": 1 },
      { "file": "label_39.png", "node": 1 },
      { "file": "label_02.png", "node": 2 }, { "file": "label_06.png", "node": 2 },
      { "file": "label_13.png", "node": 2 }, { "file": "label_19.png", "node": 2 },
      { "file": "label_25.png", "node": 2 }, { "file": "label_31.png", "node": 2 },
      { "file": "label_03.png", "node": 3 }, { "file": "label_08.png", "node": 3 },
      { "file": "label_14.png", "node": 3 }, { "file": "label_20.png", "node": 3 },
      { "file": "label_26.png", "node": 3 }, { "file": "label_33.png", "node": 3 },
      { "file": "label_04.png", "node": 4 }, { "file": "label_10.png", "node": 4 },
      { "file": "label_16.png", "node": 4 }, { "file": "label_21.png", "node": 4 },
      { "file": "label_28.png", "node": 4 }, { "file": "label_35.png", "node": 4 },
      { "file": "label_07.png", "node": null }, { "file": "label_09.png", "node": null },
      { "file": "label_12.png", "node": null }, { "file": "label_15.png", "node": null },
      { "file": "label_18.png", "node": null }, { "file": "label_22.png", "node": null },
      { "file": "label_24.png", "node": null }, { "file": "label_27.png", "node": null },
      { "file": "label_30.png", "node": null }, { "file": "label_32.png", "node": null },
      { "file": "label_34.png", "node": null }, { "file": "label_36.png", "node": null },
      { "file": "label_37.png", "node": null }, { "file": "label_38.png", "node": null },
      { "file": "label_40.png", "node": null }
    ],
    "levels": {
      "1": { "name": "Easy",   "speedSec": 10 },
      "2": { "name": "Medium", "speedSec": 7  },
      "3": { "name": "Hard",   "speedSec": 5  },
      "4": { "name": "Expert", "speedSec": 3  }
    }
  };


  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 7: IMAGE PRELOADING WITH ERROR RECOVERY
   *  Loads all images before the game starts. If an image fails,
   *  it retries once, then uses a colored placeholder so the
   *  game doesn't break.
   * ═══════════════════════════════════════════════════════════════ */
  function preloadImages() {
    let loaded = 0;
    const total = config.images.length;
    return new Promise((resolve) => {
      config.images.forEach(imgData => {
        const img = new Image();
        img.onload = () => { loaded++; if (loaded >= total) resolve(true); };
        img.onerror = () => {
          // Retry once
          const retry = new Image();
          retry.onload = () => { loaded++; if (loaded >= total) resolve(true); };
          retry.onerror = () => {
            console.warn('⚠️ Failed to load:', imgData.file);
            loaded++;
            if (loaded >= total) resolve(true);
          };
          retry.src = `images/${imgData.file}`;
        };
        img.src = `images/${imgData.file}`;
      });
      // Safety timeout — resolve after 10s even if some images fail
      setTimeout(() => resolve(true), 10000);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 8: ARDUINO CONNECTION (with reconnect recovery)
   * ═══════════════════════════════════════════════════════════════ */
  async function connectArduino() {
    if (!('serial' in navigator)) {
      alert('Web Serial API not supported. Use Chrome/Edge.');
      return;
    }
    try {
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      serialConnected = true;
      updateSerialStatus(true);
      startSerialReader();
    } catch (error) {
      console.error('❌ Serial connection failed:', error);
      updateSerialStatus(false, error.message);
    }
  }

  async function startSerialReader() {
    if (!serialPort || !serialPort.readable) return;
    const textDecoder = new TextDecoderStream();
    serialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();
    try {
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) break;
        value.split('\n').forEach(line => {
          const cmd = line.trim();
          if (cmd) handleArduinoCommand(cmd);
        });
      }
    } catch (error) {
      console.error('Serial read error:', error);
      // Auto-recovery: mark as disconnected so user can reconnect
      serialConnected = false;
      updateSerialStatus(false, 'Connection lost — click to reconnect');
    } finally {
      if (serialReader) serialReader.releaseLock();
    }
  }

  function handleArduinoCommand(cmd) {
    if (cmd === 'P') doPick();
    else if (['1','2','3','4'].includes(cmd)) doDrop(parseInt(cmd));
  }

  async function disconnectArduino() {
    try {
      if (serialReader) { await serialReader.cancel(); serialReader = null; }
      if (serialPort) { await serialPort.close(); serialPort = null; }
    } catch (e) { console.warn('Disconnect cleanup:', e); }
    serialConnected = false;
    updateSerialStatus(false);
  }

  function updateSerialStatus(connected, error = null) {
    if (connected) {
      serialStatusWeb.textContent = '✅ Arduino Connected';
      serialStatusWeb.className = 'status-badge connected';
      btnConnectSerial.textContent = '📴 Disconnect Arduino';
    } else {
      serialStatusWeb.textContent = error ? `❌ ${error}` : '❌ Arduino Not Connected';
      serialStatusWeb.className = 'status-badge disconnected';
      btnConnectSerial.textContent = '🔌 Connect Arduino';
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 9: SCREEN MANAGEMENT & UTILITIES
   * ═══════════════════════════════════════════════════════════════ */
  function showScreen(screen) {
    [screenLogin, screenMenu, screenGame, screenResults, screenHistory]
      .forEach(s => { if (s) s.classList.remove('active'); });
    screen.classList.add('active');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }


  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 10: CONVEYOR BELT & ANIMATION
   * ═══════════════════════════════════════════════════════════════ */
  function buildConveyor() {
    conveyorTrack.innerHTML = '';
    gameImages.forEach((img, idx) => {
      const div = document.createElement('div');
      div.className = 'conveyor-label';
      div.dataset.index = idx;
      if (img.node === null) div.classList.add('irrelevant');
      const imgEl = document.createElement('img');
      imgEl.src = `images/${img.file}`;
      imgEl.alt = img.file;
      // Error recovery: show placeholder if image fails
      imgEl.onerror = () => {
        imgEl.style.display = 'none';
        div.style.background = '#2a3a4a';
        div.innerHTML += `<span style="color:#ff9800;font-size:1.2rem;">⚠️ ${img.file}</span>`;
      };
      div.appendChild(imgEl);
      conveyorTrack.appendChild(div);
    });
  }

  function getLabelInPickZone() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const centerX = conveyorRect.left + conveyorRect.width / 2;
    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      const labelCenter = rect.left + rect.width / 2;
      if (Math.abs(labelCenter - centerX) < DIM.pickTolerance) return label;
    }
    return null;
  }

  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (!paused) {
      const pxPerSec = DIM.total / speedSec;
      conveyorX -= pxPerSec * delta;
      conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;
      updatePickZoneHighlight();
      checkSpillover();
      const totalWidth = gameImages.length * DIM.total;
      if (Math.abs(conveyorX) > totalWidth + 300) { endGame(); return; }
    }
    updateHUD();
    animationId = requestAnimationFrame(animate);
  }

  function updatePickZoneHighlight() {
    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const centerX = conveyorRect.left + conveyorRect.width / 2;
    labels.forEach(label => {
      const rect = label.getBoundingClientRect();
      const labelCenter = rect.left + rect.width / 2;
      if (Math.abs(labelCenter - centerX) < DIM.pickTolerance &&
          !label.classList.contains('picked') && !label.classList.contains('missed')) {
        label.classList.add('in-pick-zone');
      } else {
        label.classList.remove('in-pick-zone');
      }
    });
  }

  function checkSpillover() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const pickZoneRight = conveyorRect.left + conveyorRect.width / 2 + DIM.pickTolerance;
    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    labels.forEach(label => {
      const idx = parseInt(label.dataset.index);
      const img = gameImages[idx];
      const rect = label.getBoundingClientRect();
      if (rect.right < pickZoneRight - 200 && !spilloverChecked.has(idx)) {
        spilloverChecked.add(idx);
        if (img.node !== null && !label.classList.contains('picked')) {
          label.classList.add('missed');
          results.push({ file: img.file, node: img.node, action: 'spillover', droppedNode: null });
        }
        if (img.node === null && !label.classList.contains('picked')) {
          results.push({ file: img.file, node: null, action: 'ignored', droppedNode: null });
        }
      }
    });
    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 11: PICK & DROP with Sound Feedback
   * ═══════════════════════════════════════════════════════════════ */
  function doPick() {
    if (isPicked) return;
    const label = getLabelInPickZone();
    if (!label) return;
    const idx = parseInt(label.dataset.index);
    const img = gameImages[idx];
    if (spilloverChecked.has(idx)) return;

    isPicked = true;
    paused = true;
    pickedLabel = { idx, img, element: label };
    spilloverChecked.add(idx);
    label.classList.add('picked');
    label.classList.remove('in-pick-zone');
    hudStatus.textContent = '📦 PICKED — Drop to Node 1-4';
    hudStatus.className = 'status-picked';

    playBeep();  // 🔊 Sound: short beep on pick
  }

  function doDrop(node) {
    if (!isPicked || !pickedLabel) return;
    const img = pickedLabel.img;

    if (img.node === null) {
      results.push({ file: img.file, node: null, action: 'falsepick', droppedNode: node });
      flashNode(node, 'wrong');
      playBuzz();   // 🔊 Sound: buzz on false pick
    } else if (img.node === node) {
      results.push({ file: img.file, node: img.node, action: 'correct', droppedNode: node });
      flashNode(node, 'highlight');
      playDing();   // 🔊 Sound: ding on correct drop
    } else {
      results.push({ file: img.file, node: img.node, action: 'missorted', droppedNode: node });
      flashNode(node, 'wrong');
      playBuzz();   // 🔊 Sound: buzz on wrong drop
    }

    isPicked = false;
    paused = false;
    pickedLabel = null;
    lastTimestamp = 0;
    hudStatus.textContent = 'WATCHING';
    hudStatus.className = 'status-idle';
    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }

  function flashNode(node, cls) {
    const box = document.querySelector(`.node-box[data-node="${node}"]`);
    if (box) { box.classList.add(cls); setTimeout(() => box.classList.remove(cls), 800); }
  }

  function updateHUD() {
    hudTimer.textContent = `⏱ ${speedSec}s/label`;
  }


  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 12: HISTORY — localStorage persistence + Excel export
   * ═══════════════════════════════════════════════════════════════ */
  const HISTORY_KEY = 'fluid_sorting_history';

  /** Load all saved sessions from localStorage */
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) { return []; }
  }

  /** Save a new session to localStorage */
  function saveSession(session) {
    const history = loadHistory();
    history.push(session);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('⚠️ localStorage full or unavailable. Session not saved.');
    }
  }

  /** Render the history table in the History screen */
  function renderHistory() {
    const history = loadHistory();
    if (!historyBody) return;
    historyBody.innerHTML = '';
    if (history.length === 0) {
      historyBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#8899aa;">No sessions yet. Play a game first!</td></tr>';
      return;
    }
    // Show newest first
    [...history].reverse().forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.user || '—'}</td>
        <td>${s.date || '—'}</td>
        <td>${s.level || '—'}</td>
        <td>${s.correct || 0}</td>
        <td>${s.missorted || 0}</td>
        <td>${s.spillover || 0}</td>
        <td>${s.falsepick || 0}</td>
        <td>${s.accuracy || '0%'}</td>
        <td>${s.time || '0:00'}</td>
      `;
      historyBody.appendChild(tr);
    });
  }

  /** Export history as CSV file (opens as Excel) */
  function exportHistoryCSV() {
    const history = loadHistory();
    if (history.length === 0) { alert('No history to export.'); return; }

    const headers = ['Associate ID','Date','Level','Correct','Mis-Sorted','Spillover','False Picks','Accuracy','Time'];
    const rows = history.map(s => [
      s.user, s.date, s.level, s.correct, s.missorted, s.spillover, s.falsepick, s.accuracy, s.time
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(r => { csv += r.map(v => `"${v}"`).join(',') + '\n'; });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sorting_history_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 13: GAME LIFECYCLE — Login, Start, End, Results
   * ═══════════════════════════════════════════════════════════════ */

  /** Handle login — validate and proceed to menu */
  function handleLogin() {
    const id = loginInput.value.trim();
    if (!id) {
      loginError.textContent = 'Please enter your Associate ID';
      loginError.style.display = 'block';
      return;
    }
    currentUser = id;
    loginError.style.display = 'none';
    menuUserDisplay.textContent = `👤 ${currentUser}`;
    showScreen(screenMenu);
  }

  function startGame(selectedLevel) {
    level = selectedLevel;
    speedSec = config.levels[level].speedSec;
    DIM = getResponsiveDimensions();  // Recalculate for current screen size
    gameImages = shuffle(config.images);
    isPicked = false;
    pickedLabel = null;
    paused = false;
    conveyorX = window.innerWidth;
    lastTimestamp = 0;
    results = [];
    spilloverChecked = new Set();
    gameStartTime = Date.now();

    hudLevel.textContent = `Level: ${config.levels[level].name}`;
    hudProgress.textContent = `0 / ${gameImages.length}`;
    hudStatus.textContent = 'WATCHING';
    hudStatus.className = 'status-idle';

    buildConveyor();
    conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;
    showScreen(screenGame);
    setTimeout(() => { animationId = requestAnimationFrame(animate); }, 1000);
  }

  function endGame() {
    if (animationId) cancelAnimationFrame(animationId);
    gameImages.forEach((img, idx) => {
      if (!spilloverChecked.has(idx)) {
        if (img.node !== null) results.push({ file: img.file, node: img.node, action: 'spillover', droppedNode: null });
        else results.push({ file: img.file, node: null, action: 'ignored', droppedNode: null });
      }
    });
    showResults();
  }

  function showResults() {
    gameEndTime = Date.now();
    const totalTimeSec = Math.round((gameEndTime - gameStartTime) / 1000);
    const minutes = Math.floor(totalTimeSec / 60);
    const seconds = totalTimeSec % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const correct   = results.filter(r => r.action === 'correct').length;
    const missorted = results.filter(r => r.action === 'missorted').length;
    const spillover = results.filter(r => r.action === 'spillover').length;
    const falsepick = results.filter(r => r.action === 'falsepick').length;
    const ignored   = results.filter(r => r.action === 'ignored').length;
    const totalRelevant = gameImages.filter(i => i.node !== null).length;
    const accuracy = totalRelevant > 0 ? Math.round((correct / totalRelevant) * 100) : 0;
    const itemsPerMin = totalTimeSec > 0 ? Math.round((gameImages.length / totalTimeSec) * 60) : 0;

    document.getElementById('res-correct').textContent   = correct;
    document.getElementById('res-missorted').textContent  = missorted;
    document.getElementById('res-spillover').textContent  = spillover;
    document.getElementById('res-falsepick').textContent  = falsepick;
    document.getElementById('res-ignored').textContent    = ignored;
    document.getElementById('res-total-time').textContent = timeStr;
    document.getElementById('res-accuracy').textContent   = accuracy + '%';
    document.getElementById('res-speed').textContent      = itemsPerMin + ' items/min';

    const badge = document.getElementById('performance-badge');
    const badgeScore = document.getElementById('badge-score');
    if (accuracy >= 90) { badge.className = 'performance-badge excellent'; badgeScore.textContent = 'Excellent'; }
    else if (accuracy >= 75) { badge.className = 'performance-badge good'; badgeScore.textContent = 'Good'; }
    else if (accuracy >= 50) { badge.className = 'performance-badge average'; badgeScore.textContent = 'Average'; }
    else { badge.className = 'performance-badge poor'; badgeScore.textContent = 'Needs Improvement'; }

    // Save session to history
    saveSession({
      user: currentUser,
      date: new Date().toLocaleString(),
      level: config.levels[level].name,
      correct, missorted, spillover, falsepick,
      accuracy: accuracy + '%',
      time: timeStr
    });

    showScreen(screenResults);
  }


  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 14: EVENT LISTENERS
   * ═══════════════════════════════════════════════════════════════ */

  // Login
  btnLoginSubmit.addEventListener('click', handleLogin);
  loginInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

  // Arduino
  btnConnectSerial.addEventListener('click', () => {
    serialConnected ? disconnectArduino() : connectArduino();
  });

  // Level selection
  document.querySelectorAll('.btn-level[data-level]').forEach(btn => {
    btn.addEventListener('click', () => startGame(parseInt(btn.dataset.level)));
  });

  // Results screen buttons
  btnRestart.addEventListener('click', () => showScreen(screenMenu));
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportHistoryCSV);

  // History screen
  if (btnViewHistory) btnViewHistory.addEventListener('click', () => { renderHistory(); showScreen(screenHistory); });
  if (btnBackFromHist) btnBackFromHist.addEventListener('click', () => showScreen(screenMenu));
  if (btnExportHistory) btnExportHistory.addEventListener('click', exportHistoryCSV);

  // Game controls
  btnPick.addEventListener('click', () => doPick());
  document.querySelectorAll('.drop-btn').forEach(btn => {
    btn.addEventListener('click', () => doDrop(parseInt(btn.dataset.node)));
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); doPick(); }
    else if (['Digit1','Digit2','Digit3','Digit4'].includes(e.code)) {
      doDrop(parseInt(e.code.replace('Digit', '')));
    }
  });

  // Tab blur/focus — auto-pause when user switches away
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animationId && !isPicked) {
      paused = true;
    } else if (!document.hidden && paused && !isPicked) {
      paused = false;
      lastTimestamp = 0;  // Reset timing to prevent jump
    }
  });

  /* ═══════════════════════════════════════════════════════════════
   *  SECTION 15: INITIALIZATION
   * ═══════════════════════════════════════════════════════════════ */
  preloadImages().then(() => {
    console.log('🎮 Fluid Sorting Simulator v3.0 — ready');
    updateSerialStatus(false);
    // Check if user was previously logged in (session persistence)
    const lastUser = sessionStorage.getItem('fss_current_user');
    if (lastUser) {
      currentUser = lastUser;
      menuUserDisplay.textContent = `👤 ${currentUser}`;
      showScreen(screenMenu);
    } else {
      showScreen(screenLogin);
    }
  });

  // Persist current user across page refreshes within the same tab
  window.addEventListener('beforeunload', () => {
    if (currentUser) sessionStorage.setItem('fss_current_user', currentUser);
  });

})();
