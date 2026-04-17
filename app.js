/**
 * Fluid Sorting Simulator - Complete Application
 * Enhanced version with full UI integration
 */

(() => {
    'use strict';

    // ═══ APPLICATION CONFIGURATION ═══
    const CONFIG = {
        APP_NAME: 'Fluid Sorting Simulator',
        VERSION: '2.1.0',
        STORAGE_PREFIX: 'fluidSorting_',
        DEBUG: true,
        LEVELS: {
            1: { name: 'Beginner', speedSec: 10, color: '#10b981', items: 40 },
            2: { name: 'Intermediate', speedSec: 7, color: '#f59e0b', items: 40 },
            3: { name: 'Advanced', speedSec: 5, color: '#ef4444', items: 40 },
            4: { name: 'Expert', speedSec: 3, color: '#8b5cf6', items: 40 }
        },
        GAME_CONFIG: {
            CONVEYOR_SPEED: 50, // pixels per second
            ITEM_WIDTH: 120,
            ITEM_GAP: 30,
            PICK_ZONE_WIDTH: 220
        }
    };

    // ═══ APPLICATION STATE ═══
    class AppState {
        constructor() {
            this.currentTab = 'play';
            this.serialConnected = false;
            this.gameHistory = [];
            this.settings = {
                soundEnabled: true,
                animationsEnabled: true,
                theme: 'light',
                autoAdvance: false,
                showHints: true,
                saveHistory: true
            };
            this.gameState = null;
            this.isInitialized = false;
        }

        setState(key, value) {
            this[key] = value;
            this.saveToStorage();
            this.notifyStateChange(key, value);
        }

        getState(key) {
            return key ? this[key] : { ...this };
        }

        notifyStateChange(key, value) {
            if (CONFIG.DEBUG) {
                console.log(`🔄 State changed: ${key} =`, value);
            }
            EventBus.emit('stateChanged', { key, value });
        }

        saveToStorage() {
            try {
                const stateToSave = {
                    gameHistory: this.gameHistory,
                    settings: this.settings
                };
                localStorage.setItem(CONFIG.STORAGE_PREFIX + 'state', JSON.stringify(stateToSave));
            } catch (error) {
                Logger.warn('Failed to save state to storage:', error);
            }
        }

        loadFromStorage() {
            try {
                const saved = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'state');
                if (saved) {
                    const parsedState = JSON.parse(saved);
                    this.gameHistory = parsedState.gameHistory || [];
                    this.settings = { ...this.settings, ...parsedState.settings };
                }
            } catch (error) {
                Logger.warn('Failed to load state from storage:', error);
            }
        }
    }

    // ═══ EVENT BUS ═══
    class EventBus {
        static events = {};

        static on(event, callback) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(callback);
        }

        static emit(event, data) {
            if (this.events[event]) {
                this.events[event].forEach(callback => callback(data));
            }
        }

        static off(event, callback) {
            if (this.events[event]) {
                this.events[event] = this.events[event].filter(cb => cb !== callback);
            }
        }
    }

    // ═══ LOGGING UTILITY ═══
    class Logger {
        static log(message, ...args) {
            if (CONFIG.DEBUG) {
                console.log(`[${CONFIG.APP_NAME}] ${message}`, ...args);
            }
        }

        static warn(message, ...args) {
            console.warn(`[${CONFIG.APP_NAME}] ⚠️ ${message}`, ...args);
        }

        static error(message, ...args) {
            console.error(`[${CONFIG.APP_NAME}] ❌ ${message}`, ...args);
        }

        static success(message, ...args) {
            if (CONFIG.DEBUG) {
                console.log(`[${CONFIG.APP_NAME}] ✅ ${message}`, ...args);
            }
        }
    }

    // ═══ DOM UTILITIES ═══
    class DOMUtils {
        static $(selector) {
            return document.querySelector(selector);
        }

        static $$(selector) {
            return document.querySelectorAll(selector);
        }

        static createElement(tag, className = '', innerHTML = '') {
            const element = document.createElement(tag);
            if (className) element.className = className;
            if (innerHTML) element.innerHTML = innerHTML;
            return element;
        }

        static show(element) {
            if (element) {
                element.style.display = 'block';
                element.classList.add('active');
            }
        }

        static hide(element) {
            if (element) {
                element.classList.remove('active');
                setTimeout(() => {
                    element.style.display = 'none';
                }, 300);
            }
        }

        static addClass(element, className) {
            if (element) element.classList.add(className);
        }

        static removeClass(element, className) {
            if (element) element.classList.remove(className);
        }

        static toggleClass(element, className) {
            if (element) element.classList.toggle(className);
        }

        static hasClass(element, className) {
            return element ? element.classList.contains(className) : false;
        }
    }

    // ═══ TOAST NOTIFICATION SYSTEM ═══
    class ToastManager {
        static container = null;

        static init() {
            this.container = DOMUtils.$('#toast-container');
            if (!this.container) {
                this.container = DOMUtils.createElement('div', 'toast-container');
                this.container.id = 'toast-container';
                document.body.appendChild(this.container);
            }
        }

        static show(message, type = 'info', duration = 3000) {
            if (!this.container) this.init();

            const toast = DOMUtils.createElement('div', `toast ${type}`);
            toast.innerHTML = `
                <div class="toast-icon">${this.getIcon(type)}</div>
                <div class="toast-message">${message}</div>
                <button class="toast-close">×</button>
            `;

            this.container.appendChild(toast);

            // Auto remove
            const autoRemove = setTimeout(() => {
                this.remove(toast);
            }, duration);

            // Manual close
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => {
                clearTimeout(autoRemove);
                this.remove(toast);
            });

            return toast;
        }

        static remove(toast) {
            if (toast && toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }

        static getIcon(type) {
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            return icons[type] || icons.info;
        }
    }

    // ═══ MODAL MANAGER ═══
    class ModalManager {
        static modals = {};

        static init() {
            this.modals = {
                error: DOMUtils.$('#error-modal'),
                about: DOMUtils.$('#about-modal'),
                settings: DOMUtils.$('#settings-modal'),
                confirm: DOMUtils.$('#confirm-modal'),
                loading: DOMUtils.$('#loading-modal'),
                success: DOMUtils.$('#success-modal')
            };

            this.setupEventListeners();
        }

        static show(modalId, options = {}) {
            const modal = this.modals[modalId];
            if (!modal) return;

            // Update content if provided
            if (options.title) {
                const titleEl = modal.querySelector('.modal-title');
                if (titleEl) titleEl.textContent = options.title;
            }

            if (options.message) {
                const messageEl = modal.querySelector('.modal-body p') || 
                                 modal.querySelector('#error-message') ||
                                 modal.querySelector('#success-message') ||
                                 modal.querySelector('#confirm-message');
                if (messageEl) messageEl.textContent = options.message;
            }

            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);

            // Auto-hide for loading modal
            if (modalId === 'loading' && options.duration) {
                setTimeout(() => this.hide(modalId), options.duration);
            }
        }

        static hide(modalId) {
            const modal = this.modals[modalId];
            if (!modal) return;

            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }

        static setupEventListeners() {
            // Close button handlers
            DOMUtils.$$('.modal-close').forEach(closeBtn => {
                closeBtn.addEventListener('click', (e) => {
                    const modal = e.target.closest('.modal');
                    if (modal) {
                        const modalId = Object.keys(this.modals).find(key => this.modals[key] === modal);
                        if (modalId) this.hide(modalId);
                    }
                });
            });

            // Click outside to close
            Object.values(this.modals).forEach(modal => {
                if (modal) {
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            const modalId = Object.keys(this.modals).find(key => this.modals[key] === modal);
                            if (modalId) this.hide(modalId);
                        }
                    });
                }
            });

            // ESC key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const activeModal = Object.keys(this.modals).find(key => 
                        this.modals[key] && this.modals[key].classList.contains('active')
                    );
                    if (activeModal) this.hide(activeModal);
                }
            });
        }

        static confirm(message, title = 'Confirm Action') {
            return new Promise((resolve) => {
                this.show('confirm', { title, message });

                const yesBtn = DOMUtils.$('#btn-confirm-yes');
                const noBtn = DOMUtils.$('#btn-confirm-no');

                const handleYes = () => {
                    this.hide('confirm');
                    yesBtn.removeEventListener('click', handleYes);
                    noBtn.removeEventListener('click', handleNo);
                    resolve(true);
                };

                const handleNo = () => {
                    this.hide('confirm');
                    yesBtn.removeEventListener('click', handleYes);
                    noBtn.removeEventListener('click', handleNo);
                    resolve(false);
                };

                yesBtn.addEventListener('click', handleYes);
                noBtn.addEventListener('click', handleNo);
            });
        }
    }

    // ═══ PROGRESS BAR MANAGER ═══
    class ProgressManager {
        static progressBar = null;
        static progressFill = null;

        static init() {
            this.progressBar = DOMUtils.$('#progress-bar');
            this.progressFill = DOMUtils.$('.progress-fill');
        }

        static show() {
            if (this.progressBar) {
                this.progressBar.style.display = 'block';
            }
        }

        static hide() {
            if (this.progressBar) {
                this.progressBar.style.display = 'none';
            }
        }

        static setProgress(percentage) {
            if (this.progressFill) {
                this.progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
            }
        }
    }

    // ═══ TAB MANAGER ═══
    class TabManager {
        constructor(state) {
            this.state = state;
            this.tabs = new Map();
            this.init();
        }

        init() {
            this.registerTab('play', 'content-play');
            this.registerTab('history', 'content-history');
            this.setupEventListeners();
            Logger.success('Tab Manager initialized');
        }

        registerTab(tabId, contentId) {
            this.tabs.set(tabId, {
                button: DOMUtils.$(`#tab-${tabId}`),
                content: DOMUtils.$(`#${contentId}`)
            });
        }

        switchTo(tabId) {
            if (!this.tabs.has(tabId)) {
                Logger.warn(`Tab ${tabId} not found`);
                return;
            }

            this.state.setState('currentTab', tabId);

            // Update UI
            this.tabs.forEach((tab, id) => {
                if (tab.button) DOMUtils.removeClass(tab.button, 'active');
                if (tab.content) DOMUtils.removeClass(tab.content, 'active');
            });

            const activeTab = this.tabs.get(tabId);
            if (activeTab.button) DOMUtils.addClass(activeTab.button, 'active');
            if (activeTab.content) DOMUtils.addClass(activeTab.content, 'active');

            EventBus.emit('tabChanged', { tabId, tab: activeTab });
            Logger.log(`Switched to tab: ${tabId}`);
        }

        setupEventListeners() {
            this.tabs.forEach((tab, tabId) => {
                if (tab.button) {
                    tab.button.addEventListener('click', () => this.switchTo(tabId));
                }
            });
        }
    }

    // ═══ HARDWARE MANAGER ═══
    class HardwareManager {
        constructor(state) {
            this.state = state;
            this.port = null;
            this.reader = null;
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.updateUI();
            Logger.success('Hardware Manager initialized');
        }

        async connect() {
            if (!('serial' in navigator)) {
                ToastManager.show(
                    'Web Serial API not supported. Please use Chrome or Edge browser.',
                    'error'
                );
                return false;
            }

            try {
                ProgressManager.show();
                ProgressManager.setProgress(25);

                this.port = await navigator.serial.requestPort();
                ProgressManager.setProgress(50);

                await this.port.open({
                    baudRate: 9600,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none'
                });

                ProgressManager.setProgress(75);

                this.state.setState('serialConnected', true);
                this.updateUI();
                this.startReading();

                ProgressManager.setProgress(100);
                setTimeout(() => ProgressManager.hide(), 500);

                ToastManager.show('Arduino connected successfully!', 'success');
                EventBus.emit('hardwareConnected');
                Logger.success('Hardware connected');

                return true;
            } catch (error) {
                ProgressManager.hide();
                Logger.error('Hardware connection failed:', error);
                ToastManager.show(`Connection failed: ${error.message}`, 'error');
                return false;
            }
        }

        async disconnect() {
            try {
                if (this.reader) {
                    await this.reader.cancel();
                    this.reader = null;
                }

                if (this.port) {
                    await this.port.close();
                    this.port = null;
                }

                this.state.setState('serialConnected', false);
                this.updateUI();

                ToastManager.show('Arduino disconnected', 'info');
                EventBus.emit('hardwareDisconnected');
                Logger.log('Hardware disconnected');

                return true;
            } catch (error) {
                Logger.error('Disconnection error:', error);
                return false;
            }
        }

        async startReading() {
            if (!this.port || !this.port.readable) return;

            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
            this.reader = textDecoder.readable.getReader();

            try {
                while (true) {
                    const { value, done } = await this.reader.read();
                    if (done) break;

                    const lines = value.split('\n');
                    lines.forEach(line => {
                        const command = line.trim();
                        if (command) {
                            this.handleCommand(command);
                        }
                    });
                }
            } catch (error) {
                Logger.error('Serial read error:', error);
            } finally {
                if (this.reader) {
                    this.reader.releaseLock();
                }
            }
        }

        handleCommand(command) {
            Logger.log('Hardware command received:', command);
            EventBus.emit('hardwareCommand', { command });

            switch (command) {
                case 'P':
                    EventBus.emit('hardwarePick');
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    EventBus.emit('hardwareDrop', { node: parseInt(command) });
                    break;
                case 'READY':
                    EventBus.emit('hardwareReady');
                    break;
                default:
                    Logger.warn('Unknown command:', command);
            }
        }

        async sendCommand(command) {
            if (!this.port || !this.port.writable) {
                Logger.warn('Cannot send command: port not available');
                return false;
            }

            try {
                const writer = this.port.writable.getWriter();
                await writer.write(new TextEncoder().encode(command + '\n'));
                writer.releaseLock();
                Logger.log('Command sent:', command);
                return true;
            } catch (error) {
                Logger.error('Failed to send command:', error);
                return false;
            }
        }

        updateUI() {
            const card = DOMUtils.$('#hardware-card');
            const title = DOMUtils.$('#hw-status-title');
            const desc = DOMUtils.$('#hw-status-desc');
            const btn = DOMUtils.$('#btn-connect-hw');
            const testBtn = DOMUtils.$('#btn-test-hw');

            if (this.state.serialConnected) {
                DOMUtils.addClass(card, 'connected');
                if (title) title.textContent = 'Hardware Connected';
                if (desc) desc.textContent = 'Arduino is ready for training sessions';
                if (btn) btn.innerHTML = '<span>🔴</span> Disconnect';
                if (testBtn) DOMUtils.show(testBtn);
            } else {
                DOMUtils.removeClass(card, 'connected');
                if (title) title.textContent = 'Hardware Status';
                if (desc) desc.textContent = 'Connect your Arduino device to begin training';
                if (btn) btn.innerHTML = '<span>⚡</span> Connect Device';
                if (testBtn) DOMUtils.hide(testBtn);
            }

            // Update HUD status
            const hudArduino = DOMUtils.$('#hud-arduino-status');
            if (hudArduino) {
                hudArduino.textContent = this.state.serialConnected ? '🔗 ✓' : '🔗 ✗';
            }
        }

        setupEventListeners() {
            const connectBtn = DOMUtils.$('#btn-connect-hw');
            const testBtn = DOMUtils.$('#btn-test-hw');

            if (connectBtn) {
                connectBtn.addEventListener('click', () => {
                    if (this.state.serialConnected) {
                        this.disconnect();
                    } else {
                        this.connect();
                    }
                });
            }

            if (testBtn) {
                testBtn.addEventListener('click', () => this.testConnection());
            }
        }

        async testConnection() {
            if (!this.state.serialConnected) {
                ToastManager.show('Arduino not connected', 'warning');
                return;
            }

            const success = await this.sendCommand('TEST');
            if (success) {
                ToastManager.show('Test command sent successfully', 'success');
            } else {
                ToastManager.show('Failed to send test command', 'error');
            }
        }
    }

    // ═══ GAME ENGINE ═══
    class GameEngine {
        constructor(state) {
            this.state = state;
            this.gameState = null;
            this.animationId = null;
            this.keyHandler = null;
            this.init();
        }

        init() {
            this.setupEventListeners();
            Logger.success('Game Engine initialized');
        }

        startGame(levelId) {
            const level = CONFIG.LEVELS[levelId];
            if (!level) {
                Logger.warn(`Level ${levelId} not found`);
                return;
            }

            Logger.log(`Starting game - Level ${levelId}: ${level.name}`);

            // Initialize game state
            this.gameState = {
                level: levelId,
                levelData: level,
                items: this.generateItems(level.items),
                currentItemIndex: 0,
                score: { correct: 0, missorted: 0, spillover: 0, falsepick: 0, ignored: 0 },
                startTime: Date.now(),
                isActive: true,
                isPicked: false,
                pickedItem: null,
                conveyorPosition: window.innerWidth
            };

            this.showGameScreen();
            this.updateHUD();
            this.setupGameControls();
            this.startConveyorAnimation();

            EventBus.emit('gameStarted', { levelId, level });
        }

        generateItems(count) {
            const items = [];
            for (let i = 0; i < count; i++) {
                const isRelevant = Math.random() > 0.3; // 70% relevant items
                items.push({
                    id: i,
                    node: isRelevant ? Math.floor(Math.random() * 4) + 1 : null,
                    emoji: isRelevant ? 
                        ['🔴', '🟡', '🟢', '🔵'][Math.floor(Math.random() * 4)] : 
                        ['⚫', '⚪', '🟤'][Math.floor(Math.random() * 3)],
                    processed: false,
                    picked: false
                });
            }
            return items;
        }

        showGameScreen() {
            // Hide all screens
            DOMUtils.$$('.tab-content, .game-screen, .results-screen').forEach(el => {
                DOMUtils.removeClass(el, 'active');
            });

            // Show game screen
            const gameScreen = DOMUtils.$('#screen-game');
            if (gameScreen) {
                DOMUtils.show(gameScreen);
            }
        }

        updateHUD() {
            if (!this.gameState) return;

            const elements = {
                'hud-level': this.gameState.levelData.name,
                'hud-progress': `${this.gameState.currentItemIndex} / ${this.gameState.items.length}`,
                'hud-timer': `${this.gameState.levelData.speedSec}s/item`,
                'hud-status': this.gameState.isPicked ? 'PICKED - Choose Node' : 'WATCHING'
            };

            Object.entries(elements).forEach(([id, value]) => {
                const el = DOMUtils.$(`#${id}`);
                if (el) el.textContent = value;
            });

            // Update status class
            const statusEl = DOMUtils.$('#hud-status');
            if (statusEl) {
                statusEl.className = `hud-value ${this.gameState.isPicked ? 'status-picked' : 'status-idle'}`;
            }
        }

        setupGameControls() {
            // Pick button
            const pickBtn = DOMUtils.$('#btn-pick');
            if (pickBtn) {
                pickBtn.onclick = () => this.handlePick();
            }

            // Drop buttons
            DOMUtils.$$('.drop-btn').forEach(btn => {
                const node = parseInt(btn.dataset.node);
                btn.onclick = () => this.handleDrop(node);
            });

            // Exit button
            const exitBtn = DOMUtils.$('#btn-exit-game');
            if (exitBtn) {
                exitBtn.onclick = () => this.exitGame();
            }

            // Keyboard controls
            this.keyHandler = (e) => {
                if (!this.gameState || !this.gameState.isActive) return;

                if (e.code === 'Space') {
                    e.preventDefault();
                    this.handlePick();
                } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
                    e.preventDefault();
                    const node = parseInt(e.code.replace('Digit', ''));
                    this.handleDrop(node);
                } else if (e.code === 'Escape') {
                    e.preventDefault();
                    this.pauseGame();
                }
            };

            document.addEventListener('keydown', this.keyHandler);
        }

        startConveyorAnimation() {
            const conveyorTrack = DOMUtils.$('#conveyor-track');
            if (!conveyorTrack) return;

            let lastTime = 0;
            const animate = (currentTime) => {
                if (!this.gameState || !this.gameState.isActive) return;

                const deltaTime = (currentTime - lastTime) / 1000;
                lastTime = currentTime;

                // Move conveyor
                this.gameState.conveyorPosition -= CONFIG.GAME_CONFIG.CONVEYOR_SPEED * deltaTime;

                // Show current item
                this.displayCurrentItem();

                // Check if item passed pick zone
                this.checkItemProgress();

                // Continue animation
                this.animationId = requestAnimationFrame(animate);
            };

            this.animationId = requestAnimationFrame(animate);
        }

        displayCurrentItem() {
            const conveyorTrack = DOMUtils.$('#conveyor-track');
            if (!conveyorTrack || this.gameState.currentItemIndex >= this.gameState.items.length) {
                return;
            }

            const currentItem = this.gameState.items[this.gameState.currentItemIndex];
            if (currentItem.processed) return;

            // Clear previous items
            conveyorTrack.innerHTML = '';

            // Create current item element
            const itemEl = DOMUtils.createElement('div', 'conveyor-item');
            itemEl.innerHTML = currentItem.emoji;
            itemEl.dataset.itemId = currentItem.id;
            itemEl.style.left = `${this.gameState.conveyorPosition}px`;

            if (currentItem.node === null) {
                DOMUtils.addClass(itemEl, 'irrelevant');
            }

            // Check if in pick zone
            const conveyor = DOMUtils.$('#conveyor');
            if (conveyor) {
                const conveyorRect = conveyor.getBoundingClientRect();
                const centerX = conveyorRect.left + conveyorRect.width / 2;
                const itemRect = itemEl.getBoundingClientRect();
                const itemCenter = itemRect.left + itemRect.width / 2;

                if (Math.abs(itemCenter - centerX) < CONFIG.GAME_CONFIG.PICK_ZONE_WIDTH / 2) {
                    DOMUtils.addClass(itemEl, 'in-pick-zone');
                }
            }

            if (currentItem.picked) {
                DOMUtils.addClass(itemEl, 'picked');
            }

            conveyorTrack.appendChild(itemEl);
        }

        checkItemProgress() {
            if (this.gameState.currentItemIndex >= this.gameState.items.length) {
                this.endGame();
                return;
            }

            const currentItem = this.gameState.items[this.gameState.currentItemIndex];
            
            // Check if item has passed the pick zone
            if (this.gameState.conveyorPosition < -CONFIG.GAME_CONFIG.ITEM_WIDTH && !currentItem.processed) {
                currentItem.processed = true;

                // Handle missed items
                if (!currentItem.picked) {
                    if (currentItem.node !== null) {
                        this.gameState.score.spillover++;
                        ToastManager.show('Item missed!', 'warning', 1500);
                    } else {
                        this.gameState.score.ignored++;
                    }
                }

                // Move to next item
                this.gameState.currentItemIndex++;
                this.gameState.conveyorPosition = window.innerWidth;
                this.updateHUD();
            }
        }

        handlePick() {
            if (!this.gameState || !this.gameState.isActive || this.gameState.isPicked) return;

            const currentItem = this.gameState.items[this.gameState.currentItemIndex];
            if (!currentItem || currentItem.processed) return;

            // Check if item is in pick zone
            const itemEl = DOMUtils.$(`[data-item-id="${currentItem.id}"]`);
            if (!itemEl || !DOMUtils.hasClass(itemEl, 'in-pick-zone')) {
                ToastManager.show('Item not in pick zone!', 'warning', 1000);
                return;
            }

            currentItem.picked = true;
            this.gameState.isPicked = true;
            this.gameState.pickedItem = currentItem;

            DOMUtils.addClass(itemEl, 'picked');
            DOMUtils.removeClass(itemEl, 'in-pick-zone');

            this.updateHUD();
            ToastManager.show('Item picked! Choose a node.', 'info', 1500);

            Logger.log('Item picked:', currentItem);
        }

        handleDrop(node) {
            if (!this.gameState || !this.gameState.isPicked || !this.gameState.pickedItem) return;

            const item = this.gameState.pickedItem;
            item.droppedAt = node;
            item.processed = true;

            // Calculate score
            if (item.node === null) {
                // Shouldn't have picked irrelevant item
                this.gameState.score.falsepick++;
                ToastManager.show('False pick! Item was irrelevant.', 'error', 2000);
                this.flashNode(node, 'wrong');
            } else if (item.node === node) {
                // Correct!
                this.gameState.score.correct++;
                ToastManager.show('Correct!', 'success', 1500);
                this.flashNode(node, 'correct');
            } else {
                // Wrong node
                this.gameState.score.missorted++;
                ToastManager.show(`Wrong node! Should be ${item.node}.`, 'error', 2000);
                this.flashNode(node, 'wrong');
            }
                        // Reset pick state
            this.gameState.isPicked = false;
            this.gameState.pickedItem = null;

            // Move to next item
            this.gameState.currentItemIndex++;
            this.gameState.conveyorPosition = window.innerWidth;

            this.updateHUD();
            Logger.log('Item dropped:', item, 'at node:', node);
        }

        flashNode(node, type) {
            const nodeBtn = DOMUtils.$(`[data-node="${node}"]`);
            if (nodeBtn) {
                DOMUtils.addClass(nodeBtn, type);
                setTimeout(() => DOMUtils.removeClass(nodeBtn, type), 800);
            }
        }

        pauseGame() {
            if (!this.gameState) return;

            this.gameState.isActive = !this.gameState.isActive;
            const statusEl = DOMUtils.$('#hud-status');
            
            if (this.gameState.isActive) {
                if (statusEl) statusEl.textContent = this.gameState.isPicked ? 'PICKED - Choose Node' : 'WATCHING';
                ToastManager.show('Game resumed', 'info', 1000);
            } else {
                if (statusEl) statusEl.textContent = 'PAUSED';
                ToastManager.show('Game paused', 'info', 1000);
            }
        }

        endGame() {
            if (!this.gameState) return;

            this.gameState.isActive = false;

            // Cancel animation
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }

            // Remove keyboard handler
            if (this.keyHandler) {
                document.removeEventListener('keydown', this.keyHandler);
                this.keyHandler = null;
            }

            // Calculate final results
            const endTime = Date.now();
            const totalTime = Math.round((endTime - this.gameState.startTime) / 1000);
            const totalRelevant = this.gameState.items.filter(item => item.node !== null).length;
            const accuracy = totalRelevant > 0 ? Math.round((this.gameState.score.correct / totalRelevant) * 100) : 0;

            const results = {
                level: this.gameState.level,
                levelName: this.gameState.levelData.name,
                accuracy: accuracy,
                correct: this.gameState.score.correct,
                missorted: this.gameState.score.missorted,
                spillover: this.gameState.score.spillover,
                falsepick: this.gameState.score.falsepick,
                ignored: this.gameState.score.ignored,
                totalTime: totalTime,
                totalRelevant: totalRelevant,
                totalItems: this.gameState.items.length
            };

            // Add to history
            this.state.gameHistory.unshift({
                id: Date.now(),
                date: new Date().toISOString(),
                ...results
            });

            // Keep only last 100 entries
            if (this.state.gameHistory.length > 100) {
                this.state.gameHistory = this.state.gameHistory.slice(0, 100);
            }

            this.state.saveToStorage();

            // Show results
            this.showResults(results);

            EventBus.emit('gameEnded', results);
            Logger.log('Game ended:', results);
        }

        showResults(results) {
            // Hide game screen, show results
            DOMUtils.hide(DOMUtils.$('#screen-game'));
            DOMUtils.show(DOMUtils.$('#screen-results'));

            // Update results display
            const elements = {
                'res-accuracy': `${results.accuracy}%`,
                'res-correct': results.correct,
                'res-missorted': results.missorted,
                'res-spillover': results.spillover,
                'res-falsepick': results.falsepick,
                'res-total-time': this.formatTime(results.totalTime)
            };

            Object.entries(elements).forEach(([id, value]) => {
                const el = DOMUtils.$(`#${id}`);
                if (el) el.textContent = value;
            });

            // Update performance badge
            const badge = DOMUtils.$('#performance-badge');
            const badgeScore = DOMUtils.$('#badge-score');
            const badgeDesc = DOMUtils.$('#badge-description');

            let performance = 'poor';
            let description = 'Keep practicing to improve your skills!';

            if (results.accuracy >= 90) {
                performance = 'excellent';
                description = 'Outstanding sorting performance!';
            } else if (results.accuracy >= 75) {
                performance = 'good';
                description = 'Good job! Room for improvement.';
            } else if (results.accuracy >= 50) {
                performance = 'average';
                description = 'Average performance. Practice more!';
            }

            if (badge) badge.className = `performance-badge ${performance}`;
            if (badgeScore) badgeScore.textContent = performance.charAt(0).toUpperCase() + performance.slice(1);
            if (badgeDesc) badgeDesc.textContent = description;

            // Update breakdown
            const breakdownElements = {
                'breakdown-total': results.totalItems,
                'breakdown-relevant': results.totalRelevant,
                'breakdown-irrelevant': results.totalItems - results.totalRelevant,
                'breakdown-actions': results.correct + results.missorted + results.falsepick
            };

            Object.entries(breakdownElements).forEach(([id, value]) => {
                const el = DOMUtils.$(`#${id}`);
                if (el) el.textContent = value;
            });

            this.setupResultsButtons();
        }

        setupResultsButtons() {
            const playAgainBtn = DOMUtils.$('#btn-play-again');
            const backMenuBtn = DOMUtils.$('#btn-back-menu');
            const viewHistoryBtn = DOMUtils.$('#btn-view-history');
            const shareBtn = DOMUtils.$('#btn-share-results');

            if (playAgainBtn) {
                playAgainBtn.onclick = () => {
                    this.startGame(this.gameState.level);
                };
            }

            if (backMenuBtn) {
                backMenuBtn.onclick = () => this.exitGame();
            }

            if (viewHistoryBtn) {
                viewHistoryBtn.onclick = () => {
                    this.exitGame();
                    EventBus.emit('switchTab', 'history');
                };
            }

            if (shareBtn) {
                shareBtn.onclick = () => this.shareResults();
            }
        }

        shareResults() {
            if (!this.gameState) return;

            const results = this.state.gameHistory[0]; // Latest result
            const text = `🎯 Fluid Sorting Results\n\nLevel: ${results.levelName}\nAccuracy: ${results.accuracy}%\nTime: ${this.formatTime(results.totalTime)}\n\nTry the Fluid Sorting Simulator!`;

            if (navigator.share) {
                navigator.share({
                    title: 'Fluid Sorting Results',
                    text: text,
                    url: window.location.href
                }).catch(err => Logger.log('Error sharing:', err));
            } else {
                navigator.clipboard.writeText(text).then(() => {
                    ToastManager.show('Results copied to clipboard!', 'success');
                }).catch(() => {
                    ToastManager.show('Share text: ' + text, 'info', 5000);
                });
            }
        }

        exitGame() {
            // Stop game if running
            if (this.gameState && this.gameState.isActive) {
                this.gameState.isActive = false;
            }

            // Cancel animation
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }

            // Remove keyboard handler
            if (this.keyHandler) {
                document.removeEventListener('keydown', this.keyHandler);
                this.keyHandler = null;
            }

            // Hide game and results screens
            DOMUtils.hide(DOMUtils.$('#screen-game'));
            DOMUtils.hide(DOMUtils.$('#screen-results'));

            // Show main menu
            DOMUtils.show(DOMUtils.$('#content-play'));

            // Reset game state
            this.gameState = null;

            Logger.log('Exited game');
        }

        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        setupEventListeners() {
            // Hardware events
            EventBus.on('hardwarePick', () => {
                if (this.gameState && this.gameState.isActive) {
                    this.handlePick();
                }
            });

            EventBus.on('hardwareDrop', (data) => {
                if (this.gameState && this.gameState.isActive) {
                    this.handleDrop(data.node);
                }
            });
        }
    }

    // ═══ LEVEL MANAGER ═══
    class LevelManager {
        constructor(state, gameEngine) {
            this.state = state;
            this.gameEngine = gameEngine;
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.updateLevelStats();
            Logger.success('Level Manager initialized');
        }

        startLevel(levelId) {
            const level = CONFIG.LEVELS[levelId];
            if (!level) {
                Logger.warn(`Level ${levelId} not found`);
                return;
            }

            Logger.log(`Starting level ${levelId}: ${level.name}`);
            
            // Show loading
            ModalManager.show('loading', {
                title: 'Loading...',
                message: `Preparing ${level.name} level training session...`,
                duration: 1500
            });

            // Start game after loading
            setTimeout(() => {
                this.gameEngine.startGame(levelId);
                EventBus.emit('levelStarted', { levelId, level });
            }, 1500);
        }

        getRandomLevel() {
            const levels = Object.keys(CONFIG.LEVELS);
            const randomIndex = Math.floor(Math.random() * levels.length);
            return parseInt(levels[randomIndex]);
        }

        updateLevelStats() {
            const history = this.state.gameHistory;

            Object.keys(CONFIG.LEVELS).forEach(levelId => {
                const levelGames = history.filter(game => game.level === parseInt(levelId));
                const levelName = CONFIG.LEVELS[levelId].name.toLowerCase();

                const successEl = DOMUtils.$(`#${levelName}-success`);
                const timeEl = DOMUtils.$(`#${levelName}-time`);
                const attemptsEl = DOMUtils.$(`#${levelName}-attempts`);

                if (levelGames.length > 0) {
                    const avgAccuracy = Math.round(
                        levelGames.reduce((sum, game) => sum + (game.accuracy || 0), 0) / levelGames.length
                    );
                    const bestTime = Math.min(...levelGames.map(game => game.totalTime || 0));

                    if (successEl) successEl.textContent = `${avgAccuracy}%`;
                    if (timeEl) timeEl.textContent = this.formatTime(bestTime);
                    if (attemptsEl) attemptsEl.textContent = levelGames.length;
                } else {
                    if (successEl) successEl.textContent = '--';
                    if (timeEl) timeEl.textContent = '--';
                    if (attemptsEl) attemptsEl.textContent = '0';
                }
            });
        }

        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        setupEventListeners() {
            // Level buttons
            DOMUtils.$$('.level-btn[data-level]').forEach(btn => {
                const levelId = parseInt(btn.dataset.level);
                btn.addEventListener('click', () => this.startLevel(levelId));
            });

            // Level cards
            DOMUtils.$$('.level-card[data-level]').forEach(card => {
                const levelId = parseInt(card.dataset.level);

                card.addEventListener('click', () => this.startLevel(levelId));

                // Keyboard support
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.startLevel(levelId);
                    }
                });
            });

            // Random level button
            const randomBtn = DOMUtils.$('#btn-random');
            if (randomBtn) {
                randomBtn.addEventListener('click', () => {
                    const randomLevel = this.getRandomLevel();
                    Logger.log('Random level selected:', randomLevel);
                    this.startLevel(randomLevel);
                });
            }

            // Game ended event
            EventBus.on('gameEnded', () => {
                this.updateLevelStats();
            });
        }
    }

    // ═══ HISTORY MANAGER ═══
    class HistoryManager {
        constructor(state) {
            this.state = state;
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.updateDisplay();
            Logger.success('History Manager initialized');
        }

        updateDisplay() {
            this.updateSummaryStats();
            this.updateHistoryList();
        }

        updateSummaryStats() {
            const history = this.state.gameHistory;
            const totalGamesEl = DOMUtils.$('#total-games');
            const bestAccuracyEl = DOMUtils.$('#best-accuracy');
            const avgAccuracyEl = DOMUtils.$('#avg-accuracy');

            if (history.length === 0) {
                if (totalGamesEl) totalGamesEl.textContent = '0';
                if (bestAccuracyEl) bestAccuracyEl.textContent = '0%';
                if (avgAccuracyEl) avgAccuracyEl.textContent = '0%';
                return;
            }

            const accuracies = history.map(game => game.accuracy || 0);
            const bestAccuracy = Math.max(...accuracies);
            const avgAccuracy = Math.round(accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length);

            if (totalGamesEl) totalGamesEl.textContent = history.length;
            if (bestAccuracyEl) bestAccuracyEl.textContent = `${bestAccuracy}%`;
            if (avgAccuracyEl) avgAccuracyEl.textContent = `${avgAccuracy}%`;
        }

        updateHistoryList() {
            const historyList = DOMUtils.$('#history-list');
            if (!historyList) return;

            if (this.state.gameHistory.length === 0) {
                historyList.innerHTML = `
                    <div class="no-history">
                        <p>🎯 No games played yet</p>
                        <p>Play your first game to see results here!</p>
                    </div>
                `;
                return;
            }

            historyList.innerHTML = this.state.gameHistory.map(game => this.renderHistoryItem(game)).join('');
        }

        renderHistoryItem(game) {
            const date = new Date(game.date);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const timeStr = this.formatTime(game.totalTime || 0);
            const accuracy = game.accuracy || 0;

            let scoreClass = 'poor';
            if (accuracy >= 90) scoreClass = 'excellent';
            else if (accuracy >= 75) scoreClass = 'good';
            else if (accuracy >= 50) scoreClass = 'average';

            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-date">${dateStr}</span>
                        <span class="history-level">${game.levelName || 'Unknown'}</span>
                        <span class="history-score ${scoreClass}">${accuracy}%</span>
                    </div>
                    <div class="history-details">
                        <span>✅ ${game.correct || 0}</span>
                        <span>❌ ${game.missorted || 0}</span>
                        <span>⚠️ ${game.spillover || 0}</span>
                        <span>⏱ ${timeStr}</span>
                    </div>
                </div>
            `;
        }

        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        async clear() {
            const confirmed = await ModalManager.confirm(
                'Are you sure you want to clear all game history? This action cannot be undone.',
                'Clear History'
            );

            if (confirmed) {
                this.state.setState('gameHistory', []);
                this.updateDisplay();
                ToastManager.show('History cleared successfully', 'success');
                Logger.log('History cleared');
            }
        }

        export() {
            if (this.state.gameHistory.length === 0) {
                ToastManager.show('No history to export', 'warning');
                return;
            }

            try {
                const csv = this.generateCSV();
                this.downloadCSV(csv);
                ToastManager.show('History exported successfully', 'success');
                Logger.log('History exported');
            } catch (error) {
                Logger.error('Export failed:', error);
                ToastManager.show('Export failed', 'error');
            }
        }

        generateCSV() {
            const headers = ['Date', 'Level', 'Accuracy', 'Correct', 'Missorted', 'Spillover', 'False Pick', 'Time'];
            const rows = this.state.gameHistory.map(game => [
                new Date(game.date).toLocaleDateString(),
                game.levelName || 'Unknown',
                `${game.accuracy || 0}%`,
                game.correct || 0,
                game.missorted || 0,
                game.spillover || 0,
                game.falsepick || 0,
                `${game.totalTime || 0}s`
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        downloadCSV(csvContent) {
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = `fluid-sorting-history-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            URL.revokeObjectURL(url);
        }

        setupEventListeners() {
            const clearBtn = DOMUtils.$('#btn-clear-history');
            const exportBtn = DOMUtils.$('#btn-export-history');

            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clear());
            }

            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.export());
            }

            // Tab change event
            EventBus.on('tabChanged', (data) => {
                if (data.tabId === 'history') {
                    this.updateDisplay();
                }
            });
        }
    }

    // ═══ SETTINGS MANAGER ═══
    class SettingsManager {
        constructor(state) {
            this.state = state;
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.loadSettings();
            Logger.success('Settings Manager initialized');
        }

        loadSettings() {
            const settings = this.state.settings;

            // Apply settings to UI
            const elements = {
                'setting-sound': settings.soundEnabled,
                'setting-animations': settings.animationsEnabled,
                'setting-auto-advance': settings.autoAdvance,
                'setting-show-hints': settings.showHints,
                'setting-save-history': settings.saveHistory
            };

            Object.entries(elements).forEach(([id, value]) => {
                const el = DOMUtils.$(`#${id}`);
                if (el && el.type === 'checkbox') {
                    el.checked = value;
                }
            });

            const themeEl = DOMUtils.$('#setting-theme');
            if (themeEl) {
                themeEl.value = settings.theme || 'light';
            }

            this.applySettings(settings);
        }

        saveSettings() {
            const settings = {
                soundEnabled: DOMUtils.$('#setting-sound')?.checked || false,
                animationsEnabled: DOMUtils.$('#setting-animations')?.checked || false,
                theme: DOMUtils.$('#setting-theme')?.value || 'light',
                autoAdvance: DOMUtils.$('#setting-auto-advance')?.checked || false,
                showHints: DOMUtils.$('#setting-show-hints')?.checked || false,
                saveHistory: DOMUtils.$('#setting-save-history')?.checked || false
            };

            this.state.setState('settings', settings);
            this.applySettings(settings);
            ToastManager.show('Settings saved successfully!', 'success');
        }

        applySettings(settings) {
            // Apply theme
            document.documentElement.setAttribute('data-theme', settings.theme);

            // Apply animations
            if (!settings.animationsEnabled) {
                document.documentElement.style.setProperty('--transition-fast', '0ms');
                document.documentElement.style.setProperty('--transition-base', '0ms');
                document.documentElement.style.setProperty('--transition-slow', '0ms');
            } else {
                document.documentElement.style.removeProperty('--transition-fast');
                document.documentElement.style.removeProperty('--transition-base');
                document.documentElement.style.removeProperty('--transition-slow');
            }

            Logger.log('Settings applied:', settings);
        }

        async clearAllData() {
            const confirmed = await ModalManager.confirm(
                'This will clear all game history, settings, and data. This action cannot be undone.',
                'Clear All Data'
            );

            if (confirmed) {
                localStorage.clear();
                this.state.gameHistory = [];
                this.state.settings = {
                    soundEnabled: true,
                    animationsEnabled: true,
                    theme: 'light',
                    autoAdvance: false,
                    showHints: true,
                    saveHistory: true
                };
                this.loadSettings();
                ToastManager.show('All data cleared successfully', 'success');
                Logger.log('All data cleared');
            }
        }

        setupEventListeners() {
            const saveBtn = DOMUtils.$('#btn-save-settings');
            const clearDataBtn = DOMUtils.$('#btn-clear-all-data');

            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this.saveSettings();
                    ModalManager.hide('settings');
                });
            }

            if (clearDataBtn) {
                clearDataBtn.addEventListener('click', () => this.clearAllData());
            }

            // Volume slider
            const volumeSlider = DOMUtils.$('#setting-volume');
            const volumeDisplay = DOMUtils.$('#volume-display');

            if (volumeSlider && volumeDisplay) {
                volumeSlider.addEventListener('input', (e) => {
                    volumeDisplay.textContent = e.target.value;
                });
            }
        }
    }

    // ═══ FAB MANAGER ═══
    class FABManager {
        constructor() {
            this.init();
        }

        init() {
            this.setupEventListeners();
            Logger.success('FAB Manager initialized');
        }

        setupEventListeners() {
            const fabMain = DOMUtils.$('#fab-main');
            const fabMenu = DOMUtils.$('#fab-menu');

            if (fabMain && fabMenu) {
                fabMain.addEventListener('click', () => {
                    DOMUtils.toggleClass(fabMenu, 'active');
                });

                // Close menu when clicking outside
                document.addEventListener('click', (e) => {
                    if (!fabMain.contains(e.target) && !fabMenu.contains(e.target)) {
                        DOMUtils.removeClass(fabMenu, 'active');
                    }
                });
            }

            // FAB option handlers
            const fabSettings = DOMUtils.$('#fab-settings');
            const fabHelp = DOMUtils.$('#fab-help');
            const fabFullscreen = DOMUtils.$('#fab-fullscreen');

            if (fabSettings) {
                fabSettings.addEventListener('click', () => {
                    ModalManager.show('settings');
                    DOMUtils.removeClass(fabMenu, 'active');
                });
            }

            if (fabHelp) {
                fabHelp.addEventListener('click', () => {
                    ModalManager.show('about');
                    DOMUtils.removeClass(fabMenu, 'active');
                });
            }

            if (fabFullscreen) {
                fabFullscreen.addEventListener('click', () => {
                    this.toggleFullscreen();
                    DOMUtils.removeClass(fabMenu, 'active');
                });
            }
        }

        toggleFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen().then(() => {
                    ToastManager.show('Exited fullscreen', 'info', 1500);
                });
            } else {
                document.documentElement.requestFullscreen().then(() => {
                    ToastManager.show('Entered fullscreen', 'info', 1500);
                }).catch(() => {
                    ToastManager.show('Fullscreen not supported', 'warning');
                });
            }
        }
    }

    // ═══ KEYBOARD MANAGER ═══
    class KeyboardManager {
        constructor(tabManager, levelManager) {
            this.tabManager = tabManager;
            this.levelManager = levelManager;
            this.init();
        }

        init() {
            this.setupGlobalShortcuts();
            Logger.success('Keyboard Manager initialized');
        }

        setupGlobalShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Only handle shortcuts with Ctrl/Cmd
                if (!(e.ctrlKey || e.metaKey)) return;

                switch (e.code) {
                    case 'KeyP':
                        e.preventDefault();
                        this.tabManager.switchTo('play');
                        ToastManager.show('Switched to Training tab', 'info', 1500);
                        break;

                    case 'KeyH':
                        e.preventDefault();
                        this.tabManager.switchTo('history');
                        ToastManager.show('Switched to History tab', 'info', 1500);
                        break;

                    case 'Digit1':
                    case 'Digit2':
                    case 'Digit3':
                    case 'Digit4':
                        e.preventDefault();
                        const level = parseInt(e.code.replace('Digit', ''));
                        this.levelManager.startLevel(level);
                        break;

                    case 'KeyR':
                        e.preventDefault();
                        const randomLevel = this.levelManager.getRandomLevel();
                        this.levelManager.startLevel(randomLevel);
                        ToastManager.show('Random level selected!', 'info', 1500);
                        break;

                    case 'KeyS':
                        e.preventDefault();
                        ModalManager.show('settings');
                        break;

                    case 'KeyI':
                        e.preventDefault();
                        ModalManager.show('about');
                        break;
                }
            });

            if (CONFIG.DEBUG) {
                Logger.log('Keyboard shortcuts enabled:');
                Logger.log('  Ctrl+P: Training tab');
                Logger.log('  Ctrl+H: History tab');
                Logger.log('  Ctrl+1-4: Start level 1-4');
                Logger.log('  Ctrl+R: Random level');
                Logger.log('  Ctrl+S: Settings');
                Logger.log('  Ctrl+I: About/Info');
            }
        }
    }

    // ═══ QUICK ACTIONS MANAGER ═══
    class QuickActionsManager {
        constructor(levelManager) {
            this.levelManager = levelManager;
            this.init();
        }

        init() {
            this.setupEventListeners();
            Logger.success('Quick Actions Manager initialized');
        }

        setupEventListeners() {
            const tutorialBtn = DOMUtils.$('#btn-tutorial');
            const customBtn = DOMUtils.$('#btn-custom');
            const aboutBtn = DOMUtils.$('#btn-about');

            if (tutorialBtn) {
                tutorialBtn.addEventListener('click', () => this.showTutorial());
            }

            if (customBtn) {
                customBtn.addEventListener('click', () => this.showCustomSettings());
            }

            if (aboutBtn) {
                aboutBtn.addEventListener('click', () => {
                    ModalManager.show('about');
                });
            }
        }

        showTutorial() {
            ModalManager.show('about', {
                title: '📚 Tutorial Mode',
                message: 'Interactive tutorial coming soon! This will guide you through the sorting process step by step with helpful hints and tips.'
            });
            Logger.log('Tutorial requested');
        }

        showCustomSettings() {
            ToastManager.show(
                '⚙️ Custom Training\n\nCustom difficulty settings coming soon!\nYou will be able to adjust timing, item count, and more.',
                'info',
                4000
            );
            Logger.log('Custom settings requested');
        }
    }

    // ═══ MAIN APPLICATION CLASS ═══
    class FluidSortingApp {
        constructor() {
            this.state = new AppState();
            this.managers = {};
            this.isInitialized = false;
        }

        async init() {
            try {
                Logger.log(`Initializing ${CONFIG.APP_NAME} v${CONFIG.VERSION}...`);

                // Setup error handling
                this.setupErrorHandling();

                // Initialize UI managers
                ToastManager.init();
                ModalManager.init();
                ProgressManager.init();

                // Load saved state
                this.state.loadFromStorage();

                // Initialize managers
                await this.initializeManagers();

                // Setup cross-manager communication
                this.setupManagerEvents();

                // Mark as initialized
                this.isInitialized = true;
                this.state.setState('isInitialized', true);

                Logger.success(`${CONFIG.APP_NAME} initialized successfully!`);
                ToastManager.show('Application ready! 🚀', 'success', 2000);

                // Add demo data if no history exists
                if (this.state.gameHistory.length === 0) {
                    setTimeout(() => {
                        this.addDemoHistory();
                    }, 2000);
                }

            } catch (error) {
                Logger.error('Initialization failed:', error);
                ModalManager.show('error', {
                    title: 'Initialization Error',
                    message: 'Failed to initialize the application. Please refresh the page.'
                });
                throw error;
            }
        }

        async initializeManagers() {
            // Initialize in dependency order
            this.managers.tab = new TabManager(this.state);
                        this.managers.hardware = new HardwareManager(this.state);
            this.managers.gameEngine = new GameEngine(this.state);
            this.managers.level = new LevelManager(this.state, this.managers.gameEngine);
            this.managers.history = new HistoryManager(this.state);
            this.managers.settings = new SettingsManager(this.state);
            this.managers.fab = new FABManager();
            this.managers.keyboard = new KeyboardManager(this.managers.tab, this.managers.level);
            this.managers.quickActions = new QuickActionsManager(this.managers.level);

            // Set initial tab
            this.managers.tab.switchTo('play');
        }

        setupManagerEvents() {
            // Level events
            EventBus.on('levelStarted', (data) => {
                Logger.log('Level started:', data);
            });

            // Hardware events
            EventBus.on('hardwareConnected', () => {
                ToastManager.show('Hardware ready for training!', 'success');
            });

            EventBus.on('hardwareCommand', (data) => {
                Logger.log('Hardware command:', data.command);
            });

            // Tab events
            EventBus.on('tabChanged', (data) => {
                if (data.tabId === 'history') {
                    this.managers.history.updateDisplay();
                }
            });

            // Switch tab event
            EventBus.on('switchTab', (tabId) => {
                this.managers.tab.switchTo(tabId);
            });

            // Game events
            EventBus.on('gameEnded', (results) => {
                this.managers.level.updateLevelStats();
                
                // Auto-advance to next level if enabled
                if (this.state.settings.autoAdvance && results.accuracy >= 80) {
                    const nextLevel = Math.min(results.level + 1, 4);
                    if (nextLevel > results.level) {
                        setTimeout(() => {
                            ToastManager.show(`Great job! Advancing to ${CONFIG.LEVELS[nextLevel].name} level`, 'success', 3000);
                            setTimeout(() => {
                                this.managers.level.startLevel(nextLevel);
                            }, 3000);
                        }, 2000);
                    }
                }
            });
        }

        setupErrorHandling() {
            window.addEventListener('error', (event) => {
                Logger.error('Global error:', event.error);
                ModalManager.show('error', {
                    title: 'Application Error',
                    message: 'An unexpected error occurred. Check console for details.'
                });
            });

            window.addEventListener('unhandledrejection', (event) => {
                Logger.error('Unhandled promise rejection:', event.reason);
                ModalManager.show('error', {
                    title: 'Promise Error',
                    message: 'A promise rejection occurred. Check console for details.'
                });
            });
        }

        addDemoHistory() {
            const demoEntries = [
                {
                    id: Date.now() - 86400000,
                    date: new Date(Date.now() - 86400000).toISOString(),
                    level: 1,
                    levelName: 'Beginner',
                    accuracy: 95,
                    correct: 38,
                    missorted: 1,
                    spillover: 1,
                    falsepick: 0,
                    ignored: 12,
                    totalTime: 420,
                    totalRelevant: 28,
                    totalItems: 40
                },
                {
                    id: Date.now() - 172800000,
                    date: new Date(Date.now() - 172800000).toISOString(),
                    level: 2,
                    levelName: 'Intermediate',
                    accuracy: 78,
                    correct: 22,
                    missorted: 4,
                    spillover: 2,
                    falsepick: 1,
                    ignored: 11,
                    totalTime: 380,
                    totalRelevant: 29,
                    totalItems: 40
                },
                {
                    id: Date.now() - 259200000,
                    date: new Date(Date.now() - 259200000).toISOString(),
                    level: 1,
                    levelName: 'Beginner',
                    accuracy: 88,
                    correct: 25,
                    missorted: 2,
                    spillover: 1,
                    falsepick: 0,
                    ignored: 12,
                    totalTime: 450,
                    totalRelevant: 28,
                    totalItems: 40
                }
            ];

            this.state.gameHistory = demoEntries;
            this.state.saveToStorage();
            this.managers.history.updateDisplay();
            this.managers.level.updateLevelStats();
            
            ToastManager.show('Demo history loaded for testing', 'info', 2000);
            Logger.log('Demo history added');
        }

        // Public API methods
        getState() {
            return this.state.getState();
        }

        getManager(name) {
            return this.managers[name];
        }

        simulateGameResult(levelId, accuracy = null) {
            if (!this.isInitialized) {
                Logger.warn('App not initialized');
                return;
            }

            const level = CONFIG.LEVELS[levelId];
            if (!level) {
                Logger.warn('Invalid level ID');
                return;
            }

            // Generate random game result
            const gameAccuracy = accuracy || Math.floor(Math.random() * 40) + 60; // 60-100%
            const totalItems = level.items;
            const totalRelevant = Math.floor(totalItems * 0.7); // 70% relevant
            const correct = Math.floor((gameAccuracy / 100) * totalRelevant);
            const missorted = Math.floor(Math.random() * 3);
            const spillover = totalRelevant - correct - missorted;
            const falsepick = Math.floor(Math.random() * 2);
            const ignored = totalItems - totalRelevant - falsepick;
            const totalTime = Math.floor(Math.random() * 120) + 180; // 3-5 minutes

            const gameResult = {
                id: Date.now(),
                date: new Date().toISOString(),
                level: levelId,
                levelName: level.name,
                accuracy: gameAccuracy,
                correct: correct,
                missorted: missorted,
                spillover: spillover,
                falsepick: falsepick,
                ignored: ignored,
                totalTime: totalTime,
                totalRelevant: totalRelevant,
                totalItems: totalItems
            };

            this.state.gameHistory.unshift(gameResult);
            this.state.saveToStorage();
            this.managers.history.updateDisplay();
            this.managers.level.updateLevelStats();

            ToastManager.show(
                `🎯 Simulated Game Complete!\nLevel: ${level.name}\nAccuracy: ${gameAccuracy}%`,
                gameAccuracy >= 80 ? 'success' : 'info',
                3000
            );

            Logger.log('Game result simulated:', gameResult);
        }

        // Performance monitoring
        startPerformanceMonitoring() {
            let frameCount = 0;
            let lastTime = performance.now();

            const monitor = () => {
                frameCount++;
                const currentTime = performance.now();

                if (currentTime - lastTime >= 5000) { // Check every 5 seconds
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

                    if (fps < 30 && CONFIG.DEBUG) {
                        Logger.warn(`Low FPS detected: ${fps}`);
                    }

                    frameCount = 0;
                    lastTime = currentTime;
                }

                requestAnimationFrame(monitor);
            };

            requestAnimationFrame(monitor);
        }

        // Cleanup
        destroy() {
            Logger.log('Destroying application...');

            // Save state
            this.state.saveToStorage();

            // Disconnect hardware
            if (this.managers.hardware && this.state.serialConnected) {
                this.managers.hardware.disconnect();
            }

            // Stop game if running
            if (this.managers.gameEngine) {
                this.managers.gameEngine.exitGame();
            }

            // Clear event listeners
            EventBus.events = {};

            this.isInitialized = false;
            Logger.success('Application destroyed');
        }
    }

    // ═══ GLOBAL DEBUG INTERFACE ═══
    class DebugInterface {
        constructor(app) {
            this.app = app;
            this.setupDebugCommands();
        }

        setupDebugCommands() {
            window.fluidSortingDebug = {
                // App control
                getApp: () => this.app,
                getState: () => this.app.getState(),
                getManager: (name) => this.app.getManager(name),

                // Quick actions
                switchTab: (tab) => this.app.managers.tab.switchTo(tab),
                startLevel: (level) => this.app.managers.level.startLevel(level),
                connectHardware: () => this.app.managers.hardware.connect(),
                disconnectHardware: () => this.app.managers.hardware.disconnect(),

                // Data manipulation
                clearHistory: () => this.app.managers.history.clear(),
                addDemoHistory: () => this.app.addDemoHistory(),
                simulateGame: (level, accuracy) => this.app.simulateGameResult(level, accuracy),

                // UI testing
                showToast: (message, type) => ToastManager.show(message || 'Test toast', type || 'info'),
                showModal: (modalId, options) => ModalManager.show(modalId, options),
                hideModal: (modalId) => ModalManager.hide(modalId),
                testError: () => { throw new Error('Test error for debugging'); },

                // Settings
                loadSettings: () => this.app.managers.settings.loadSettings(),
                saveSettings: () => this.app.managers.settings.saveSettings(),
                clearAllData: () => this.app.managers.settings.clearAllData(),

                // Utilities
                logger: Logger,
                config: CONFIG,
                eventBus: EventBus,

                // Performance
                getPerformanceInfo: () => ({
                    initialized: this.app.isInitialized,
                    historyCount: this.app.state.gameHistory.length,
                    serialConnected: this.app.state.serialConnected,
                    currentTab: this.app.state.currentTab,
                    gameActive: this.app.managers.gameEngine.gameState?.isActive || false
                }),

                // Hardware simulation
                simulateHardwareCommand: (command) => {
                    EventBus.emit('hardwareCommand', { command });
                    if (command === 'P') EventBus.emit('hardwarePick');
                    else if (['1','2','3','4'].includes(command)) EventBus.emit('hardwareDrop', { node: parseInt(command) });
                }
            };

            if (CONFIG.DEBUG) {
                Logger.log('Debug interface available as window.fluidSortingDebug');
                Logger.log('Try: fluidSortingDebug.simulateGame(1, 95)');
                Logger.log('Try: fluidSortingDebug.showToast("Hello!", "success")');
                Logger.log('Try: fluidSortingDebug.simulateHardwareCommand("P")');
            }
        }
    }

    // ═══ SERVICE WORKER REGISTRATION ═══
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        Logger.log('SW registered: ', registration);
                    })
                    .catch(registrationError => {
                        Logger.log('SW registration failed: ', registrationError);
                    });
            });
        }
    }

    // ═══ APPLICATION BOOTSTRAP ═══
    async function bootstrap() {
        try {
            Logger.log('Starting application bootstrap...');

            // Show loading overlay
            const loadingOverlay = DOMUtils.$('#loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }

            // Create main app instance
            const app = new FluidSortingApp();

            // Setup debug interface
            if (CONFIG.DEBUG) {
                new DebugInterface(app);
            }

            // Initialize app
            await app.init();

            // Start performance monitoring
            app.startPerformanceMonitoring();

            // Register service worker
            registerServiceWorker();

            // Setup cleanup on page unload
            window.addEventListener('beforeunload', () => {
                app.destroy();
            });

            // Handle visibility change (pause when tab not visible)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && app.managers.gameEngine.gameState?.isActive) {
                    app.managers.gameEngine.pauseGame();
                    ToastManager.show('Game paused (tab hidden)', 'info', 2000);
                }
            });

            // Store app reference globally
            window.fluidSortingApp = app;

            // Hide loading overlay
            if (loadingOverlay) {
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 1000);
            }

            Logger.success('Bootstrap completed successfully!');

        } catch (error) {
            Logger.error('Bootstrap failed:', error);
            
            // Hide loading overlay
            const loadingOverlay = DOMUtils.$('#loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            
            // Show error
            ModalManager.show('error', {
                title: 'Startup Error',
                message: 'Failed to start the application. Please refresh the page and try again.'
            });
        }
    }

    // ═══ AUTO-START APPLICATION ═══
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

    // ═══ EXPORT FOR TESTING ═══
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            FluidSortingApp,
            Logger,
            ToastManager,
            ModalManager,
            EventBus,
            CONFIG
        };
    }

})();


