(() => {
  // ─── DOM Elements ───
  const screenMenu = document.getElementById('screen-menu');
  const screenGame = document.getElementById('screen-game');
  const screenResults = document.getElementById('screen-results');
  const serialStatusWeb = document.getElementById('serial-status-web');
  const btnConnectSerial = document.getElementById('btn-connect-serial');
  const conveyorTrack = document.getElementById('conveyor-track');
  const hudLevel = document.getElementById('hud-level');
  const hudProgress = document.getElementById('hud-progress');
  const hudStatus = document.getElementById('hud-status');
  const hudTimer = document.getElementById('hud-timer');
  const btnPick = document.getElementById('btn-pick');
  const btnRestart = document.getElementById('btn-restart');

  // ─── Web Serial API Variables ───
  let serialPort = null;
  let serialReader = null;
  let serialConnected = false;

  // ─── Game State ───
  let config = null;
  let gameImages = [];
  let currentIndex = 0;
  let level = 1;
  let speedSec = 10;
  let isPicked = false;
  let pickedLabel = null;
  let animationId = null;
  let conveyorX = 0;
  let lastTimestamp = 0;
  let paused = false;
  let gameStartTime = 0;
  let gameEndTime = 0;
  let results = [];
  let spilloverChecked = new Set();

  // ─── History Management ───
  let gameHistory = [];

  // ─── Constants ───
  const LABEL_WIDTH = 200;
  const LABEL_GAP = 60;
  const LABEL_TOTAL = LABEL_WIDTH + LABEL_GAP;
  const PICK_ZONE_TOLERANCE = 130;

  // ─── Embedded Config (No Server Needed) ───
  config = {
    "images": [
      { "file": "label_01.png", "node": 1 },
      { "file": "label_02.png", "node": 2 },
      { "file": "label_03.png", "node": 3 },
      { "file": "label_04.png", "node": 4 },
      { "file": "label_05.png", "node": 1 },
      { "file": "label_06.png", "node": 2 },
      { "file": "label_07.png", "node": null },
      { "file": "label_08.png", "node": 3 },
      { "file": "label_09.png", "node": null },
      { "file": "label_10.png", "node": 4 },
      { "file": "label_11.png", "node": 1 },
      { "file": "label_12.png", "node": null },
      { "file": "label_13.png", "node": 2 },
      { "file": "label_14.png", "node": 3 },
      { "file": "label_15.png", "node": null },
      { "file": "label_16.png", "node": 4 },
      { "file": "label_17.png", "node": 1 },
      { "file": "label_18.png", "node": null },
      { "file": "label_19.png", "node": 2 },
      { "file": "label_20.png", "node": 3 },
      { "file": "label_21.png", "node": 4 },
      { "file": "label_22.png", "node": null },
      { "file": "label_23.png", "node": 1 },
      { "file": "label_24.png", "node": null },
      { "file": "label_25.png", "node": 2 },
      { "file": "label_26.png", "node": 3 },
      { "file": "label_27.png", "node": null },
      { "file": "label_28.png", "node": 4 },
      { "file": "label_29.png", "node": 1 },
      { "file": "label_30.png", "node": null },
      { "file": "label_31.png", "node": 2 },
      { "file": "label_32.png", "node": null },
      { "file": "label_33.png", "node": 3 },
      { "file": "label_34.png", "node": null },
      { "file": "label_35.png", "node": 4 },
      { "file": "label_36.png", "node": null },
      { "file": "label_37.png", "node": null },
      { "file": "label_38.png", "node": null },
      { "file": "label_39.png", "node": 1 },
      { "file": "label_40.png", "node": null }
    ],
    "levels": {
      "1": { "name": "Easy", "speedSec": 10 },
      "2": { "name": "Medium", "speedSec": 7 },
      "3": { "name": "Hard", "speedSec": 5 },
      "4": { "name": "Expert", "speedSec": 3 }
    }
  };

  // ─── History Functions ───
  function loadHistory() {
    const saved = localStorage.getItem('fluidSortingHistory');
    if (saved) {
      try {
        gameHistory = JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to load history:', e);
        gameHistory = [];
      }
    }
    updateHistoryDisplay();
  }

  function saveHistory() {
    try {
      localStorage.setItem('fluidSortingHistory', JSON.stringify(gameHistory));
    } catch (e) {
      console.warn('Failed to save history:', e);
    }
  }

  function addToHistory(gameResult) {
    const historyEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      level: level,
      levelName: config.levels[level].name,
      speedSec: speedSec,
      totalTime: gameResult.totalTime,
      accuracy: gameResult.accuracy,
      correct: gameResult.correct,
      missorted: gameResult.missorted,
      spillover: gameResult.spillover,
      falsepick: gameResult.falsepick,
      ignored: gameResult.ignored,
      totalRelevant: gameResult.totalRelevant,
      performance: gameResult.performance
    };
    
    gameHistory.unshift(historyEntry); // Add to beginning
    
    // Keep only last 50 games
    if (gameHistory.length > 50) {
      gameHistory = gameHistory.slice(0, 50);
    }
    
    saveHistory();
    updateHistoryDisplay();
  }

  function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    const totalGames = document.getElementById('total-games');
    const bestAccuracy = document.getElementById('best-accuracy');
    const avgAccuracy = document.getElementById('avg-accuracy');
    
    if (!historyList || !totalGames || !bestAccuracy || !avgAccuracy) {
      return; // Elements not found, probably not on history tab
    }
    
    if (gameHistory.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <p>🎯 No games played yet</p>
          <p>Play your first game to see results here!</p>
        </div>
      `;
      totalGames.textContent = '0';
      bestAccuracy.textContent = '0%';
      avgAccuracy.textContent = '0%';
      return;
    }
    
    // Calculate stats
    const accuracies = gameHistory.map(g => g.accuracy);
    const best = Math.max(...accuracies);
    const average = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
    
    totalGames.textContent = gameHistory.length;
    bestAccuracy.textContent = best + '%';
    avgAccuracy.textContent = average + '%';
    
    // Generate history list
    historyList.innerHTML = gameHistory.map(game => {
      const date = new Date(game.date);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const minutes = Math.floor(game.totalTime / 60);
      const seconds = game.totalTime % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      let scoreClass = 'poor';
      if (game.accuracy >= 90) scoreClass = 'excellent';
      else if (game.accuracy >= 75) scoreClass = 'good';
      else if (game.accuracy >= 50) scoreClass = 'average';
      
      return `
        <div class="history-item">
          <div class="history-header">
            <span class="history-date">${dateStr}</span>
            <span class="history-level">${game.levelName}</span>
            <span class="history-score ${scoreClass}">${game.accuracy}%</span>
          </div>
          <div class="history-details">
            <span>✅ ${game.correct}</span>
            <span>❌ ${game.missorted}</span>
            <span>⚠️ ${game.spillover}</span>
            <span>⏱ ${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function clearHistory() {
    if (confirm('Are you sure you want to clear all game history?')) {
      gameHistory = [];
      localStorage.removeItem('fluidSortingHistory');
      updateHistoryDisplay();
    }
  }

  function exportHistory() {
    if (gameHistory.length === 0) {
      alert('No history to export!');
      return;
    }
    
    const csv = [
      'Date,Level,Accuracy,Correct,Missorted,Spillover,FalsePick,Time',
      ...gameHistory.map(g => {
        const date = new Date(g.date).toISOString().split('T')[0];
        return `${date},${g.levelName},${g.accuracy}%,${g.correct},${g.missorted},${g.spillover},${g.falsepick},${g.totalTime}s`;
      })
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fluid-sorting-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Web Serial API Functions ───
  async function connectArduino() {
    if (!('serial' in navigator)) {
      showError('Web Serial API not supported. Use Chrome/Edge browser with HTTPS or localhost.');
      return;
    }

    try {
      // Request serial port
      serialPort = await navigator.serial.requestPort();
      
      // Open the port
      await serialPort.open({ 
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      console.log('✅ Arduino connected via Web Serial API');
      serialConnected = true;
      updateSerialStatus(true);

      // Start reading data
      startSerialReader();

    } catch (error) {
      console.error('❌ Serial connection failed:', error);
      updateSerialStatus(false, error.message);
      showError('Failed to connect to Arduino: ' + error.message);
    }
  }

  async function startSerialReader() {
    if (!serialPort || !serialPort.readable) return;

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) break;

        // Process Arduino data
        const lines = value.split('\n');
        lines.forEach(line => {
          const cmd = line.trim();
          if (cmd) {
            console.log('🔘 Arduino:', cmd);
            handleArduinoCommand(cmd);
          }
        });
      }
    } catch (error) {
      console.error('Serial read error:', error);
    } finally {
      if (serialReader) {
        serialReader.releaseLock();
      }
    }
  }

  function handleArduinoCommand(cmd) {
    if (cmd === 'P') {
      doPick();
    } else if (['1', '2', '3', '4'].includes(cmd)) {
      doDrop(parseInt(cmd));
    } else if (cmd === 'READY') {
      console.log('🤖 Arduino ready');
    }
  }

  async function disconnectArduino() {
    try {
      if (serialReader) {
        await serialReader.cancel();
        serialReader = null;
      }
      
      if (serialPort) {
        await serialPort.close();
        serialPort = null;
      }
      
      serialConnected = false;
      updateSerialStatus(false);
      console.log('📴 Arduino disconnected');
    } catch (error) {
      console.error('Error disconnecting Arduino:', error);
    }
  }

  function updateSerialStatus(connected, error = null) {
    if (connected) {
      serialStatusWeb.textContent = '✅ Arduino Connected';
      serialStatusWeb.className = 'status-badge connected';
      btnConnectSerial.textContent = '📴 Disconnect Arduino';
    } else {
      serialStatusWeb.textContent = error ? `❌ Error: ${error}` : '❌ Arduino Not Connected';
      serialStatusWeb.className = 'status-badge disconnected';
      btnConnectSerial.textContent = '🔌 Connect Arduino';
    }
  }

  // ─── Error Handling ───
  function showError(message) {
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    
    if (errorModal && errorMessage) {
      errorMessage.textContent = message;
      errorModal.style.display = 'flex';
    } else {
      alert(message);
    }
  }

  function hideError() {
    const errorModal = document.getElementById('error-modal');
    if (errorModal) {
      errorModal.style.display = 'none';
    }
  }

  // ─── Screen Management ───
  function showScreen(screen) {
    [screenMenu, screenGame, screenResults].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // ─── Utility Functions ───
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Game Functions ───
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
      imgEl.onerror = function() {
        // Fallback for missing images
        this.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:100%;height:100%;background:#333;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;text-align:center;';
        placeholder.textContent = img.file;
        div.appendChild(placeholder);
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
      if (Math.abs(labelCenter - centerX) < PICK_ZONE_TOLERANCE) {
        return label;
      }
    }
    return null;
  }

  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (!paused) {
      const pxPerSec = LABEL_TOTAL / speedSec;
      conveyorX -= pxPerSec * delta;
      conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;

      updatePickZoneHighlight();
      checkSpillover();

      const totalWidth = gameImages.length * LABEL_TOTAL;
      if (Math.abs(conveyorX) > totalWidth + 300) {
        endGame();
        return;
      }
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
      if (Math.abs(labelCenter - centerX) < PICK_ZONE_TOLERANCE && 
          !label.classList.contains('picked') && 
          !label.classList.contains('missed')) {
        label.classList.add('in-pick-zone');
      } else {
        label.classList.remove('in-pick-zone');
      }
    });
  }

  function checkSpillover() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const pickZoneRight = conveyorRect.left + conveyorRect.width / 2 + PICK_ZONE_TOLERANCE;

    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    labels.forEach(label => {
      const idx = parseInt(label.dataset.index);
      const img = gameImages[idx];
      const rect = label.getBoundingClientRect();

      if (rect.right < pickZoneRight - 200 && !spilloverChecked.has(idx)) {
        spilloverChecked.add(idx);

        if (img.node !== null && !label.classList.contains('picked')) {
          label.classList.add('missed');
          results.push({
            file: img.file,
            node: img.node,
            action: 'spillover',
            droppedNode: null
          });
        }
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
  }

  function doDrop(node) {
    if (!isPicked || !pickedLabel) return;

    const img = pickedLabel.img;

    if (img.node === null) {
      results.push({
        file: img.file,
        node: null,
        action: 'falsepick',
        droppedNode: node
      });
      flashNode(node, 'wrong');
    } else if (img.node === node) {
      results.push({
        file: img.file,
        node: img.node,
        action: 'correct',
        droppedNode: node
      });
      flashNode(node, 'highlight');
    } else {
      results.push({
        file: img.file,
        node: img.node,
        action: 'missorted',
        droppedNode: node
      });
      flashNode(node, 'wrong');
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
    if (box) {
      box.classList.add(cls);
      setTimeout(() => box.classList.remove(cls), 800);
    }
  }

  function updateHUD() {
    hudTimer.textContent = `⏱ ${speedSec}s/label`;
    
    // Update Arduino status in HUD
    const hudArduinoStatus = document.getElementById('hud-arduino-status');
    if (hudArduinoStatus) {
      hudArduinoStatus.textContent = serialConnected ? '🔌 ✅' : '🔌 ❌';
    }
  }

  function endGame() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

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

    document.getElementById('res-correct').textContent = correct;
    document.getElementById('res-missorted').textContent = missorted;
    document.getElementById('res-spillover').textContent = spillover;
    document.getElementById('res-falsepick').textContent = falsepick;
    document.getElementById('res-ignored').textContent = ignored;

    const accuracy = totalRelevant > 0 ? Math.round((correct / totalRelevant) * 100) : 0;
    const itemsPerMin = totalTimeSec > 0 ? Math.round((gameImages.length / totalTimeSec) * 60) : 0;
    const efficiency = Math.round(((correct + ignored) / gameImages.length) * 100);

    document.getElementById('res-total-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('res-accuracy').textContent = accuracy + '%';
    document.getElementById('res-speed').textContent = itemsPerMin + ' items/min';
    
    const efficiencyEl = document.getElementById('res-efficiency');
    if (efficiencyEl) {
      efficiencyEl.textContent = efficiency + '%';
    }

    // Performance rating
    const badge = document.getElementById('performance-badge');
    const badgeScore = document.getElementById('badge-score');
    const badgeDescription = document.getElementById('badge-description');
    
    let performance = 'poor';
    let description = 'Keep practicing to improve!';
    
    if (accuracy >= 90) {
      performance = 'excellent';
      description = 'Outstanding sorting performance!';
      badge.className = 'performance-badge excellent';
      badgeScore.textContent = 'Excellent';
    } else if (accuracy >= 75) {
      performance = 'good';
      description = 'Good job! Room for improvement.';
      badge.className = 'performance-badge good';
      badgeScore.textContent = 'Good';
    } else if (accuracy >= 50) {
      performance = 'average';
      description = 'Average performance. Practice more!';
      badge.className = 'performance-badge average';
      badgeScore.textContent = 'Average';
    } else {
      performance = 'poor';
      description = 'Needs improvement. Keep trying!';
      badge.className = 'performance-badge poor';
      badgeScore.textContent = 'Needs Improvement';
    }
    
    if (badgeDescription) {
      badgeDescription.textContent = description;
    }

    // Update breakdown details
    const breakdownElements = {
      'breakdown-total': gameImages.length,
      'breakdown-relevant': totalRelevant,
      'breakdown-irrelevant': gameImages.length - totalRelevant,
      'breakdown-actions': correct + missorted + falsepick
    };

    Object.entries(breakdownElements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    // Create game result object for history
    const gameResult = {
      totalTime: totalTimeSec,
      accuracy: accuracy,
      correct: correct,
      missorted: missorted,
      spillover: spillover,
      falsepick: falsepick,
      ignored: ignored,
      totalRelevant: totalRelevant,
      performance: performance
    };
    
    // Add to history
    addToHistory(gameResult);

    showScreen(screenResults);
  }

  function startGame(selectedLevel) {
    level = selectedLevel;
    speedSec = config.levels[level].speedSec;

    gameImages = shuffle(config.images);
    currentIndex = 0;
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

    setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, 1000);
  }

  // ─── Tab Management ───
  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`tab-content-${tabName}`).classList.add('active');
    
    if (tabName === 'history') {
      updateHistoryDisplay();
    }
  }

  // ─── Event Listeners ───
  
  // Serial connection
  btnConnectSerial.addEventListener('click', () => {
    if (serialConnected) {
      disconnectArduino();
    } else {
      connectArduino();
    }
  });

  // Tab management
  const tabPlay = document.getElementById('tab-play');
  const tabHistory = document.getElementById('tab-history');
  
  if (tabPlay) {
    tabPlay.addEventListener('click', () => switchTab('play'));
  }
  
  if (tabHistory) {
    tabHistory.addEventListener('click', () => switchTab('history'));
  }

  // Level selection
  document.querySelectorAll('.btn-level[data-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      startGame(parseInt(btn.dataset.level));
    });
  });

  // Game controls
  btnRestart.addEventListener('click', () => {
    showScreen(screenMenu);
    switchTab('play');
  });

  const btnViewHistory = document.getElementById('btn-view-history');
  if (btnViewHistory) {
    btnViewHistory.addEventListener('click', () => {
      showScreen(screenMenu);
      switchTab('history');
    });
  }

  btnPick.addEventListener('click', () => doPick());

  document.querySelectorAll('.drop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      doDrop(parseInt(btn.dataset.node));
    });
  });

  // History actions
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnExportHistory = document.getElementById('btn-export-history');
  
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', clearHistory);
  }
  
  if (btnExportHistory) {
    btnExportHistory.addEventListener('click', exportHistory);
  }

  // Results actions
  const btnPrintResults = document.getElementById('btn-print-results');
  const btnShareResults = document.getElementById('btn-share-results');
  
  if (btnPrintResults) {
    btnPrintResults.addEventListener('click', () => {
      window.print();
    });
  }
    if (btnShareResults) {
    btnShareResults.addEventListener('click', () => {
      const accuracy = document.getElementById('res-accuracy').textContent;
      const levelName = config.levels[level] ? config.levels[level].name : 'Unknown';
      const text = `I just completed the Fluid Sorting Simulator on ${levelName} level with ${accuracy} accuracy! 🏭📦`;
      
      if (navigator.share) {
        navigator.share({
          title: 'Fluid Sorting Simulator Results',
          text: text,
          url: window.location.href
        }).catch(err => console.log('Error sharing:', err));
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
          alert('Results copied to clipboard!');
        }).catch(() => {
          alert('Share text: ' + text);
        });
      }
    });
  }

  // Modal management
  const errorModal = document.getElementById('error-modal');
  const aboutModal = document.getElementById('about-modal');
  const modalCloses = document.querySelectorAll('.modal-close');
  const btnAbout = document.getElementById('btn-about');
  const btnRetryConnection = document.getElementById('btn-retry-connection');
  const btnContinueKeyboard = document.getElementById('btn-continue-keyboard');

  if (btnAbout) {
    btnAbout.addEventListener('click', () => {
      if (aboutModal) {
        aboutModal.style.display = 'flex';
      }
    });
  }

  if (btnRetryConnection) {
    btnRetryConnection.addEventListener('click', () => {
      hideError();
      connectArduino();
    });
  }

  if (btnContinueKeyboard) {
    btnContinueKeyboard.addEventListener('click', () => {
      hideError();
    });
  }

  modalCloses.forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Close modals when clicking outside
  [errorModal, aboutModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
  });

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    // Only handle keyboard if we're in game screen
    if (!screenGame.classList.contains('active')) return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      doPick();
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
      e.preventDefault();
      const node = parseInt(e.code.replace('Digit', ''));
      doDrop(node);
    } else if (e.code === 'Escape') {
      // Pause/unpause game
      paused = !paused;
      hudStatus.textContent = paused ? 'PAUSED' : (isPicked ? '📦 PICKED — Drop to Node 1-4' : 'WATCHING');
    }
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.code === 'KeyH') {
        e.preventDefault();
        if (screenMenu.classList.contains('active')) {
          switchTab('history');
        }
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        if (screenMenu.classList.contains('active')) {
          switchTab('play');
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        if (screenResults.classList.contains('active')) {
          showScreen(screenMenu);
          switchTab('play');
        }
      }
    }
  });

  // Touch/mouse events for better mobile experience
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  document.addEventListener('touchend', (e) => {
    if (!e.changedTouches[0]) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Swipe gestures (only in game screen)
    if (screenGame.classList.contains('active') && Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100) {
      if (deltaX > 0) {
        // Swipe right - could be used for pick
        // doPick();
      } else {
        // Swipe left - could be used for pause
        // paused = !paused;
      }
    }
  });

  // Prevent zoom on double tap (mobile)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Visibility change handling (pause when tab not visible)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screenGame.classList.contains('active')) {
      paused = true;
      hudStatus.textContent = 'PAUSED (Tab Hidden)';
    }
  });

  // Window focus/blur handling
  window.addEventListener('blur', () => {
    if (screenGame.classList.contains('active')) {
      paused = true;
      hudStatus.textContent = 'PAUSED (Window Lost Focus)';
    }
  });

  window.addEventListener('focus', () => {
    if (screenGame.classList.contains('active') && hudStatus.textContent.includes('PAUSED')) {
      paused = false;
      hudStatus.textContent = isPicked ? '📦 PICKED — Drop to Node 1-4' : 'WATCHING';
      lastTimestamp = 0; // Reset animation timing
    }
  });

  // Performance monitoring
  let frameCount = 0;
  let lastFPSTime = 0;
  let fps = 0;

  function updateFPS(timestamp) {
    frameCount++;
    if (timestamp - lastFPSTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (timestamp - lastFPSTime));
      frameCount = 0;
      lastFPSTime = timestamp;
      
      // Log performance issues
      if (fps < 30 && screenGame.classList.contains('active')) {
        console.warn('Low FPS detected:', fps);
      }
    }
    requestAnimationFrame(updateFPS);
  }

  // Start FPS monitoring
  requestAnimationFrame(updateFPS);

  // Error handling for images
  function handleImageError(img, placeholder) {
    img.style.display = 'none';
    placeholder.style.cssText = 'width:100%;height:100%;background:#333;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;text-align:center;padding:10px;';
    placeholder.innerHTML = `<div>Image not found:<br>${img.alt}</div>`;
  }

  // Preload images for better performance
  function preloadImages() {
    const imagePromises = config.images.map(img => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(img.file);
        image.onerror = () => {
          console.warn('Failed to preload:', img.file);
          resolve(img.file); // Don't reject, just warn
        };
        image.src = `images/${img.file}`;
      });
    });

    Promise.all(imagePromises).then(results => {
      console.log('Preloaded', results.length, 'images');
    });
  }

  // Local storage management
  function clearAllData() {
    if (confirm('This will clear all game history and settings. Are you sure?')) {
      localStorage.removeItem('fluidSortingHistory');
      localStorage.removeItem('fluidSortingSettings');
      gameHistory = [];
      updateHistoryDisplay();
      alert('All data cleared!');
    }
  }

  // Settings management
  function loadSettings() {
    const saved = localStorage.getItem('fluidSortingSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        // Apply any saved settings here
        return settings;
      } catch (e) {
        console.warn('Failed to load settings:', e);
      }
    }
    return {};
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem('fluidSortingSettings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  // Debug functions (for development)
  window.fluidSortingDebug = {
    getHistory: () => gameHistory,
    clearHistory: () => {
      gameHistory = [];
      localStorage.removeItem('fluidSortingHistory');
      updateHistoryDisplay();
    },
    getGameState: () => ({
      level,
      speedSec,
      isPicked,
      paused,
      results: results.length,
      serialConnected
    }),
    simulateArduino: (command) => {
      console.log('Simulating Arduino command:', command);
      handleArduinoCommand(command);
    },
    getFPS: () => fps,
    forceError: (message) => showError(message || 'Test error message')
  };

  // ─── Initialize Application ───
  function initializeApp() {
    console.log('🎮 Fluid Sorting Simulator initialized with Web Serial API');
    
    // Load saved data
    loadHistory();
    loadSettings();
    
    // Update initial status
    updateSerialStatus(false);
    
    // Preload images
    preloadImages();
    
    // Set initial tab
    switchTab('play');
    
    // Check for Web Serial API support
    if (!('serial' in navigator)) {
      console.warn('Web Serial API not supported in this browser');
      showError('Web Serial API not supported. Please use Chrome or Edge browser with HTTPS or localhost.');
    }
    
    // Show ready message
    console.log('✅ Application ready');
    
    // Remove loading overlay if present
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }

  // ─── Service Worker Registration ───
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }

  // ─── Initialize when DOM is ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  // ─── Cleanup on page unload ───
  window.addEventListener('beforeunload', () => {
    if (serialConnected) {
      disconnectArduino();
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

})();



