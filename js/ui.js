/* 用户界面模块 - 修复提示 + 连胜显示 */

// 游戏和工具函数已在全局作用域中定义
// 直接使用全局变量 Game, DIFFICULTIES, GameState, CellState, CellType, padZero, createElement, addEventListener, getStats, formatTime, formatStreak, clearGameRecords

class UI {
    constructor() {
        console.log('UI 构造函数开始');
        this.game = null;
        this.gridElement = document.getElementById('grid');
        this.minesCountElement = document.getElementById('mines-count');
        this.timerElement = document.getElementById('timer');
        this.gameStatusElement = document.getElementById('game-status');
        this.resetButton = document.getElementById('reset-btn');
        this.difficultySelect = document.getElementById('difficulty-select');
        this.hintButton = document.getElementById('hint-btn');
        this.hintCountElement = document.getElementById('hint-count');
        this.streakCounterElement = document.getElementById('streak-counter');
        
        // 创建连胜图标元素
        this.streakIconElement = document.createElement('i');
        this.streakIconElement.classList.add('fas');
        const parent = this.streakCounterElement?.parentNode;
        if (parent) {
            parent.appendChild(this.streakIconElement);
        }
        
        // 统计面板元素
        this.statsDifficultyElement = document.getElementById('stats-difficulty');
        this.statsTotalElement = document.getElementById('stats-total');
        this.statsWinRateElement = document.getElementById('stats-win-rate');
        this.statsStreakElement = document.getElementById('stats-streak');
        this.statsMaxStreakElement = document.getElementById('stats-max-streak');
        this.statsMaxLosingStreakElement = document.getElementById('stats-max-losing-streak');
        this.statsBestTimeElement = document.getElementById('stats-best-time');
        this.statsAvgTimeElement = document.getElementById('stats-avg-time');
        this.statsResetButton = document.getElementById('stats-reset-btn');
        this.statsStreakSummaryElement = document.getElementById('stats-streak-summary');
        this.statsBestTimeSummaryElement = document.getElementById('stats-best-time-summary');
        this.statsToggleBtn = document.getElementById('stats-toggle-btn');
        this.statsDetailsElement = document.getElementById('stats-details');
        
        // 【新增】高亮提示相关
        this._hintTimeout = null;
        this._hintedCell = null;
        
        this.init();
    }
    
    init() {
        console.log('UI 初始化开始');
        const difficulty = this.difficultySelect.value;
        console.log('难度:', difficulty);
        this.game = new Game(difficulty);
        console.log('游戏实例创建完成');
        
        // 绑定游戏事件
        this.game.onTimerUpdate = (seconds) => this.updateTimer(seconds);
        this.game.onFlagUpdate = (minesRemaining) => this.updateMinesCount(minesRemaining);
        this.game.onGameOver = (win, seconds) => this.showGameOver(win, seconds);
        this.game.onReset = () => this.resetUI();
        this.game.onHintUpdate = (hintsUsed) => this.updateHintCount(hintsUsed);
        
        // 【新增】绑定提示应用回调
        this.game.onHintApplied = (row, col) => {
            this.highlightHint(row, col);
        };
        
        // 绑定UI事件
        this.resetButton.addEventListener('click', () => this.game.handleReset());
        this.difficultySelect.addEventListener('change', (e) => {
            this.game.handleDifficultyChange(e.target.value);
            this.renderGrid();
            this.updateStatsDisplay();
        });
        this.hintButton.addEventListener('click', () => this.game.handleHint());
        this.statsResetButton.addEventListener('click', () => this.clearStats());
        this.statsToggleBtn.addEventListener('click', () => this.toggleStatsDetails());
        
        // 初始化UI
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        console.log('开始渲染网格');
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        this.updateStatsDisplay();
        console.log('UI 初始化完成');
    }
    
