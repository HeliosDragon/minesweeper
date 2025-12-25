/* 游戏核心逻辑模块 */

import { randomUniqueIndices, padZero, NEIGHBOR_OFFSETS } from './utils.js';

// 难度配置
const DIFFICULTIES = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
};

// 游戏状态枚举
const GameState = {
    READY: 'ready',       // 准备开始
    PLAYING: 'playing',   // 进行中
    WIN: 'win',           // 胜利
    LOSE: 'lose'          // 失败
};

// 格子状态枚举
const CellState = {
    HIDDEN: 'hidden',     // 未翻开
    REVEALED: 'revealed', // 已翻开
    FLAGGED: 'flagged',   // 标记地雷
    QUESTION: 'question'  // 标记问号（未实现）
};

// 格子类型
const CellType = {
    EMPTY: 'empty',
    NUMBER: 'number',
    MINE: 'mine'
};

/**
 * 游戏核心类
 */
export class Game {
    constructor(difficulty = 'intermediate') {
        this.difficulty = difficulty;
        this.config = DIFFICULTIES[difficulty];
        this.rows = this.config.rows;
        this.cols = this.config.cols;
        this.totalMines = this.config.mines;
        
        this.state = GameState.READY;
        this.grid = null;          // 二维数组，每个元素为格子对象
        this.revealedCount = 0;    // 已翻开的格子数
        this.flaggedCount = 0;     // 标记的格子数
        this.minesRemaining = this.totalMines;
        this.hintsUsed = 0;        // 已使用提示次数
        this.maxHints = 3;         // 最大提示次数
        
        this.startTime = null;     // 游戏开始时间戳
        this.timerInterval = null; // 计时器引用
        this.elapsedSeconds = 0;   // 经过秒数
        
        this.isFirstClick = true;  // 是否为第一次点击（用于确保第一次点击不是地雷）
        
        // 绑定方法
        this.handleCellClick = this.handleCellClick.bind(this);
        this.handleCellRightClick = this.handleCellRightClick.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.handleDifficultyChange = this.handleDifficultyChange.bind(this);
        this.handleHint = this.handleHint.bind(this);
        
        // 初始化网格
        this.initGrid();
    }
    
    /**
     * 初始化空白网格
     */
    initGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    type: CellType.EMPTY,
                    state: CellState.HIDDEN,
                    neighborMines: 0,  // 周围地雷数
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
    
    /**
     * 布置地雷（排除第一个点击的格子及其周围）
     * @param {number} safeRow 安全行
     * @param {number} safeCol 安全列
     */
    placeMines(safeRow, safeCol) {
        // 计算安全区域（包括点击格子及其周围8格）
        const safeCells = new Set();
        for (const [dr, dc] of NEIGHBOR_OFFSETS) {
            const nr = safeRow + dr;
            const nc = safeCol + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                safeCells.add(nr * this.cols + nc);
            }
        }
        safeCells.add(safeRow * this.cols + safeCol);
        
        // 生成地雷位置
        const totalCells = this.rows * this.cols;
        const mineIndices = randomUniqueIndices(this.totalMines, totalCells).filter(
            idx => !safeCells.has(idx)
        );
        
        // 放置地雷
        for (const idx of mineIndices) {
            const r = Math.floor(idx / this.cols);
            const c = idx % this.cols;
            this.grid[r][c].type = CellType.MINE;
        }
        
        // 计算每个格子的周围地雷数
        this.calculateNeighborMines();
    }
    
    /**
     * 计算每个格子的周围地雷数
     */
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
    
    /**
     * 开始游戏（第一次点击时调用）
     */
    startGame() {
        this.state = GameState.PLAYING;
        this.startTime = Date.now();
        this.startTimer();
        this.isFirstClick = false;
    }
    
    /**
     * 开始计时器
     */
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            this.onTimerUpdate?.(this.elapsedSeconds);
        }, 1000);
    }
    
    /**
     * 停止计时器
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    /**
     * 翻开格子
     * @param {number} row 行
     * @param {number} col 列
     * @returns {boolean} 是否允许翻开（游戏是否继续）
     */
    revealCell(row, col) {
        const cell = this.grid[row][col];
        if (cell.state !== CellState.HIDDEN) return true;
        
        // 第一次点击时布置地雷
        if (this.isFirstClick) {
            this.placeMines(row, col);
            this.startGame();
        }
        
        // 如果是地雷，游戏结束
        if (cell.type === CellType.MINE) {
            cell.state = CellState.REVEALED;
            this.revealedCount++;
            this.gameOver(false);
            return false;
        }
        
        // 翻开当前格子
        cell.state = CellState.REVEALED;
        this.revealedCount++;
        
        // 如果是空白格子，递归翻开周围
        if (cell.neighborMines === 0) {
            this.revealNeighbors(row, col);
        }
        
        // 检查是否胜利
        this.checkWin();
        
        return true;
    }
    
    /**
     * 递归翻开周围空白格子
     */
    revealNeighbors(row, col) {
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
                        if (cell.neighborMines === 0) {
                            stack.push([nr, nc]);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * 标记/取消标记格子
     */
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
    
    /**
     * 检查是否胜利
     */
    checkWin() {
        // 条件1: 所有非地雷格子都已翻开
        const nonMineCells = this.rows * this.cols - this.totalMines;
        if (this.revealedCount === nonMineCells) {
            this.gameOver(true);
            return true;
        }
        
        // 条件2: 所有地雷都被正确标记（可选）
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
    
    /**
     * 游戏结束
     * @param {boolean} win 是否胜利
     */
    gameOver(win) {
        this.state = win ? GameState.WIN : GameState.LOSE;
        this.stopTimer();
        
        // 如果失败，显示所有地雷
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
    
    /**
     * 重置游戏
     */
    reset() {
        this.stopTimer();
        this.state = GameState.READY;
        this.initGrid();
        this.onReset?.();
    }
    
    /**
     * 更改难度
     */
    changeDifficulty(difficulty) {
        if (this.difficulty === difficulty) return;
        this.difficulty = difficulty;
        this.config = DIFFICULTIES[difficulty];
        this.rows = this.config.rows;
        this.cols = this.config.cols;
        this.totalMines = this.config.mines;
        this.reset();
    }
    
    /**
     * 获取提示（返回一个安全格子的坐标，如果找不到则返回null）
     */
    getHint() {
        if (this.hintsUsed >= this.maxHints || this.state !== GameState.PLAYING) {
            return null;
        }
        
        // 策略：找一个未翻开且不是地雷的格子
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
        
        // 随机选择一个
        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        this.hintsUsed++;
        this.onHintUpdate?.(this.hintsUsed);
        
        return hint;
    }
    
    /**
     * 事件回调占位
     */
    onTimerUpdate = null;          // (seconds) => void
    onFlagUpdate = null;           // (minesRemaining) => void
    onGameOver = null;             // (win, seconds) => void
    onReset = null;                // () => void
    onHintUpdate = null;           // (hintsUsed) => void
    
    /**
     * 处理格子点击（代理方法）
     */
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
        const hint = this.getHint();
        if (hint) {
            this.onHintApplied?.(hint.row, hint.col);
        }
    }
}

// 导出配置
export { DIFFICULTIES, GameState, CellState, CellType };