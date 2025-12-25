/* 扫雷游戏打包文件 - 合并 utils.js, game.js, ui.js */

// ========== utils.js ==========
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

function randomUniqueIndices(count, max) {
    if (count > max) {
        throw new Error(`count (${count}) cannot be greater than max (${max})`);
    }
    const indices = new Set();
    while (indices.size < count) {
        indices.add(randomInt(0, max - 1));
    }
    return Array.from(indices);
}

function deepCopy2D(grid) {
    return grid.map(row => [...row]);
}

function padZero(num, digits = 3) {
    return String(num).padStart(digits, '0');
}

function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function addEventListener(el, event, handler, options = {}) {
    const passive = options.passive ?? true;
    el.addEventListener(event, handler, { passive, ...options });
    return () => el.removeEventListener(event, handler, { passive, ...options });
}

function createElement(tag, className, attributes = {}) {
    const el = document.createElement(tag);
    if (className) {
        if (Array.isArray(className)) {
            el.classList.add(...className);
        } else {
            el.className = className;
        }
    }
    Object.entries(attributes).forEach(([key, value]) => {
        el.setAttribute(key, value);
    });
    return el;
}

const NEIGHBOR_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// ========== game.js ==========
const DIFFICULTIES = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
};

const GameState = {
    READY: 'ready',
    PLAYING: 'playing',
    WIN: 'win',
    LOSE: 'lose'
};

const CellState = {
    HIDDEN: 'hidden',
    REVEALED: 'revealed',
    FLAGGED: 'flagged',
    QUESTION: 'question'
};

const CellType = {
    EMPTY: 'empty',
    NUMBER: 'number',
    MINE: 'mine'
};

class Game {
    constructor(difficulty = 'intermediate') {
        this.difficulty = difficulty;
        this.config = DIFFICULTIES[difficulty];
        this.rows = this.config.rows;
        this.cols = this.config.cols;
        this.totalMines = this.config.mines;
        
        this.state = GameState.READY;
        this.grid = null;
        this.revealedCount = 0;
        this.flaggedCount = 0;
        this.minesRemaining = this.totalMines;
        this.hintsUsed = 0;
        this.maxHints = 3;
        
        this.startTime = null;
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        
        this.isFirstClick = true;
        
        this.handleCellClick = this.handleCellClick.bind(this);
        this.handleCellRightClick = this.handleCellRightClick.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.handleDifficultyChange = this.handleDifficultyChange.bind(this);
        this.handleHint = this.handleHint.bind(this);
        
        this.initGrid();
    }
    
    initGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    type: CellType.EMPTY,
                    state: CellState.HIDDEN,
                    neighborMines: 0,
                    row: r,
                    col: c
                });
            }
            this.grid.push(row);
        }
        this.revealedCount = 0;
        this.flaggedCount = 0;
        this.minesRemaining = this.totalMines;
        this.hintsUsed = 0;
        this.elapsedSeconds = 0;
        this.isFirstClick = true;
        this.stopTimer();
    }
    
    placeMines(safeRow, safeCol) {
        const safeCells = new Set();
        for (const [dr, dc] of NEIGHBOR_OFFSETS) {
            const nr = safeRow + dr;
            const nc = safeCol + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                safeCells.add(nr * this.cols + nc);
            }
        }
        safeCells.add(safeRow * this.cols + safeCol);
        
        const totalCells = this.rows * this.cols;
        const mineIndices = randomUniqueIndices(this.totalMines, totalCells).filter(
            idx => !safeCells.has(idx)
        );
        
        for (const idx of mineIndices) {
            const r = Math.floor(idx / this.cols);
            const c = idx % this.cols;
            this.grid[r][c].type = CellType.MINE;
        }
        
        this.calculateNeighborMines();
    }
    
    calculateNeighborMines() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CellType.MINE) continue;
                
                let count = 0;
                for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                        if (this.grid[nr][nc].type === CellType.MINE) {
                            count++;
                        }
                    }
                }
                this.grid[r][c].neighborMines = count;
                if (count > 0) {
                    this.grid[r][c].type = CellType.NUMBER;
                }
            }
        }
    }
    
    startGame() {
        this.state = GameState.PLAYING;
        this.startTime = Date.now();
        this.startTimer();
        this.isFirstClick = false;
    }
    
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            this.onTimerUpdate?.(this.elapsedSeconds);
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    revealCell(row, col) {
        const cell = this.grid[row][col];
        if (cell.state !== CellState.HIDDEN) return true;
        
        if (this.isFirstClick) {
            this.placeMines(row, col);
            this.startGame();
        }
        
        if (cell.type === CellType.MINE) {
            cell.state = CellState.REVEALED;
            this.revealedCount++;
            this.gameOver(false);
            return false;
        }
        
        cell.state = CellState.REVEALED;
        this.revealedCount++;
        this.onCellRevealed?.(row, col);
        
        console.log('revealCell: neighborMines =', cell.neighborMines);
        if (cell.neighborMines === 0) {
            this.revealNeighbors(row, col);
        }
        
        this.checkWin();
        return true;
    }
    
    revealNeighbors(row, col) {
        console.log('revealNeighbors 开始', row, col);
        const stack = [[row, col]];
        const visited = new Set();
        visited.add(`${row},${col}`);
        
        while (stack.length > 0) {
            const [r, c] = stack.pop();
            for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                const nr = r + dr;
                const nc = c + dc;
                const key = `${nr},${nc}`;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !visited.has(key)) {
                    visited.add(key);
                    const cell = this.grid[nr][nc];
                    if (cell.state === CellState.HIDDEN && cell.type !== CellType.MINE) {
                        cell.state = CellState.REVEALED;
                        this.revealedCount++;
                        this.onCellRevealed?.(nr, nc);
                        if (cell.neighborMines === 0) {
                            stack.push([nr, nc]);
                        }
                    }
                }
            }
        }
    }
    
    toggleFlag(row, col) {
        const cell = this.grid[row][col];
        if (cell.state === CellState.REVEALED) return;
        
        if (cell.state === CellState.HIDDEN) {
            cell.state = CellState.FLAGGED;
            this.flaggedCount++;
            this.minesRemaining--;
        } else if (cell.state === CellState.FLAGGED) {
            cell.state = CellState.HIDDEN;
            this.flaggedCount--;
            this.minesRemaining++;
        }
        
        this.onFlagUpdate?.(this.minesRemaining);
        this.checkWin();
    }
    
    checkWin() {
        const nonMineCells = this.rows * this.cols - this.totalMines;
        if (this.revealedCount === nonMineCells) {
            this.gameOver(true);
            return true;
        }
        
        let correctFlags = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell.type === CellType.MINE && cell.state === CellState.FLAGGED) {
                    correctFlags++;
                }
            }
        }
        if (correctFlags === this.totalMines && this.flaggedCount === this.totalMines) {
            this.gameOver(true);
            return true;
        }
        
        return false;
    }
    
    gameOver(win) {
        this.state = win ? GameState.WIN : GameState.LOSE;
        this.stopTimer();
        
        if (!win) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (cell.type === CellType.MINE && cell.state !== CellState.FLAGGED) {
                        cell.state = CellState.REVEALED;
                    }
                }
            }
        }
        
        this.onGameOver?.(win, this.elapsedSeconds);
    }
    
    reset() {
        this.stopTimer();
        this.state = GameState.READY;
        this.initGrid();
        this.onReset?.();
    }
    
    changeDifficulty(difficulty) {
        if (this.difficulty === difficulty) return;
        this.difficulty = difficulty;
        this.config = DIFFICULTIES[difficulty];
        this.rows = this.config.rows;
        this.cols = this.config.cols;
        this.totalMines = this.config.mines;
        this.reset();
    }
    
    getHint() {
        if (this.hintsUsed >= this.maxHints || this.state !== GameState.PLAYING) {
            return null;
        }
        
        const candidates = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell.state === CellState.HIDDEN && cell.type !== CellType.MINE) {
                    candidates.push({ row: r, col: c });
                }
            }
        }
        
        if (candidates.length === 0) {
            return null;
        }
        
        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        console.log('提示：', hint, '候选数量', candidates.length);
        this.hintsUsed++;
        this.onHintUpdate?.(this.hintsUsed);
        
        return hint;
    }
    
    onTimerUpdate = null;
    onFlagUpdate = null;
    onGameOver = null;
    onReset = null;
    onHintUpdate = null;
    onCellRevealed = null;
    onHintApplied = null;
    
    handleCellClick(row, col) {
        if (this.state === GameState.WIN || this.state === GameState.LOSE) return;
        this.revealCell(row, col);
    }
    
    handleCellRightClick(row, col) {
        if (this.state === GameState.WIN || this.state === GameState.LOSE) return;
        this.toggleFlag(row, col);
    }
    
    handleReset() {
        this.reset();
    }
    
    handleDifficultyChange(difficulty) {
        this.changeDifficulty(difficulty);
    }
    
    handleHint() {
        console.log('请求提示');
        const hint = this.getHint();
        if (hint) {
            console.log('触发提示回调', hint.row, hint.col);
            this.onHintApplied?.(hint.row, hint.col);
        } else {
            console.log('无可用提示');
        }
    }
}

