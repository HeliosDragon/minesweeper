/* 用户界面模块 */

// 游戏和工具函数已在全局作用域中定义（由 game.js, utils.js, stats.js 提供）
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
        this.streakCounterElement.parentNode.appendChild(this.streakIconElement);
        
        console.log('获取的元素:', {
            grid: this.gridElement,
            minesCount: this.minesCountElement,
            timer: this.timerElement,
            gameStatus: this.gameStatusElement,
            resetButton: this.resetButton,
            difficultySelect: this.difficultySelect,
            hintButton: this.hintButton,
            hintCount: this.hintCountElement
        });
        
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
        // 摘要元素
        this.statsStreakSummaryElement = document.getElementById('stats-streak-summary');
        this.statsBestTimeSummaryElement = document.getElementById('stats-best-time-summary');
        this.statsToggleBtn = document.getElementById('stats-toggle-btn');
        this.statsDetailsElement = document.getElementById('stats-details');
        
        this.init();
    }
    
    init() {
        console.log('UI 初始化开始');
        // 创建游戏实例
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
        
        // 绑定UI事件
        this.resetButton.addEventListener('click', () => this.game.handleReset());
        this.difficultySelect.addEventListener('change', (e) => {
            this.game.handleDifficultyChange(e.target.value);
            this.renderGrid();
            this.updateStatsDisplay(); // 难度切换时更新统计
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
        this.updateStatsDisplay(); // 初始显示统计
        console.log('UI 初始化完成');
    }
    
    /**
     * 渲染整个网格
     */
    renderGrid() {
        console.log(`渲染网格: ${this.game.rows}行 ${this.game.cols}列`);
        this.gridElement.innerHTML = '';
        this.gridElement.style.gridTemplateColumns = `repeat(${this.game.cols}, 1fr)`;
        
        // 添加难度CSS类
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
        
        // 根据格子状态添加CSS类
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
        
        // 事件监听
        cellElement.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCellClick(cell.row, cell.col, false);
        }, { passive: false });
        
        cellElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCellClick(cell.row, cell.col, true);
        }, { passive: false });
        
        // 触摸事件支持
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
        console.log(`点击格子 (${row}, ${col})，右键: ${isRightClick}`);
        if (isRightClick) {
            this.game.handleCellRightClick(row, col);
        } else {
            this.game.handleCellClick(row, col);
        }
        this.renderGrid(); // 重新渲染整个网格以确保所有被揭示的格子都更新
        this.updateGameStatus();
    }
    
    /**
     * 处理触摸开始（长按模拟右键）
     */
    handleTouchStart(row, col, event) {
        const touch = event.touches[0];
        const startTime = Date.now();
        const touchTimeout = setTimeout(() => {
            // 长按超过500ms视为右键
            this.game.handleCellRightClick(row, col);
            this.updateCellUI(row, col);
            this.updateGameStatus();
            event.preventDefault();
        }, 500);
        
        const touchEndHandler = () => {
            clearTimeout(touchTimeout);
            if (Date.now() - startTime < 500) {
                // 短按为左键
                this.game.handleCellClick(row, col);
                this.updateCellUI(row, col);
                this.updateGameStatus();
            }
            document.removeEventListener('touchend', touchEndHandler);
            document.removeEventListener('touchmove', touchMoveHandler);
        };
        
        const touchMoveHandler = (e) => {
            // 如果移动则取消长按
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
     * 更新单个格子的UI
     */
    updateCellUI(row, col) {
        const cell = this.game.grid[row][col];
        const cellElement = this.gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!cellElement) return;
        
        // 重置类
        cellElement.className = 'cell';
        cellElement.textContent = '';
        
        // 更新类
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
        // 更新所有格子（显示地雷）
        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                this.updateCellUI(r, c);
            }
        }
        
        // 显示消息
        this.updateGameStatus();
        
        // 禁用提示按钮
        this.hintButton.disabled = true;
        
        // 显示胜利/失败动画
        if (win) {
            this.showConfetti();
        }
        
        // 更新统计信息
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
    }
    
    /**
     * 显示庆祝彩花（简单实现）
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
        
        // 添加CSS动画
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
     * 更新统计信息显示
     */
    updateStatsDisplay() {
        const difficulty = this.game.difficulty;
        const stats = getStats(difficulty);
        console.log('更新统计显示: currentStreak =', stats.currentStreak, 'abs =', Math.abs(stats.currentStreak));
        
        // 难度显示名称映射
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
        console.log('formatStreak:', stats.currentStreak, '->', formatStreak(stats.currentStreak));
        this.statsStreakSummaryElement.textContent = formatStreak(stats.currentStreak);
        this.statsBestTimeSummaryElement.textContent = stats.bestTime > 0 ? formatTime(stats.bestTime) : '--:--';
        // 更新连胜计数器
        if (this.streakCounterElement) {
            const absStreak = Math.abs(stats.currentStreak);
            this.streakCounterElement.textContent = absStreak;
            // 根据正负设置颜色类
            this.streakCounterElement.parentElement.classList.remove('positive', 'negative');
            if (stats.currentStreak > 0) {
                this.streakCounterElement.parentElement.classList.add('positive');
                // 设置图标为奖杯
                console.log('设置奖杯图标');
                this.streakIconElement.className = 'fas fa-trophy';
                this.streakIconElement.style.opacity = '1';
            } else if (stats.currentStreak < 0) {
                this.streakCounterElement.parentElement.classList.add('negative');
                // 设置图标为拇指朝下
                console.log('设置拇指朝下图标');
                this.streakIconElement.className = 'fas fa-thumbs-down';
                this.streakIconElement.style.opacity = '1';
            } else {
                // 无连胜/连败，隐藏图标
                this.streakIconElement.style.opacity = '0';
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