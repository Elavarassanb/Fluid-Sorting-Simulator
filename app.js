/**
 * Fluid Sorting Simulator - Main Application
 * Modern ES6+ JavaScript with modular architecture
 */

(() => {
    'use strict';

    // ═══ APPLICATION CONFIGURATION ═══
    const CONFIG = {
        APP_NAME: 'Fluid Sorting Simulator',
        VERSION: '2.0.0',
        STORAGE_PREFIX: 'fluidSorting_',
        DEBUG: true,
        LEVELS: {
            1: { name: 'Beginner', speedSec: 10, color: '#10b981' },
            2: { name: 'Intermediate', speedSec: 7, color: '#f59e0b' },
            3: { name: 'Advanced', speedSec: 5, color: '#ef4444' },
            4: { name: 'Expert', speedSec: 3, color: '#8b5cf6' }
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
                theme: 'light'
            };
            this.isInitialized = false;
        }

        // State management methods
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
            if (element) element.style.display = 'block';
        }

        static hide(element) {
            if (element) element.style.display = 'none';
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

    // ═══ EVENT EMITTER ═══
    class EventEmitter {
        constructor() {
            this.events = {};
        }

        on(event, callback) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(callback);
        }

        emit(event, data) {
            if (this.events[event]) {
                this.events[event].forEach(callback => callback(data));
            }
        }

        off(event, callback) {
            if (this.events[event]) {
                this.events[event] = this.events[event].filter(cb => cb !== callback);
            }
        }
    }

    // ═══ NOTIFICATION SYSTEM ═══
    class NotificationManager {
        static show(message, type = 'info', duration = 3000) {
            const notification = DOMUtils.createElement('div', `notification notification-${type}`);
            notification.innerHTML = `
                <div class="notification-content">
                    <span class="notification-icon">${this.getIcon(type)}</span>
                    <span class="notification-message">${message}</span>
                    <button class="notification-close">×</button>
                </div>
            `;

            // Add styles
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${this.getColor(type)};
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 400px;
                animation: slideInRight 0.3s ease-out;
                font-family: inherit;
            `;

            document.body.appendChild(notification);

            // Auto remove
            const autoRemove = setTimeout(() => {
                this.remove(notification);
            }, duration);

            // Manual close
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                clearTimeout(autoRemove);
                this.remove(notification);
            });

            return notification;
        }

        static remove(notification) {
            if (notification && notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
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

        static getColor(type) {
            const colors = {
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            };
            return colors[type] || colors.info;
        }
    }

    // ═══ TAB MANAGER ═══
    class TabManager extends EventEmitter {
        constructor(state) {
            super();
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

            // Update state
            this.state.setState('currentTab', tabId);

            // Update UI
            this.tabs.forEach((tab, id) => {
                if (tab.button) {
                    DOMUtils.removeClass(tab.button, 'active');
                }
                if (tab.content) {
                    DOMUtils.removeClass(tab.content, 'active');
                }
            });

            const activeTab = this.tabs.get(tabId);
            if (activeTab.button) {
                DOMUtils.addClass(activeTab.button, 'active');
            }
            if (activeTab.content) {
                DOMUtils.addClass(activeTab.content, 'active');
            }

            // Emit event
            this.emit('tabChanged', { tabId, tab: activeTab });
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
    class HardwareManager extends EventEmitter {
        constructor(state) {
            super();
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
                NotificationManager.show(
                    'Web Serial API not supported. Please use Chrome or Edge browser.',
                    'error'
                );
                return false;
            }

            try {
                // Request port
                this.port = await navigator.serial.requestPort();
                
                // Open connection
                await this.port.open({
                    baudRate: 9600,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none'
                });

                this.state.setState('serialConnected', true);
                this.updateUI();
                this.startReading();
                
                NotificationManager.show('Arduino connected successfully!', 'success');
                this.emit('connected');
                Logger.success('Hardware connected');
                
                return true;
            } catch (error) {
                Logger.error('Hardware connection failed:', error);
                NotificationManager.show(`Connection failed: ${error.message}`, 'error');
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
                
                NotificationManager.show('Arduino disconnected', 'info');
                this.emit('disconnected');
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
            this.emit('command', { command });

            // Handle specific commands
            switch (command) {
                case 'P':
                    this.emit('pick');
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    this.emit('drop', { node: parseInt(command) });
                    break;
                case 'READY':
                    this.emit('ready');
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
                NotificationManager.show('Arduino not connected', 'warning');
                return;
            }

            const success = await this.sendCommand('TEST');
            if (success) {
                NotificationManager.show('Test command sent successfully', 'success');
            } else {
                NotificationManager.show('Failed to send test command', 'error');
            }
        }
    }

    // ═══ LEVEL MANAGER ═══
    class LevelManager extends EventEmitter {
        constructor(state) {
            super();
            this.state = state;
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
            
            // Show loading state
            this.showLoadingState();

            // Simulate game start
            setTimeout(() => {
                this.hideLoadingState();
                NotificationManager.show(
                    `🚀 Starting ${level.name} Level!\n\nSpeed: ${level.speedSec}s per item\nGood luck!`,
                    'info',
                    4000
                );
                
                this.emit('levelStarted', { levelId, level });
            }, 1000);
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

        showLoadingState() {
            const placeholder = DOMUtils.$('#loading-placeholder');
            if (placeholder) {
                DOMUtils.show(placeholder);
            }
        }

        hideLoadingState() {
            const placeholder = DOMUtils.$('#loading-placeholder');
            if (placeholder) {
                DOMUtils.hide(placeholder);
            }
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
        }
    }

    // ═══ HISTORY MANAGER ═══
    class HistoryManager extends EventEmitter {
        constructor(state) {
            super();
            this.state = state;
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.updateDisplay();
            Logger.success('History Manager initialized');
        }

        addEntry(gameData) {
            const entry = {
                id: Date.now(),
                date: new Date().toISOString(),
                timestamp: Date.now(),
                ...gameData
            };

            this.state.gameHistory.unshift(entry);
            
            // Keep only last 100 entries
            if (this.state.gameHistory.length > 100) {
                this.state.gameHistory = this.state.gameHistory.slice(0, 100);
            }

            this.state.saveToStorage();
            this.updateDisplay();
            this.emit('entryAdded', entry);
            
            Logger.log('History entry added:', entry);
        }

        clear() {
            if (confirm('Are you sure you want to clear all game history?')) {
                this.state.setState('gameHistory', []);
                this.updateDisplay();
                NotificationManager.show('History cleared successfully', 'success');
                this.emit('historyCleared');
                Logger.log('History cleared');
            }
        }

        export() {
            if (this.state.gameHistory.length === 0) {
                NotificationManager.show('No history to export', 'warning');
                return;
            }

            try {
                const csv = this.generateCSV();
                this.downloadCSV(csv);
                NotificationManager.show('History exported successfully', 'success');
                this.emit('historyExported');
            } catch (error) {
                Logger.error('Export failed:', error);
                NotificationManager.show('Export failed', 'error');
            }
        }

        generateCSV() {
            const headers = ['Date', 'Level', 'Accuracy', 'Correct', 'Missed', 'Time'];
            const rows = this.state.gameHistory.map(game => [
                new Date(game.date).toLocaleDateString(),
                game.levelName || 'Unknown',
                `${game.accuracy || 0}%`,
                game.correct || 0,
                game.missed || 0,
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
                        <span>❌ ${game.missed || 0}</span>
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

        setupEventListeners() {
            const clearBtn = DOMUtils.$('#btn-clear-history');
            const exportBtn = DOMUtils.$('#btn-export-history');

            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clear());
            }

            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.export());
            }
        }

        // Add demo data for testing
        addDemoData() {
            const demoEntries = [
                {
                    level: 1,
                    levelName: 'Beginner',
                    accuracy: 95,
                    correct: 38,
                    missed: 2,
                    totalTime: 420
                },
                {
                    level: 2,
                    levelName: 'Intermediate',
                    accuracy: 78,
                    correct: 31,
                    missed: 9,
                    totalTime: 380
                },
                {
                    level: 1,
                    levelName: 'Beginner',
                    accuracy: 88,
                    correct: 35,
                    missed: 5,
                    totalTime: 450
                }
            ];

            demoEntries.forEach((entry, index) => {
                setTimeout(() => this.addEntry(entry), index * 100);
            });

            Logger.log('Demo history data added');
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
                        NotificationManager.show('Switched to Training tab', 'info', 1500);
                        break;
                        
                    case 'KeyH':
                        e.preventDefault();
                        this.tabManager.switchTo('history');
                        NotificationManager.show('Switched to History tab', 'info', 1500);
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
                        NotificationManager.show('Random level selected!', 'info', 1500);
                        break;
                }
            });

            // Show keyboard shortcuts help
            if (CONFIG.DEBUG) {
                Logger.log('Keyboard shortcuts enabled:');
                Logger.log('  Ctrl+P: Training tab');
                Logger.log('  Ctrl+H: History tab');
                Logger.log('  Ctrl+1-4: Start level 1-4');
                Logger.log('  Ctrl+R: Random level');
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

            if (tutorialBtn) {
                tutorialBtn.addEventListener('click', () => this.showTutorial());
            }

            if (customBtn) {
                customBtn.addEventListener('click', () => this.showCustomSettings());
            }
        }

        showTutorial() {
            NotificationManager.show(
                '📚 Tutorial Mode\n\nInteractive tutorial coming soon!\nThis will guide you through the sorting process step by step.',
                'info',
                4000
            );
            Logger.log('Tutorial requested');
        }

        showCustomSettings() {
            NotificationManager.show(
                '⚙️ Custom Settings\n\nCustom difficulty settings coming soon!\nYou will be able to adjust timing, item count, and more.',
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
                
                // Load saved state
                this.state.loadFromStorage();
                
                // Initialize managers
                await this.initializeManagers();
                
                // Setup CSS animations
                this.addAnimationStyles();
                
                // Mark as initialized
                this.isInitialized = true;
                this.state.setState('isInitialized', true);
                
                Logger.success(`${CONFIG.APP_NAME} initialized successfully!`);
                NotificationManager.show('Application ready! 🚀', 'success', 2000);
                
                // Add demo data if no history exists
                if (this.state.gameHistory.length === 0) {
                    setTimeout(() => {
                        this.managers.history.addDemoData();
                    }, 1000);
                }
                
            } catch (error) {
                Logger.error('Initialization failed:', error);
                NotificationManager.show('Failed to initialize application', 'error');
                throw error;
            }
        }

        async initializeManagers() {
            // Initialize in dependency order
            this.managers.tab = new TabManager(this.state);
            this.managers.hardware = new HardwareManager(this.state);
            this.managers.level = new LevelManager(this.state);
            this.managers.history = new HistoryManager(this.state);
            this.managers.keyboard = new KeyboardManager(this.managers.tab, this.managers.level);
            this.managers.quickActions = new QuickActionsManager(this.managers.level);
            
            // Setup cross-manager communication
            this.setupManagerEvents();
            
            // Set initial tab
            this.managers.tab.switchTo('play');
        }

        setupManagerEvents() {
            // Level events
            this.managers.level.on('levelStarted', (data) => {
                Logger.log('Level started:', data);
                // Could trigger game simulation here
            });

            // Hardware events
            this.managers.hardware.on('connected', () => {
                NotificationManager.show('Hardware ready for training!', 'success');
            });

            this.managers.hardware.on('command', (data) => {
                Logger.log('Hardware command:', data.command);
                // Handle hardware commands for game logic
            });

            // Tab events
            this.managers.tab.on('tabChanged', (data) => {
                if (data.tabId === 'history') {
                    this.managers.history.updateDisplay();
                }
            });

            // History events
            this.managers.history.on('entryAdded', () => {
                this.managers.level.updateLevelStats();
            });
        }

        setupErrorHandling() {
            window.addEventListener('error', (event) => {
                Logger.error('Global error:', event.error);
                NotificationManager.show('An error occurred. Check console for details.', 'error');
            });

            window.addEventListener('unhandledrejection', (event) => {
                Logger.error('Unhandled promise rejection:', event.reason);
                NotificationManager.show('Promise rejection occurred.', 'error');
            });
        }

        addAnimationStyles() {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                
                .notification {
                    font-family: inherit;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    width: 100%;
                }
                
                .notification-close {
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 4px;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                }
                
                .notification-close:hover {
                    opacity: 1;
                    background: rgba(255, 255, 255, 0.2);
                }
                
                .notification-message {
                    flex: 1;
                    white-space: pre-line;
                }
            `;
            document.head.appendChild(style);
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
            const totalItems = 40;
            const correct = Math.floor((gameAccuracy / 100) * totalItems);
            const missed = totalItems - correct;
            const totalTime = Math.floor(Math.random() * 120) + 180; // 3-5 minutes

            const gameResult = {
                level: levelId,
                levelName: level.name,
                accuracy: gameAccuracy,
                correct: correct,
                missed: missed,
                totalTime: totalTime
            };

            this.managers.history.addEntry(gameResult);
            
            NotificationManager.show(
                `🎯 Game Complete!\nLevel: ${level.name}\nAccuracy: ${gameAccuracy}%`,
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
            
            // Remove event listeners
            Object.values(this.managers).forEach(manager => {
                if (manager.destroy) {
                    manager.destroy();
                }
            });
            
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
                addDemoHistory: () => this.app.managers.history.addDemoData(),
                simulateGame: (level, accuracy) => this.app.simulateGameResult(level, accuracy),
                
                // Testing
                testNotification: (message, type) => NotificationManager.show(message || 'Test notification', type || 'info'),
                testError: () => { throw new Error('Test error for debugging'); },
                
                // Utilities
                logger: Logger,
                config: CONFIG,
                
                // Performance
                getPerformanceInfo: () => ({
                    initialized: this.app.isInitialized,
                    historyCount: this.app.state.gameHistory.length,
                    serialConnected: this.app.state.serialConnected,
                    currentTab: this.app.state.currentTab
                })
            };

            if (CONFIG.DEBUG) {
                Logger.log('Debug interface available as window.fluidSortingDebug');
                Logger.log('Try: fluidSortingDebug.simulateGame(1, 95)');
            }
        }
    }

    // ═══ APPLICATION BOOTSTRAP ═══
    async function bootstrap() {
        try {
            Logger.log('Starting application bootstrap...');
            
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
            
            // Setup cleanup on page unload
            window.addEventListener('beforeunload', () => {
                app.destroy();
            });
            
            // Store app reference globally for debugging
            window.fluidSortingApp = app;
            
            Logger.success('Bootstrap completed successfully!');
            
        } catch (error) {
            Logger.error('Bootstrap failed:', error);
            NotificationManager.show('Failed to start application', 'error');
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
            NotificationManager,
            CONFIG
        };
    }

})();
