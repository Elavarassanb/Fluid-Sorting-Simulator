(() => {
  'use strict';

  // ═══ CONSTANTS ═══
  const CONSTANTS = {
    LABEL_WIDTH: 200,
    LABEL_GAP: 60,
    PICK_ZONE_TOLERANCE: 130,
    MAX_HISTORY_ENTRIES: 50,
    ANIMATION_DELAY: 1000,
    FPS_THRESHOLD: 30,
    STORAGE_KEYS: {
      HISTORY: 'fluidSortingHistory',
      SETTINGS: 'fluidSortingSettings'
    }
  };

  // ═══ DOM ELEMENTS ═══
  const elements = {
    // Screens
    screenMenu: document.getElementById('screen-menu'),
    screenGame: document.getElementById('screen-game'),
    screenResults: document.getElementById('screen-results'),
    
    // Hardware
    hardwareCard: document.getElementById('hardware-card'),
    connectionIndicator: document.getElementById('connection-indicator'),
    btnConnectHw: document.getElementById('btn-connect-hw'),
    btnTestHw: document.getElementById('btn-test-hw'),
    hwStatusTitle: document.getElementById('hw-status-title'),
    hwStatusDesc: document.getElementById('hw-status-desc'),
    
    // Game elements
    conveyorTrack: document.getElementById('conveyor-track'),
    hudLevel: document.getElementById('hud-level'),
    hudProgress: document.getElementById('hud-progress'),
    hudStatus: document.getElementById('hud-status'),
    hudTimer: document.getElementById('hud-timer'),
    hudArduinoStatus: document.getElementById('hud-arduino-status'),
    btnPick: document.getElementById('btn-pick'),
    btnRestart: document.getElementById('btn-restart'),
    
    // Tabs
    tabPlay: document.getElementById('tab-play'),
    tabHistory: document.getElementById('tab-history'),
    
    // Quick actions
    btnRandom: document.getElementById('btn-random'),
    btnTutorial: document.getElementById('btn-tutorial'),
    btnCustom: document.getElementById('btn-custom'),
    
    // History
    historyList: document.getElementById('history-list'),
    totalGames: document.getElementById('total-games'),
    bestAccuracy: document.getElementById('best-accuracy'),
    avgAccuracy: document.getElementById('avg-accuracy'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    btnExportHistory: document.getElementById('btn-export-history'),
    
    // Results
    btnViewHistory: document.getElementById('btn-view-history'),
    btnPrintResults: document.getElementById('btn-print-results'),
    btnShareResults: document.getElementById('btn-share-results'),
    performanceBadge: document.getElementById('performance-badge'),
    badgeScore: document.getElementById('badge-score'),
    badgeDescription: document.getElementById('badge-description'),
    
    // Modals
    errorModal: document.getElementById('error-modal'),
    aboutModal: document.getElementById('about-modal'),
    btnAbout: document.getElementById('btn-about'),
    btnRetryConnection: document.getElementById('btn-retry-connection'),
    btnContinueKeyboard: document.getElementById('btn-continue-keyboard'),
    loadingPlaceholder: document.getElementById('loading-placeholder')
  };

  // ═══ APPLICATION STATE ═══
  const state = {
    // Serial connection
    serialPort: null,
    serialReader: null,
    serialConnected: false,
    
    // Game state
    config: null,
    gameImages: [],
    currentIndex: 0,
    level: 1,
    speedSec: 10,
    isPicked: false,
    pickedLabel: null,
    animationId: null,
    conveyorX: 0,
    lastTimestamp: 0,
    paused: false,
    gameStartTime: 0,
    gameEndTime: 0,
    results: [],
    spilloverChecked: new Set(),
    
    // History and settings
    gameHistory: [],
    settings: {},
    
    // Performance monitoring
    frameCount: 0,
    lastFPSTime: 0,
    fps: 0
  };

  // ═══ EMBEDDED CONFIGURATION ═══
  state.config = {
    images: [
      { file: "label_01.png", node: 1 },
      { file: "label_02.png", node: 2 },
      { file: "label_03.png", node: 3 },
      { file: "label_04.png", node: 4 },
      { file: "label_05.png", node: 1 },
      { file: "label_06.png", node: 2 },
      { file: "label_07.png", node: null },
      { file: "label_08.png", node: 3 },
      { file: "label_09.png", node: null },
      { file: "label_10.png", node: 4 },
      { file: "label_11.png", node: 1 },
      { file: "label_12.png", node: null },
      { file: "label_13.png", node: 2 },
      { file: "label_14.png", node: 3 },
      { file: "label_15.png", node: null },
      { file: "label_16.png", node: 4 },
      { file: "label_17.png", node: 1 },
      { file: "label_18.png", node: null },
      { file: "label_19.png", node: 2 },
      { file: "label_20.png", node: 3 },
      { file: "label_21.png", node: 4 },
      { file: "label_22.png", node: null },
      { file: "label_23.png", node: 1 },
      { file: "label_24.png", node: null },
      { file: "label_25.png", node: 2 },
      { file: "label_26.png", node: 3 },
      { file: "label_27.png", node: null },
      { file: "label_28.png", node: 4 },
      { file: "label_29.png", node: 1 },
      { file: "label_30.png", node: null },
      { file: "label_31.png", node: 2 },
      { file: "label_32.png", node: null },
      { file: "label_33.png", node: 3 },
      { file: "label_34.png", node: null },
      { file: "label_35.png", node: 4 },
      { file: "label_36.png", node: null },
      { file: "label_37.png", node: null },
      { file: "label_38.png", node: null },
      { file: "label_39.png", node: 1 },
      { file: "label_40.png", node: null }
    ],
    levels: {
      1: { name: "Beginner", speedSec: 10 },
      2: { name: "Intermediate", speedSec: 7 },
      3: { name: "Advanced", speedSec: 5 },
      4: { name: "Expert", speedSec: 3 }
    }
  };

  // ═══ UTILITY FUNCTIONS ═══
  const utils = {
    shuffle(arr) {
      const array = [...arr];
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },

    formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  };

  // ═══ STORAGE MANAGEMENT ═══
  const storage = {
    loadHistory() {
      try {
        const saved = localStorage.getItem(CONSTANTS.STORAGE_KEYS.HISTORY);
        state.gameHistory = saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.warn('Failed to load history:', error);
        state.gameHistory = [];
      }
    },

    saveHistory() {
      try {
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.HISTORY, JSON.stringify(state.gameHistory));
      } catch (error) {
        console.warn('Failed to save history:', error);
      }
    },

    loadSettings() {
      try {
        const saved = localStorage.getItem(CONSTANTS.STORAGE_KEYS.SETTINGS);
        state.settings = saved ? JSON.parse(saved) : {};
      } catch (error) {
        console.warn('Failed to load settings:', error);
        state.settings = {};
      }
    },

    saveSettings() {
      try {
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
      } catch (error) {
        console.warn('Failed to save settings:', error);
      }
    },

    clearAll() {
      if (confirm('This will clear all game history and settings. Are you sure?')) {
        localStorage.removeItem(CONSTANTS.STORAGE_KEYS.HISTORY);
        localStorage.removeItem(CONSTANTS.STORAGE_KEYS.SETTINGS);
        state.gameHistory = [];
        state.settings = {};
        ui.updateHistoryDisplay();
        ui.showMessage('All data cleared!');
      }
    }
  };

  // ═══ UI MANAGEMENT ═══
  const ui = {
    showScreen(screen) {
      [elements.screenMenu, elements.screenGame, elements.screenResults].forEach(s => {
        if (s) s.classList.remove('active');
      });
      if (screen) screen.classList.add('active');
    },

    switchTab(tabName) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      const tabBtn = document.getElementById(`tab-${tabName}`);
      const tabContent = document.getElementById(`content-${tabName}`);
      
      if (tabBtn) tabBtn.classList.add('active');
      if (tabContent) tabContent.classList.add('active');
      
      if (tabName === 'history') {
        this.updateHistoryDisplay();
      }
    },

    showLoadingState() {
      if (elements.loadingPlaceholder) {
        elements.loadingPlaceholder.style.display = 'block';
      }
    },

    hideLoadingState() {
      if (elements.loadingPlaceholder) {
        elements.loadingPlaceholder.style.display = 'none';
      }
    },

    showError(message) {
      if (elements.errorModal) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) errorMessage.textContent = message;
        elements.errorModal.style.display = 'flex';
      } else {
        alert(message);
      }
    },

    hideError() {
      if (elements.errorModal) {
        elements.errorModal.style.display = 'none';
      }
    },

    showMessage(message, type = 'info') {
      // Create a toast notification
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
      `;
      
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    },

    updateHistoryDisplay() {
      if (!elements.historyList) return;
      
      if (state.gameHistory.length === 0) {
        elements.historyList.innerHTML = `
          <div class="no-history">
            <p>🎯 No games played yet</p>
            <p>Play your first game to see results here!</p>
          </div>
        `;
        if (elements.totalGames) elements.totalGames.textContent = '0';
        if (elements.bestAccuracy) elements.bestAccuracy.textContent = '0%';
        if (elements.avgAccuracy) elements.avgAccuracy.textContent = '0%';
        return;
      }
      
      // Calculate statistics
      const accuracies = state.gameHistory.map(g => g.accuracy);
      const best = Math.max(...accuracies);
      const average = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
      
      if (elements.totalGames) elements.totalGames.textContent = state.gameHistory.length;
      if (elements.bestAccuracy) elements.bestAccuracy.textContent = best + '%';
      if (elements.avgAccuracy) elements.avgAccuracy.textContent = average + '%';
      
      // Update individual level statistics
      ['beginner', 'intermediate', 'advanced', 'expert'].forEach((levelName, index) => {
        const levelGames = state.gameHistory.filter(g => g.level === index + 1);
        const successEl = document.getElementById(`${levelName}-success`);
        const timeEl = document.getElementById(`${levelName}-time`);
        const attemptsEl = document.getElementById(`${levelName}-attempts`);
        
        if (levelGames.length > 0) {
          const avgAccuracy = Math.round(levelGames.reduce((sum, g) => sum + g.accuracy, 0) / levelGames.length);
          const bestTime = Math.min(...levelGames.map(g => g.totalTime));
          
          if (successEl) successEl.textContent = `${avgAccuracy}%`;
          if (timeEl) timeEl.textContent = utils.formatTime(bestTime);
          if (attemptsEl) attemptsEl.textContent = levelGames.length;
        }
      });
      
      // Generate history list
      elements.historyList.innerHTML = state.gameHistory.map(game => {
        const date = new Date(game.date);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const timeStr = utils.formatTime(game.totalTime);
        
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
    },

    updateHardwareStatus(connected, error = null) {
      if (connected) {
        if (elements.hardwareCard) elements.hardwareCard.classList.add('connected');
        if (elements.hwStatusTitle) elements.hwStatusTitle.textContent = 'Hardware Connected';
        if (elements.hwStatusDesc) elements.hwStatusDesc.textContent = 'Arduino is ready for training sessions';
        if (elements.btnConnectHw) elements.btnConnectHw.innerHTML = '<span>🔴</span>Disconnect';
        if (elements.btnTestHw) elements.btnTestHw.style.display = 'inline-flex';
      } else {
        if (elements.hardwareCard) elements.hardwareCard.classList.remove('connected');
        if (elements.hwStatusTitle) elements.hwStatusTitle.textContent = 'Hardware Status';
        if (elements.hwStatusDesc) {
          elements.hwStatusDesc.textContent = error ? 
            `Connection Error: ${error}` : 
            'Connect your Arduino device to begin training';
        }
        if (elements.btnConnectHw) elements.btnConnectHw.innerHTML = '<span>⚡</span>Connect Device';
        if (elements.btnTestHw) elements.btnTestHw.style.display = 'none';
      }
    },

    updateARIA() {
      document.querySelectorAll('.level-card').forEach((card, index) => {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Start ${state.config.levels[index + 1]?.name || 'Unknown'} level training`);
      });
    },

    flashNode(node, className) {
      const box = document.querySelector(`.node-box[data-node="${node}"]`);
      if (box) {
        box.classList.add(className);
        setTimeout(() => box.classList.remove(className), 800);
      }
    }
  };

  // ═══ SERIAL COMMUNICATION ═══
  const serial = {
    async connect() {
      if (!('serial' in navigator)) {
        ui.showError('Web Serial API not supported. Use Chrome/Edge browser with HTTPS or localhost.');
        return;
      }

      try {
        state.serialPort = await navigator.serial.requestPort();
        await state.serialPort.open({ 
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });

        console.log('✅ Arduino connected via Web Serial API');
        state.serialConnected = true;
        ui.updateHardwareStatus(true);
        this.startReader();

      } catch (error) {
        console.error('❌ Serial connection failed:', error);
        ui.updateHardwareStatus(false, error.message);
        ui.showError('Failed to connect to Arduino: ' + error.message);
      }
    },

    async startReader() {
      if (!state.serialPort?.readable) return;

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = state.serialPort.readable.pipeTo(textDecoder.writable);
      state.serialReader = textDecoder.readable.getReader();

      try {
        while (true) {
          const { value, done } = await state.serialReader.read();
          if (done) break;

          const lines = value.split('\n');
          lines.forEach(line => {
            const cmd = line.trim();
            if (cmd) {
              console.log('📡 Arduino:', cmd);
              this.handleCommand(cmd);
            }
          });
        }
      } catch (error) {
        console.error('Serial read error:', error);
      } finally {
        if (state.serialReader) {
          state.serialReader.releaseLock();
        }
      }
    },

    handleCommand(cmd) {
      if (cmd === 'P') {
        game.pick();
      } else if (['1', '2', '3', '4'].includes(cmd)) {
        game.drop(parseInt(cmd));
      } else if (cmd === 'READY') {
        console.log('🤖 Arduino ready');
      }
    },

    async disconnect() {
      try {
        if (state.serialReader) {
          await state.serialReader.cancel();
          state.serialReader = null;
        }
        
        if (state.serialPort) {
          await state.serialPort.close();
          state.serialPort = null;
        }
        
        state.serialConnected = false;
        ui.updateHardwareStatus(false);
        console.log('🔴 Arduino disconnected');
      } catch (error) {
        console.error('Error disconnecting Arduino:', error);
      }
    },

    async test() {
      if (!state.serialConnected) {
        ui.showError('Arduino not connected');
        return;
      }
      
      try {
        // Send test command
        const writer = state.serialPort.writable.getWriter();
        await writer.write(new TextEncoder().encode('TEST\n'));
        writer.releaseLock();
        ui.showMessage('Test command sent to Arduino');
      } catch (error) {
        ui.showError('Failed to send test command: ' + error.message);
      }
    }
  };

  // ═══ GAME LOGIC ═══
  const game = {
    start(selectedLevel) {
      ui.showLoadingState();
      
      state.level = selectedLevel;
      state.speedSec = state.config.levels[selectedLevel].speedSec;
      state.gameImages = utils.shuffle(state.config.images);
      state.currentIndex = 0;
      state.isPicked = false;
      state.pickedLabel = null;
      state.paused = false;
      state.conveyorX = window.innerWidth;
      state.lastTimestamp = 0;
      state.results = [];
      state.spilloverChecked = new Set();
      state.gameStartTime = Date.now();

      if (elements.hudLevel) elements.hudLevel.textContent = `Level: ${state.config.levels[selectedLevel].name}`;
      if (elements.hudProgress) elements.hudProgress.textContent = `0 / ${state.gameImages.length}`;
      if (elements.hudStatus) {
        elements.hudStatus.textContent = 'WATCHING';
        elements.hudStatus.className = 'status-idle';
      }

      this.buildConveyor();
      ui.showScreen(elements.screenGame);

      setTimeout(() => {
        ui.hideLoadingState();
        state.animationId = requestAnimationFrame(this.animate.bind(this));
      }, CONSTANTS.ANIMATION_DELAY);
    },

    buildConveyor() {
      if (!elements.conveyorTrack) return;
      
      elements.conveyorTrack.innerHTML = '';
      
      // Refresh floating elements animation
      const heroAnimation = document.querySelector('.hero-animation .floating-elements');
      if (heroAnimation) {
        heroAnimation.style.animation = 'none';
        setTimeout(() => {
          heroAnimation.style.animation = '';
        }, 10);
      }
      
      state.gameImages.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'conveyor-label';
        div.dataset.index = idx;
        if (img.node === null) div.classList.add('irrelevant');

        const imgEl = document.createElement('img');
        imgEl.src = `images/${img.file}`;
        imgEl.alt = img.file;
        imgEl.onerror = function() {
          this.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'width:100%;height:100%;background:#333;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;text-align:center;padding:10px;';
          placeholder.innerHTML = `<div>Image not found:<br>${img.file}</div>`;
          div.appendChild(placeholder);
        };
        div.appendChild(imgEl);

        elements.conveyorTrack.appendChild(div);
      });

      elements.conveyorTrack.style.transform = `translateY(-50%) translateX(${state.conveyorX}px)`;
    },

    animate(timestamp) {
      if (!state.lastTimestamp) state.lastTimestamp = timestamp;
      const delta = (timestamp - state.lastTimestamp) / 1000;
      state.lastTimestamp = timestamp;

      if (!state.paused) {
        const labelTotal = CONSTANTS.LABEL_WIDTH + CONSTANTS.LABEL_GAP;
        const pxPerSec = labelTotal / state.speedSec;
        state.conveyorX -= pxPerSec * delta;
        
        if (elements.conveyorTrack) {
          elements.conveyorTrack.style.transform = `translateY(-50%) translateX(${state.conveyorX}px)`;
        }

        this.updatePickZoneHighlight();
        this.checkSpillover();

        const totalWidth = state.gameImages.length * labelTotal;
        if (Math.abs(state.conveyorX) > totalWidth + 300) {
          this.end();
          return;
        }
      }

      this.updateHUD();
      state.animationId = requestAnimationFrame(this.animate.bind(this));
    },

    updatePickZoneHighlight() {
      const labels = elements.conveyorTrack?.querySelectorAll('.conveyor-label');
      const conveyor = document.getElementById('conveyor');
      if (!labels || !conveyor) return;

      const conveyorRect = conveyor.getBoundingClientRect();
      const centerX = conveyorRect.left + conveyorRect.width / 2;

      labels.forEach(label => {
        const rect = label.getBoundingClientRect();
        const labelCenter = rect.left + rect.width / 2;
        if (Math.abs(labelCenter - centerX) < CONSTANTS.PICK_ZONE_TOLERANCE && 
            !label.classList.contains('picked') && 
            !label.classList.contains('missed')) {
          label.classList.add('in-pick-zone');
        } else {
          label.classList.remove('in-pick-zone');
        }
      });
    },

    checkSpillover() {
      const conveyor = document.getElementById('conveyor');
      if (!conveyor || !elements.conveyorTrack) return;

      const conveyorRect = conveyor.getBoundingClientRect();
      const pickZoneRight = conveyorRect.left + conveyorRect.width / 2 + CONSTANTS.PICK_ZONE_TOLERANCE;

      const labels = elements.conveyorTrack.querySelectorAll('.conveyor-label');
      labels.forEach(label => {
        const idx = parseInt(label.dataset.index);
        const img = state.gameImages[idx];
        const rect = label.getBoundingClientRect();

        if (rect.right < pickZoneRight - 200 && !state.spilloverChecked.has(idx)) {
          state.spilloverChecked.add(idx);

          if (img.node !== null && !label.classList.contains('picked')) {
            label.classList.add('missed');
            state.results.push({
              file: img.file,
              node: img.node,
              action: 'spillover',
              droppedNode: null
            });
          }
          if (img.node === null && !label.classList.contains('picked')) {
            state.results.push({
              file: img.file,
              node: null,
              action: 'ignored',
              droppedNode: null
            });
          }
        }
      });

      if (elements.hudProgress) {
        elements.hudProgress.textContent = `${state.results.length} / ${state.gameImages.length}`;
      }
    },

    getLabelInPickZone() {
      const conveyor = document.getElementById('conveyor');
      if (!conveyor || !elements.conveyorTrack) return null;

      const conveyorRect = conveyor.getBoundingClientRect();
      const centerX = conveyorRect.left + conveyorRect.width / 2;

      const labels = elements.conveyorTrack.querySelectorAll('.conveyor-label');
      for (const label of labels) {
        const rect = label.getBoundingClientRect();
        const labelCenter = rect.left + rect.width / 2;
        if (Math.abs(labelCenter - centerX) < CONSTANTS.PICK_ZONE_TOLERANCE) {
          return label;
        }
      }
      return null;
    },

    pick() {
      if (state.isPicked) return;

      const label = this.getLabelInPickZone();
      if (!label) return;

      const idx = parseInt(label.dataset.index);
      const img = state.gameImages[idx];

      if (state.spilloverChecked.has(idx)) return;

      state.isPicked = true;
      state.paused = true;
      state.pickedLabel = { idx, img, element: label };
      state.spilloverChecked.add(idx);

      label.classList.add('picked');
      label.classList.remove('in-pick-zone');

      if (elements.hudStatus) {
        elements.hudStatus.textContent = '📦 PICKED → Drop to Node 1-4';
        elements.hudStatus.className = 'status-picked';
      }
    },

    drop(node) {
      if (!state.isPicked || !state.pickedLabel) return;

      const img = state.pickedLabel.img;

      if (img.node === null) {
        state.results.push({
          file: img.file,
          node: null,
          action: 'falsepick',
          droppedNode: node
        });
        ui.flashNode(node, 'wrong');
      } else if (img.node === node) {
        state.results.push({
          file: img.file,
          node: img.node,
          action: 'correct',
          droppedNode: node
        });
        ui.flashNode(node, 'highlight');
      } else {
        state.results.push({
          file: img.file,
          node: img.node,
          action: 'missorted',
          droppedNode: node
        });
        ui.flashNode(node, 'wrong');
      }

      state.isPicked = false;
      state.paused = false;
      state.pickedLabel = null;
      state.lastTimestamp = 0;

      if (elements.hudStatus) {
        elements.hudStatus.textContent = 'WATCHING';
        elements.hudStatus.className = 'status-idle';
      }
      if (elements.hudProgress) {
        elements.hudProgress.textContent = `${state.results.length} / ${state.gameImages.length}`;
      }
    },

    updateHUD() {
      if (elements.hudTimer) {
        elements.hudTimer.textContent = `⏱ ${state.speedSec}s/label`;
      }
      
      if (elements.hudArduinoStatus) {
        elements.hudArduinoStatus.textContent = state.serialConnected ? '🔗 ✓' : '🔗 ✗';
      }
    },

    end() {
      if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        state.animationId = null;

