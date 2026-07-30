/* 用户界面模块 */

import { Game, DIFFICULTIES, GameState, CellState, CellType } from './game.js';
import { padZero, createElement } from './utils.js';

/* 格子图标（内联 SVG，不依赖外部字体，保证任何环境都可见） */
const ICONS = {
    // 地雷
    bomb: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6a1.5 1.5 0 0 1 1.5 1.5c0 .55-.3 1.02-.76 1.24.74.27 1.4.7 1.94 1.27a6.2 6.2 0 1 1-9.36 0c.54-.57 1.2-1 1.94-1.27A1.5 1.5 0 0 1 10.5 4.1 1.5 1.5 0 0 1 12 2.6Z"/></svg>',
    // 旗帜
    flag: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3a1 1 0 0 1 1 1v2.3l11.5-2.9a.7.7 0 0 1 .87.68v12.2a.7.7 0 0 1-.87.68L8 15.7V20a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Z"/></svg>',
    // 错误标记（×）
    wrong: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'
};

export class UI {
    constructor() {
        this.game = null;
        this.gridElement = document.getElementById('grid');
        this.minesCountElement = document.getElementById('mines-count');
        this.timerElement = document.getElementById('timer');
        this.gameStatusElement = document.getElementById('game-status');
        this.resetButton = document.getElementById('reset-btn');
        this.difficultySelect = document.getElementById('difficulty-select');
        this.hintButton = document.getElementById('hint-btn');
        this.hintCountElement = document.getElementById('hint-count');
        this.themeToggle = document.getElementById('theme-toggle');
        this.winStreakEl = document.getElementById('win-streak');
        this.loseStreakEl = document.getElementById('lose-streak');
        this.bestStreakEl = document.getElementById('best-streak');

        this.init();
    }

    init() {
        // 创建游戏实例
        const difficulty = this.difficultySelect.value;
        this.game = new Game(difficulty);

        // 绑定游戏事件回调
        this.game.onTimerUpdate = (seconds) => this.updateTimer(seconds);
        this.game.onFlagUpdate = (minesRemaining) => this.updateMinesCount(minesRemaining);
        this.game.onGameOver = (win, seconds) => this.showGameOver(win, seconds);
        this.game.onReset = () => this.resetUI();
        this.game.onHintUpdate = (hintsUsed) => this.updateHintCount(hintsUsed);
        this.game.onCellRevealed = (row, col) => this.updateCellUI(row, col);
        this.game.onHintApplied = (row, col) => this.applyHint(row, col);

        // 绑定UI事件
        this.resetButton.addEventListener('click', () => this.game.handleReset());
        this.difficultySelect.addEventListener('change', (e) => {
            this.game.handleDifficultyChange(e.target.value);
            this.renderGrid();
        });
        this.hintButton.addEventListener('click', () => this.game.handleHint());

        // 主题切换
        this.setupTheme();

        // 连胜 / 连败记录（localStorage 持久化）
        this.loadStreak();

        // 初始化UI
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
    }

    /**
     * 读取连胜 / 连败 / 最佳连胜记录
     */
    loadStreak() {
        let data = { win: 0, lose: 0, best: 0 };
        try {
            const raw = localStorage.getItem('ms-streak');
            if (raw) data = Object.assign(data, JSON.parse(raw));
        } catch (e) { /* 忽略隐私模式 */ }
        this.streak = data;
        this.renderStreak();
    }

    /**
     * 保存并记录连胜 / 连败
     */
    saveStreak() {
        try { localStorage.setItem('ms-streak', JSON.stringify(this.streak)); } catch (e) { /* 忽略 */ }
        this.renderStreak();
    }

    /**
     * 渲染连胜 / 连败 / 最佳到界面
     */
    renderStreak() {
        if (this.winStreakEl) this.winStreakEl.textContent = this.streak.win;
        if (this.loseStreakEl) this.loseStreakEl.textContent = this.streak.lose;
        if (this.bestStreakEl) this.bestStreakEl.textContent = this.streak.best;
    }

    /**
     * 一局结束后更新连胜 / 连败
     */
    updateStreak(win) {
        if (win) {
            this.streak.win += 1;
            this.streak.lose = 0;
            if (this.streak.win > this.streak.best) this.streak.best = this.streak.win;
        } else {
            this.streak.lose += 1;
            this.streak.win = 0;
        }
        this.saveStreak();
    }

