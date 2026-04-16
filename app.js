(() => {
  // ─── Socket ───
  const socket = io();

  // ─── DOM ───
  const screenMenu    = document.getElementById('screen-menu');
  const screenGame    = document.getElementById('screen-game');
  const screenResults = document.getElementById('screen-results');
  const serialStatus  = document.getElementById('serial-status');
  const conveyorTrack = document.getElementById('conveyor-track');
  const hudLevel      = document.getElementById('hud-level');
  const hudProgress   = document.getElementById('hud-progress');
  const hudStatus     = document.getElementById('hud-status');
  const hudTimer      = document.getElementById('hud-timer');
  const btnPick       = document.getElementById('btn-pick');
  const btnRestart    = document.getElementById('btn-restart');

  // ─── State ───
  let config = null;
  let gameImages = [];       // shuffled array of image objects
  let currentIndex = 0;
  let level = 1;
  let speedSec = 10;
  let isPicked = false;
  let pickedLabel = null;    // the image object currently picked
  let animationId = null;
  let conveyorX = 0;
  let lastTimestamp = 0;
  let paused = false;
  let gameStartTime = 0;     // Track game start time
  let gameEndTime = 0;       // Track game end time

  // Results tracking
  let results = [];  // { file, node, action: 'correct'|'missorted'|'spillover'|'falsepick'|'ignored' }

  // Constants
  const LABEL_WIDTH = 600;
  const LABEL_GAP = 60;
  const LABEL_TOTAL = LABEL_WIDTH + LABEL_GAP;

  // ─── Load Config ───
  async function loadConfig() {
    const res = await fetch('/api/config');
    config = await res.json();
  }

  // ─── Screen Management ───
  function showScreen(screen) {
    [screenMenu, screenGame, screenResults].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // ─── Shuffle ───
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Build Conveyor ───
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
      div.appendChild(imgEl);

      conveyorTrack.appendChild(div);
    });
  }

  // ─── Get label in pick zone ───
  function getLabelInPickZone() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const centerX = conveyorRect.left + conveyorRect.width / 2;
    const tolerance = 600; // half of pick zone width

    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      const labelCenter = rect.left + rect.width / 2;
      if (Math.abs(labelCenter - centerX) < tolerance) {
        return label;
      }
    }
    return null;
  }

  // ─── Animation Loop ───
  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000; // seconds
    lastTimestamp = timestamp;

    if (!paused) {
      // pixels per second: one full label slot per speedSec
      const pxPerSec = LABEL_TOTAL / speedSec;
      conveyorX -= pxPerSec * delta;
      conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;

      // Check which label is in pick zone
      updatePickZoneHighlight();

      // Check if a relevant label has passed the pick zone without being picked
      checkSpillover();

      // Check if all labels have scrolled through
      const totalWidth = gameImages.length * LABEL_TOTAL;
      if (Math.abs(conveyorX) > totalWidth + 750) {
        endGame();
        return;
      }
    }

    // Update HUD
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
      if (Math.abs(labelCenter - centerX) < 600 && !label.classList.contains('picked') && !label.classList.contains('missed')) {
        label.classList.add('in-pick-zone');
      } else {
        label.classList.remove('in-pick-zone');
      }
    });
  }

  // Track which labels have been checked for spillover
  let spilloverChecked = new Set();

  function checkSpillover() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const pickZoneRight = conveyorRect.left + conveyorRect.width / 2 + 130;

    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    labels.forEach(label => {
      const idx = parseInt(label.dataset.index);
      const img = gameImages[idx];
      const rect = label.getBoundingClientRect();

      // Label has fully passed the pick zone
      if (rect.right < pickZoneRight - 200 && !spilloverChecked.has(idx)) {
        spilloverChecked.add(idx);

        // If it's a relevant label and wasn't picked → spillover
        if (img.node !== null && !label.classList.contains('picked')) {
          label.classList.add('missed');
          results.push({
            file: img.file,
            node: img.node,
            action: 'spillover',
            droppedNode: null
          });
        }
        // If irrelevant and not picked → correctly ignored
        if (img.node === null && !label.classList.contains('picked')) {
          results.push({
            file: img.file,
            node: null,
            action: 'ignored',
            droppedNode: null
          });
        }
      }
    });

    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }

  // ─── PICK Action ───
  function doPick() {
    if (isPicked) return; // already holding something

    const label = getLabelInPickZone();
    if (!label) return;

    const idx = parseInt(label.dataset.index);
    const img = gameImages[idx];

    // If already processed, skip
    if (spilloverChecked.has(idx)) return;

    isPicked = true;
    paused = true;
    pickedLabel = { idx, img, element: label };
    spilloverChecked.add(idx);

    label.classList.add('picked');
    label.classList.remove('in-pick-zone');

    hudStatus.textContent = '📦 PICKED — Drop to Node 1-4';
    hudStatus.className = 'status-picked';
  }

  // ─── DROP Action ───
  function doDrop(node) {
    if (!isPicked || !pickedLabel) return;

    const img = pickedLabel.img;
    const element = pickedLabel.element;

    // Determine result
    if (img.node === null) {
      // Picked an irrelevant shipment — false pick
      results.push({
        file: img.file,
        node: null,
        action: 'falsepick',
        droppedNode: node
      });
      flashNode(node, 'wrong');
    } else if (img.node === node) {
      // Correct!
      results.push({
        file: img.file,
        node: img.node,
        action: 'correct',
        droppedNode: node
      });
      flashNode(node, 'highlight');
    } else {
      // Mis-sorted
      results.push({
        file: img.file,
        node: img.node,
        action: 'missorted',
        droppedNode: node
      });
      flashNode(node, 'wrong');
    }

    // Reset state
    isPicked = false;
    paused = false;
    pickedLabel = null;
    lastTimestamp = 0; // reset delta to avoid jump

    hudStatus.textContent = 'WATCHING';
    hudStatus.className = 'status-idle';
    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }

  function flashNode(node, cls) {
    const box = document.querySelector(`.node-box[data-node="${node}"]`);
    if (box) {
      box.classList.add(cls);
      setTimeout(() => box.classList.remove(cls), 800);
    }
  }

  // ─── HUD ───
  function updateHUD() {
    hudTimer.textContent = `⏱ ${speedSec}s/label`;
  }

  // ─── End Game ───
  function endGame() {
    if (animationId) cancelAnimationFrame(animationId);

    // Any remaining unprocessed labels
    gameImages.forEach((img, idx) => {
      if (!spilloverChecked.has(idx)) {
        if (img.node !== null) {
          results.push({ file: img.file, node: img.node, action: 'spillover', droppedNode: null });
        } else {
          results.push({ file: img.file, node: null, action: 'ignored', droppedNode: null });
        }
      }
    });

    showResults();
  }

  // ─── Results Dashboard ───
  function showResults() {
    gameEndTime = Date.now();
    const totalTimeMs = gameEndTime - gameStartTime;
    const totalTimeSec = Math.round(totalTimeMs / 1000);
    const minutes = Math.floor(totalTimeSec / 60);
    const seconds = totalTimeSec % 60;

    const correct = results.filter(r => r.action === 'correct').length;
    const missorted = results.filter(r => r.action === 'missorted').length;
    const spillover = results.filter(r => r.action === 'spillover').length;
    const falsepick = results.filter(r => r.action === 'falsepick').length;
    const ignored = results.filter(r => r.action === 'ignored').length;
    const totalRelevant = gameImages.filter(i => i.node !== null).length;

    // Update stat numbers
    document.getElementById('res-correct').textContent = correct;
    document.getElementById('res-missorted').textContent = missorted;
    document.getElementById('res-spillover').textContent = spillover;
    document.getElementById('res-falsepick').textContent = falsepick;
    document.getElementById('res-ignored').textContent = ignored;

    // Calculate metrics
    const accuracy = totalRelevant > 0 ? Math.round((correct / totalRelevant) * 100) : 0;
    const itemsPerMin = totalTimeSec > 0 ? Math.round((gameImages.length / totalTimeSec) * 60) : 0;

    document.getElementById('res-total-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('res-accuracy').textContent = accuracy + '%';
    document.getElementById('res-speed').textContent = itemsPerMin + ' items/min';

    // Performance rating
    const badge = document.getElementById('performance-badge');
    const badgeScore = document.getElementById('badge-score');
    
    if (accuracy >= 90) {
      badge.className = 'performance-badge excellent';
      badgeScore.textContent = 'Excellent';
    } else if (accuracy >= 75) {
      badge.className = 'performance-badge good';
      badgeScore.textContent = 'Good';
    } else if (accuracy >= 50) {
      badge.className = 'performance-badge average';
      badgeScore.textContent = 'Average';
    } else {
      badge.className = 'performance-badge poor';
      badgeScore.textContent = 'Needs Improvement';
    }

    showScreen(screenResults);
  }

  // ─── Start Game ───
  function startGame(selectedLevel) {
    level = selectedLevel;
    speedSec = config.levels[level].speedSec;

    // Reset
    gameImages = shuffle(config.images);
    currentIndex = 0;
    isPicked = false;
    pickedLabel = null;
    paused = false;
    conveyorX = window.innerWidth; // start off-screen right
    lastTimestamp = 0;
    results = [];
    spilloverChecked = new Set();
    gameStartTime = Date.now(); // Track start time

    hudLevel.textContent = `Level: ${config.levels[level].name}`;
    hudProgress.textContent = `0 / ${gameImages.length}`;
    hudStatus.textContent = 'WATCHING';
    hudStatus.className = 'status-idle';

    buildConveyor();
    conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;

    showScreen(screenGame);

    // Start animation after short delay
    setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, 1000);
  }

  // ─── Event Listeners ───

  // Level buttons
  document.querySelectorAll('.btn-level[data-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      startGame(parseInt(btn.dataset.level));
    });
  });

  // Restart
  btnRestart.addEventListener('click', () => {
    showScreen(screenMenu);
  });

  // On-screen pick button
  btnPick.addEventListener('click', () => doPick());

  // On-screen drop buttons
  document.querySelectorAll('.drop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      doDrop(parseInt(btn.dataset.node));
    });
  });

  // Keyboard fallback
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      socket.emit('keyPress', { action: 'pick' });
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
      const node = parseInt(e.code.replace('Digit', ''));
      socket.emit('keyPress', { action: 'drop', node });
    }
  });

  // Socket events from Arduino (via server)
  socket.on('button', (data) => {
    if (data.action === 'pick') {
      doPick();
    } else if (data.action === 'drop') {
      doDrop(data.node);
    }
  });

  socket.on('serialStatus', (data) => {
    if (data.connected) {
      serialStatus.textContent = '✅ Arduino Connected';
      serialStatus.className = 'status-badge connected';
    } else {
      serialStatus.textContent = '⚠️ Arduino Not Found (Keyboard Mode)';
      serialStatus.className = 'status-badge disconnected';
    }
  });

  // ─── Init ───
  loadConfig().then(() => {
    console.log('Config loaded:', config);
  });

})();