// ========== ui.js ==========
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
        
        this.init();
    }
    
    init() {
        console.log('UI 初始化开始');
        const difficulty = this.difficultySelect.value;
        console.log('难度:', difficulty);
        this.game = new Game(difficulty);
        console.log('游戏实例创建完成');
        
        this.game.onTimerUpdate = (seconds) => this.updateTimer(seconds);
        this.game.onFlagUpdate = (minesRemaining) => this.updateMinesCount(minesRemaining);
        this.game.onGameOver = (win, seconds) => this.showGameOver(win, seconds);
        this.game.onReset = () => this.resetUI();
        this.game.onHintUpdate = (hintsUsed) => this.updateHintCount(hintsUsed);
        this.game.onCellRevealed = (row, col) => this.updateCellUI(row, col);
        this.game.onHintApplied = (row, col) => this.applyHint(row, col);
        
        this.resetButton.addEventListener('click', () => this.game.handleReset());
        this.difficultySelect.addEventListener('change', (e) => {
            this.game.handleDifficultyChange(e.target.value);
            this.renderGrid();
        });
        this.hintButton.addEventListener('click', () => this.game.handleHint());
        
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        console.log('开始渲染网格');
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        console.log('UI 初始化完成');
    }
    
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
    
    handleCellClick(row, col, isRightClick) {
        console.log(`点击格子 (${row}, ${col})，右键: ${isRightClick}`);
        if (isRightClick) {
            this.game.handleCellRightClick(row, col);
        } else {
            this.game.handleCellClick(row, col);
        }
        this.updateCellUI(row, col);
        this.updateGameStatus();
    }
    
    handleTouchStart(row, col, event) {
        const touch = event.touches[0];
        const startTime = Date.now();
        const touchTimeout = setTimeout(() => {
            this.game.handleCellRightClick(row, col);
            this.updateCellUI(row, col);
            this.updateGameStatus();
            event.preventDefault();
        }, 500);
        
        const touchEndHandler = () => {
            clearTimeout(touchTimeout);
            if (Date.now() - startTime < 500) {
                this.game.handleCellClick(row, col);
                this.updateCellUI(row, col);
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
    
    updateCellUI(row, col) {
        console.log('updateCellUI', row, col);
        const cell = this.game.grid[row][col];
        const cellElement = this.gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!cellElement) return;
        
        cellElement.className = 'cell';
        cellElement.textContent = '';
        
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
    
    applyHint(row, col) {
        console.log('应用提示高亮', row, col);
        const cellElement = this.gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!cellElement) return;
        
        cellElement.classList.add('hinted');
        
        setTimeout(() => {
            cellElement.classList.remove('hinted');
        }, 1000);
    }
    
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
        
        this.updateResetButtonFace();
    }
    
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
    
    updateMinesCount(count) {
        this.minesCountElement.textContent = padZero(Math.max(0, count), 3);
    }
    
    updateTimer(seconds) {
        this.timerElement.textContent = padZero(seconds, 3);
    }
    
    updateHintCount(hintsUsed) {
        const remaining = this.game.maxHints - hintsUsed;
        this.hintCountElement.textContent = remaining;
        this.hintButton.disabled = remaining <= 0;
    }
    
    showGameOver(win, seconds) {
        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                this.updateCellUI(r, c);
            }
        }
        
        this.updateGameStatus();
        this.hintButton.disabled = true;
        
        if (win) {
            this.showConfetti();
        }
    }
    
    resetUI() {
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        this.hintButton.disabled = false;
    }
    
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
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 已加载，开始初始化 UI');
    new UI();
});