    /**
     * 渲染整个网格
     */
    renderGrid() {
        console.log(`渲染网格: ${this.game.rows}行 ${this.game.cols}列`);
        this.gridElement.innerHTML = '';
        this.gridElement.style.gridTemplateColumns = `repeat(${this.game.cols}, 1fr)`;
        this.gridElement.parentElement.className = `grid-wrapper difficulty-${this.game.difficulty}`;
        
        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                const cell = this.game.grid[r][c];
                const cellElement = this.createCellElement(cell);
                this.gridElement.appendChild(cellElement);
            }
        }
        console.log(`网格渲染完成，共 ${this.game.rows * this.game.cols} 个格子`);
    }
    
    /**
     * 创建单个格子DOM元素
     */
    createCellElement(cell) {
        const cellElement = createElement('div', 'cell');
        cellElement.dataset.row = cell.row;
        cellElement.dataset.col = cell.col;
        
        if (cell.state === CellState.REVEALED) {
            cellElement.classList.add('revealed');
            if (cell.type === CellType.MINE) {
                cellElement.classList.add('mine');
            } else if (cell.type === CellType.NUMBER) {
                cellElement.classList.add(`number-${cell.neighborMines}`);
                cellElement.textContent = cell.neighborMines || '';
            }
        } else if (cell.state === CellState.FLAGGED) {
            cellElement.classList.add('flagged');
        }
        
        cellElement.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCellClick(cell.row, cell.col, false);
        }, { passive: false });
        
        cellElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCellClick(cell.row, cell.col, true);
        }, { passive: false });
        
        cellElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
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
            this.game.handleCellClick(row, col);
        }
        this.renderGrid();
        this.updateGameStatus();
        // 游戏状态变化后更新统计
        if (this.game.state === GameState.WIN || this.game.state === GameState.LOSE) {
            this.updateStatsDisplay();
        }
    }
    
    /**
     * 处理触摸开始（长按模拟右键）
     */
    handleTouchStart(row, col, event) {
        const touch = event.touches[0];
        const startTime = Date.now();
        const touchTimeout = setTimeout(() => {
            this.game.handleCellRightClick(row, col);
            this.renderGrid();
            this.updateGameStatus();
            event.preventDefault();
        }, 500);
        
        const touchEndHandler = () => {
            clearTimeout(touchTimeout);
            if (Date.now() - startTime < 500) {
                this.game.handleCellClick(row, col);
                this.renderGrid();
                this.updateGameStatus();
            }
            document.removeEventListener('touchend', touchEndHandler);
            document.removeEventListener('touchmove', touchMoveHandler);
        };
        
        const touchMoveHandler = (e) => {
            const currentTouch = e.touches[0];
            const dx = currentTouch.clientX - touch.clientX;
            const dy = currentTouch.clientY - touch.clientY;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                clearTimeout(touchTimeout);
                document.removeEventListener('touchend', touchEndHandler);
                document.removeEventListener('touchmove', touchMoveHandler);
            }
        };
        
        document.addEventListener('touchend', touchEndHandler, { once: true });
        document.addEventListener('touchmove', touchMoveHandler);
    }
    
    /**
     * 【新增】高亮提示的格子
     */
    highlightHint(row, col) {
        // 清除之前的高亮
        if (this._hintedCell) {
            this._hintedCell.classList.remove('hinted');
        }
        
        const cellElement = this.gridElement.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );
        if (!cellElement) return;
        
        // 添加高亮类
        cellElement.classList.add('hinted');
        this._hintedCell = cellElement;
        
        // 清除之前的定时器
        if (this._hintTimeout) {
            clearTimeout(this._hintTimeout);
        }
        
        // 3秒后自动移除高亮
        this._hintTimeout = setTimeout(() => {
            if (this._hintedCell) {
                this._hintedCell.classList.remove('hinted');
                this._hintedCell = null;
            }
            this._hintTimeout = null;
        }, 3000);
        
        // 更新状态栏提示
        this.updateGameStatus(`💡 提示: 点击 (${row + 1}, ${col + 1}) 位置安全`);
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
                message = `🎉 胜利！用时 ${this.game.elapsedSeconds} 秒`;
                statusClass = 'win';
                break;
            case GameState.LOSE:
                message = '💥 游戏结束！踩到地雷了';
                statusClass = 'lose';
                break;
        }
        this.gameStatusElement.textContent = message;
        this.gameStatusElement.className = `game-status ${statusClass}`;
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
        this.timerElement.textContent = padZero(seconds, 3);
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
        this.renderGrid();
        this.updateGameStatus();
        this.hintButton.disabled = true;
        if (win) {
            this.showConfetti();
        }
        // 【修复】游戏结束时更新统计
        this.updateStatsDisplay();
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
        // 重置时更新统计
        this.updateStatsDisplay();
    }
    
    /**
     * 显示庆祝彩花
     */
    showConfetti() {
        const confettiCount = 100;
        const colors = ['#4a6fa5', '#28a745', '#dc3545', '#ffc107', '#17a2b8'];
        
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
            setTimeout(() => confetti.remove(), 5000);
        }
        
        if (!document.getElementById('confetti-style')) {
            const style = createElement('style', null, { id: 'confetti-style' });
            style.textContent = `
                @keyframes confetti-fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 【修复】更新统计信息显示 - 确保连胜正确展示
     */
    updateStatsDisplay() {
        const difficulty = this.game.difficulty;
        const stats = getStats(difficulty);
        
        const difficultyNames = {
            beginner: '初级',
            intermediate: '中级',
            expert: '高级'
        };
        this.statsDifficultyElement.textContent = difficultyNames[difficulty] || difficulty;
        this.statsTotalElement.textContent = stats.total;
        this.statsWinRateElement.textContent = `${stats.winRate}%`;
        this.statsStreakElement.textContent = formatStreak(stats.currentStreak);
        this.statsMaxStreakElement.textContent = stats.maxStreak;
        this.statsMaxLosingStreakElement.textContent = stats.maxLosingStreak;
        this.statsBestTimeElement.textContent = stats.bestTime > 0 ? formatTime(stats.bestTime) : '--:--';
        this.statsAvgTimeElement.textContent = stats.averageTime > 0 ? formatTime(stats.averageTime) : '--:--';
        
        // 更新摘要显示
        this.statsStreakSummaryElement.textContent = formatStreak(stats.currentStreak);
        this.statsBestTimeSummaryElement.textContent = stats.bestTime > 0 ? formatTime(stats.bestTime) : '--:--';
        
        // 【修复】更新连胜计数器 - 显示正确的连胜/连败状态
        if (this.streakCounterElement) {
            const absStreak = Math.abs(stats.currentStreak);
            this.streakCounterElement.textContent = absStreak;
            this.streakCounterElement.parentElement.classList.remove('positive', 'negative');
            
            if (stats.currentStreak > 0) {
                this.streakCounterElement.parentElement.classList.add('positive');
                this.streakIconElement.className = 'fas fa-trophy';
                this.streakIconElement.style.opacity = '1';
                this.streakCounterElement.parentElement.querySelector('.counter-label').textContent = '连胜';
            } else if (stats.currentStreak < 0) {
                this.streakCounterElement.parentElement.classList.add('negative');
                this.streakIconElement.className = 'fas fa-thumbs-down';
                this.streakIconElement.style.opacity = '1';
                this.streakCounterElement.parentElement.querySelector('.counter-label').textContent = '连败';
            } else {
                this.streakIconElement.style.opacity = '0';
                this.streakCounterElement.parentElement.querySelector('.counter-label').textContent = '连胜/连败';
            }
        }
    }

    /**
     * 清空所有统计记录
     */
    clearStats() {
        if (confirm('确定要清空所有游戏统计记录吗？此操作不可撤销。')) {
            clearGameRecords();
            this.updateStatsDisplay();
            alert('统计记录已清空。');
        }
    }

    /**
     * 切换统计详细信息显示
     */
    toggleStatsDetails() {
        const details = this.statsDetailsElement;
        if (details.style.display === 'none') {
            details.style.display = 'block';
            this.statsToggleBtn.textContent = '隐藏统计';
        } else {
            details.style.display = 'none';
            this.statsToggleBtn.textContent = '详细统计';
        }
    }
}

// 初始化UI
document.addEventListener('DOMContentLoaded', () => {
    new UI();
});