    /**
     * 初始化主题切换（深/浅色手动切换，偏好存入 localStorage）
     * 主题已在 index.html 内联脚本中首屏应用，这里负责图标同步与点击切换
     */
    setupTheme() {
        if (!this.themeToggle) return;
        const icon = this.themeToggle.querySelector('i');

        const apply = (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            try { localStorage.setItem('ms-theme', theme); } catch (e) { /* 忽略隐私模式 */ }
            if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            this.themeToggle.setAttribute('title', theme === 'dark' ? '切换到浅色' : '切换到深色');
        };

        // 同步当前主题对应的图标
        apply(document.documentElement.getAttribute('data-theme') || 'light');

        this.themeToggle.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            apply(next);
        });
    }

    /**
     * 渲染整个网格
     */
    renderGrid() {
        this.gridElement.innerHTML = '';
        this.gridElement.style.gridTemplateColumns = `repeat(${this.game.cols}, auto)`;

        // 添加难度CSS类
        this.gridElement.parentElement.className = `grid-wrapper difficulty-${this.game.difficulty}`;

        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                const cell = this.game.grid[r][c];
                const cellElement = this.createCellElement(cell);
                this.gridElement.appendChild(cellElement);
            }
        }
    }

    /**
     * 创建单个格子DOM元素
     */
    createCellElement(cell) {
        const cellElement = createElement('div', 'cell');
        cellElement.dataset.row = cell.row;
        cellElement.dataset.col = cell.col;

        this.applyCellState(cellElement, cell);

        // 左键点击
        cellElement.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCellClick(cell.row, cell.col, false);
        });

        // 右键标记
        cellElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCellClick(cell.row, cell.col, true);
        });

        // 触摸事件支持（长按模拟右键）
        cellElement.addEventListener('touchstart', (e) => {
            this.handleTouchStart(cell.row, cell.col, e);
        }, { passive: false });

        return cellElement;
    }

    /**
     * 处理格子点击
     */
    handleCellClick(row, col, isRightClick) {
        if (isRightClick) {
            this.game.handleCellRightClick(row, col);
        } else {
            const cell = this.game.grid[row][col];
            // 已翻开的数字格子：触发和弦点击
            if (cell.state === CellState.REVEALED && cell.type === CellType.NUMBER) {
                this.game.chordCell(row, col);
            } else {
                this.game.handleCellClick(row, col);
            }
        }
        this.updateCellUI(row, col);
        this.updateGameStatus();
    }

    /**
     * 处理触摸开始（长按模拟右键）
     */
    handleTouchStart(row, col, event) {
        event.preventDefault();
        const touch = event.touches[0];
        let longPressTriggered = false;

        const touchTimeout = setTimeout(() => {
            longPressTriggered = true;
            this.game.handleCellRightClick(row, col);
            this.updateCellUI(row, col);
            this.updateGameStatus();
        }, 500);

        const touchEndHandler = () => {
            clearTimeout(touchTimeout);
            if (!longPressTriggered) {
                this.game.handleCellClick(row, col);
                this.updateCellUI(row, col);
                this.updateGameStatus();
            }
            cleanup();
        };

        const touchMoveHandler = (e) => {
            const currentTouch = e.touches[0];
            const dx = currentTouch.clientX - touch.clientX;
            const dy = currentTouch.clientY - touch.clientY;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                clearTimeout(touchTimeout);
                cleanup();
            }
        };

        const cleanup = () => {
            document.removeEventListener('touchend', touchEndHandler);
            document.removeEventListener('touchmove', touchMoveHandler);
        };

        document.addEventListener('touchend', touchEndHandler, { once: true });
        document.addEventListener('touchmove', touchMoveHandler);
    }

    /**
     * 将格子状态应用到 DOM 元素
     */
    applyCellState(cellElement, cell) {
        cellElement.className = 'cell';
        cellElement.textContent = '';

        if (cell.state === CellState.REVEALED) {
            cellElement.classList.add('revealed');
            if (cell.type === CellType.MINE) {
                cellElement.classList.add('mine');
                if (cell.exploded) cellElement.classList.add('exploded');
                cellElement.innerHTML = ICONS.bomb;
            } else if (cell.wrongFlag) {
                cellElement.classList.add('wrong-flag');
                cellElement.innerHTML = ICONS.wrong;
            } else if (cell.type === CellType.NUMBER) {
                cellElement.classList.add(`number-${cell.neighborMines}`);
                cellElement.textContent = cell.neighborMines || '';
            }
        } else if (cell.state === CellState.FLAGGED) {
            cellElement.classList.add('flagged');
            cellElement.innerHTML = ICONS.flag;
        }
    }

    /**
     * 更新单个格子的UI
     */
    updateCellUI(row, col) {
        const cell = this.game.grid[row][col];
        const cellElement = this.gridElement.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );
        if (!cellElement) return;
        this.applyCellState(cellElement, cell);
    }

    /**
     * 应用提示高亮
     */
    applyHint(row, col) {
        const cellElement = this.gridElement.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );
        if (!cellElement) return;

        cellElement.classList.add('hinted');

        setTimeout(() => {
            cellElement.classList.remove('hinted');
        }, 2000);
    }

    /**
     * 更新游戏状态显示
     */
    updateGameStatus(customMessage) {
        if (customMessage) {
            this.gameStatusElement.textContent = customMessage;
            this.gameStatusElement.className = 'game-status';
            return;
        }

        let message = '';
        let statusClass = '';
        switch (this.game.state) {
            case GameState.READY:
                message = '点击格子开始游戏';
                break;
            case GameState.PLAYING:
                message = '游戏中…';
                break;
            case GameState.WIN:
                message = `胜利！用时 ${this.game.elapsedSeconds} 秒`;
                statusClass = 'win';
                break;
            case GameState.LOSE:
                message = '游戏结束！踩到地雷了';
                statusClass = 'lose';
                break;
        }
        this.gameStatusElement.textContent = message;
        this.gameStatusElement.className = `game-status ${statusClass}`;

        // 更新重置按钮表情
        this.updateResetButtonFace();
    }

    /**
     * 更新重置按钮表情
     */
    updateResetButtonFace() {
        const icon = this.resetButton.querySelector('i');
        if (!icon) return;

        switch (this.game.state) {
            case GameState.WIN:
                icon.className = 'fas fa-laugh-beam';
                break;
            case GameState.LOSE:
                icon.className = 'fas fa-dizzy';
                break;
            default:
                icon.className = 'fas fa-smile';
                break;
        }
    }

    /**
     * 更新地雷计数器
     */
    updateMinesCount(count) {
        this.minesCountElement.textContent = padZero(Math.max(0, count), 3);
    }

    /**
     * 更新计时器
     */
    updateTimer(seconds) {
        this.timerElement.textContent = padZero(Math.min(999, seconds), 3);
    }

    /**
     * 更新提示次数
     */
    updateHintCount(hintsUsed) {
        const remaining = this.game.maxHints - hintsUsed;
        this.hintCountElement.textContent = remaining;
        this.hintButton.disabled = remaining <= 0;
    }

    /**
     * 显示游戏结束
     */
    showGameOver(win, seconds) {
        // 更新连胜 / 连败记录
        this.updateStreak(win);

        // 更新所有格子（显示地雷、错误标记等）
        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                this.updateCellUI(r, c);
            }
        }

        // 显示消息
        this.updateGameStatus();

        // 禁用提示按钮
        this.hintButton.disabled = true;

        // 显示胜利动画
        if (win) {
            this.showConfetti();
        }
    }

    /**
     * 重置UI
     */
    resetUI() {
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        this.hintButton.disabled = false;
    }

    /**
     * 显示庆祝彩花
     */
    showConfetti() {
        const confettiCount = 80;
        const colors = ['#4796E3', '#9b72d6', '#34C759', '#FF9F0A', '#FF3B30'];

        for (let i = 0; i < confettiCount; i++) {
            const confetti = createElement('div', 'confetti');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background-color: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 2px;
                top: -20px;
                left: ${Math.random() * 100}vw;
                animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
                z-index: 9999;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 6000);
        }

        // 添加CSS动画（仅一次）
        if (!document.getElementById('confetti-style')) {
            const style = createElement('style', null, { id: 'confetti-style' });
            style.textContent = `
                @keyframes confetti-fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// 初始化UI
document.addEventListener('DOMContentLoaded', () => {
    new UI();
});
