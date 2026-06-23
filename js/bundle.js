/* ============================
   utils.js - 工具函数模块
   ============================ */

/**
 * 生成 min 到 max 之间的随机整数（包含两端）
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 从数组中随机选择一个元素
 */
function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

/**
 * 生成不重复的随机索引列表
 * @param {number} count 需要生成的个数
 * @param {number} max 最大索引（0~max-1）
 * @returns {number[]} 不重复的索引数组
 */
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

/**
 * 深度复制二维数组
 */
function deepCopy2D(grid) {
    return grid.map(row => [...row]);
}

/**
 * 格式化数字为指定位数的字符串，前面补零
 * @param {number} num 数字
 * @param {number} digits 位数
 */
function padZero(num, digits = 3) {
    return String(num).padStart(digits, '0');
}

/**
 * 防抖函数
 */
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * 节流函数
 */
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

/**
 * 检测移动设备
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 添加事件监听器，支持 passive 选项
 */
function addEventListener(el, event, handler, options = {}) {
    const passive = options.passive ?? true;
    el.addEventListener(event, handler, { passive, ...options });
    return () => el.removeEventListener(event, handler, { passive, ...options });
}

/**
 * 创建 DOM 元素
 */
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

/**
 * 获取相邻格子的偏移量（8方向）
 */
const NEIGHBOR_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// 全局暴露工具
window.MinesweeperUtils = {
    randomInt,
    randomChoice,
    randomUniqueIndices,
    deepCopy2D,
    padZero,
    debounce,
    throttle,
    isMobile,
    addEventListener,
    createElement,
    NEIGHBOR_OFFSETS
};


/* ============================
   stats.js - 游戏数据统计模块（修复连胜计算）
   ============================ */

const STORAGE_KEY = 'minesweeper_stats';
const MAX_RECORDS = 1000;

/**
 * 游戏记录结构
 * @typedef {Object} GameRecord
 * @property {number} timestamp - 时间戳（毫秒）
 * @property {string} difficulty - 难度 ('beginner', 'intermediate', 'expert')
 * @property {boolean} win - 是否胜利
 * @property {number} time - 游戏用时（秒）
 */

/**
 * 获取所有游戏记录
 * @returns {GameRecord[]}
 */
function getGameRecords() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        const records = JSON.parse(data);
        return Array.isArray(records) ? records : [];
    } catch (error) {
        console.error('读取游戏记录失败:', error);
        return [];
    }
}

/**
 * 添加一条游戏记录
 * @param {string} difficulty - 难度
 * @param {boolean} win - 是否胜利
 * @param {number} time - 游戏用时（秒）
 */
function addGameRecord(difficulty, win, time) {
    const records = getGameRecords();
    const record = {
        timestamp: Date.now(),
        difficulty,
        win,
        time
    };
    records.push(record);
    if (records.length > MAX_RECORDS) {
        records.splice(0, records.length - MAX_RECORDS);
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
        console.error('保存游戏记录失败:', error);
    }
}

/**
 * 清空所有游戏记录
 */
function clearGameRecords() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * 统计信息结构
 * @typedef {Object} DifficultyStats
 * @property {number} total - 总游戏场次
 * @property {number} wins - 胜利场次
 * @property {number} losses - 失败场次
 * @property {number} winRate - 胜率（0-100）
 * @property {number} currentStreak - 当前连胜/连败次数（正数为连胜，负数为连败）
 * @property {number} maxStreak - 最长连胜
 * @property {number} maxLosingStreak - 最长连败
 * @property {number} bestTime - 最佳用时（秒），0表示暂无
 * @property {number} averageTime - 平均用时（秒），仅统计胜利局
 */

/**
 * 计算指定难度的统计信息 - 【修复】连胜/连败追溯算法
 * @param {string} difficulty - 难度 ('beginner', 'intermediate', 'expert')，或 'all' 表示全部难度
 * @returns {DifficultyStats}
 */
function getStats(difficulty = 'all') {
    const records = getGameRecords();
    let filtered = records;
    if (difficulty !== 'all') {
        filtered = records.filter(r => r.difficulty === difficulty);
    }
    
    const total = filtered.length;
    const wins = filtered.filter(r => r.win).length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    // 计算最大连胜/连败
    let maxStreak = 0;
    let maxLosingStreak = 0;
    let tempStreak = 0;
    let tempLosingStreak = 0;
    
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    for (const record of sorted) {
        if (record.win) {
            tempStreak++;
            tempLosingStreak = 0;
            if (tempStreak > maxStreak) maxStreak = tempStreak;
        } else {
            tempLosingStreak++;
            tempStreak = 0;
            if (tempLosingStreak > maxLosingStreak) maxLosingStreak = tempLosingStreak;
        }
    }
    
    // 【修复】当前连胜/连败：从最新记录开始往前追溯
    let currentStreak = 0;
    if (sorted.length > 0) {
        let streak = 0;
        let isWin = null;
        for (let i = sorted.length - 1; i >= 0; i--) {
            const win = sorted[i].win;
            if (isWin === null) {
                isWin = win;
                streak = win ? 1 : -1;
            } else if (win === isWin) {
                streak += win ? 1 : -1;
            } else {
                break;
            }
        }
        currentStreak = streak;
    }
    
    // 最佳用时和平均用时（仅胜利局）
    const winRecords = filtered.filter(r => r.win);
    let bestTime = 0;
    let totalTime = 0;
    if (winRecords.length > 0) {
        bestTime = Math.min(...winRecords.map(r => r.time));
        totalTime = winRecords.reduce((sum, r) => sum + r.time, 0);
    }
    const averageTime = winRecords.length > 0 ? Math.round(totalTime / winRecords.length) : 0;
    
    return {
        total,
        wins,
        losses,
        winRate,
        currentStreak,
        maxStreak,
        maxLosingStreak,
        bestTime,
        averageTime
    };
}

/**
 * 获取所有难度的统计摘要
 * @returns {Object.<string, DifficultyStats>}
 */
function getAllDifficultyStats() {
    const difficulties = ['beginner', 'intermediate', 'expert', 'all'];
    const result = {};
    for (const diff of difficulties) {
        result[diff] = getStats(diff);
    }
    return result;
}

/**
 * 格式化时间（秒）为 MM:SS
 * @param {number} seconds 
 * @returns {string}
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化连胜显示
 * @param {number} streak 
 * @returns {string}
 */
function formatStreak(streak) {
    if (streak > 0) return `${streak} 连胜`;
    if (streak < 0) return `${-streak} 连败`;
    return '无记录';
}

// 全局暴露
window.MinesweeperStats = {
    getGameRecords,
    addGameRecord,
    clearGameRecords,
    getStats,
    getAllDifficultyStats,
    formatTime,
    formatStreak
};


/* ============================
   game.js - 游戏核心逻辑（含无猜模式）
   ============================ */

// 难度配置
const DIFFICULTIES = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
};

// 游戏状态枚举
const GameState = {
    READY: 'ready',
    PLAYING: 'playing',
    WIN: 'win',
    LOSE: 'lose'
};

// 格子状态枚举
const CellState = {
    HIDDEN: 'hidden',
    REVEALED: 'revealed',
    FLAGGED: 'flagged',
    QUESTION: 'question'
};

// 格子类型
const CellType = {
    EMPTY: 'empty',
    NUMBER: 'number',
    MINE: 'mine'
};

// ============================================================
// 【新增】无猜模式推理引擎 (Solver)
// ============================================================
class MinesweeperSolver {
    /**
     * 检查给定地图从起始位置是否可完全推理（无猜）
     * @param {Array} grid - 二维格子数组
     * @param {number} rows - 行数
     * @param {number} cols - 列数
     * @param {number} startRow - 起始行
     * @param {number} startCol - 起始列
     * @returns {boolean} 是否可完全推理
     */
    static isSolvable(grid, rows, cols, startRow, startCol) {
        // 深拷贝当前状态
        const state = grid.map(row => row.map(cell => ({
            type: cell.type,
            state: cell.state,
            neighborMines: cell.neighborMines,
            row: cell.row,
            col: cell.col
        })));
        
        // 翻开起始位置
        if (state[startRow][startCol].type === CellType.MINE) return false;
        state[startRow][startCol].state = CellState.REVEALED;
        
        let revealedCount = 1;
        let changed = true;
        const totalSafe = rows * cols - this.countMines(state, rows, cols);
        
        let iterations = 0;
        const maxIterations = rows * cols * 2;
        
        while (changed && revealedCount < totalSafe && iterations < maxIterations) {
            changed = false;
            iterations++;
            
            const result = this.applyInference(state, rows, cols);
            if (result.revealed > 0) {
                revealedCount += result.revealed;
                changed = true;
            }
            if (result.flagged > 0) {
                changed = true;
            }
            
            if (!changed) {
                const advancedResult = this.applyAdvancedInference(state, rows, cols);
                if (advancedResult.revealed > 0) {
                    revealedCount += advancedResult.revealed;
                    changed = true;
                }
                if (advancedResult.flagged > 0) {
                    changed = true;
                }
            }
        }
        
        return revealedCount === totalSafe;
    }
    
    static countMines(grid, rows, cols) {
        let count = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].type === CellType.MINE) count++;
            }
        }
        return count;
    }
    
    static applyInference(grid, rows, cols) {
        let revealed = 0;
        let flagged = 0;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c];
                if (cell.state !== CellState.REVEALED || cell.type !== CellType.NUMBER) continue;
                
                const neighbors = this.getNeighbors(grid, rows, cols, r, c);
                const hidden = neighbors.filter(n => n.state === CellState.HIDDEN);
                const flaggedNeighbors = neighbors.filter(n => n.state === CellState.FLAGGED);
                
                const remainingMines = cell.neighborMines - flaggedNeighbors.length;
                
                if (hidden.length === remainingMines && remainingMines > 0) {
                    for (const n of hidden) {
                        if (n.state === CellState.HIDDEN && n.type === CellType.MINE) {
                            n.state = CellState.FLAGGED;
                            flagged++;
                        }
                    }
                }
                
                if (remainingMines === 0) {
                    for (const n of hidden) {
                        if (n.state === CellState.HIDDEN && n.type !== CellType.MINE) {
                            n.state = CellState.REVEALED;
                            revealed++;
                        }
                    }
                }
            }
        }
        
        return { revealed, flagged };
    }
    
    static applyAdvancedInference(grid, rows, cols) {
        let revealed = 0;
        let flagged = 0;
        
        const constraints = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c];
                if (cell.state !== CellState.REVEALED || cell.type !== CellType.NUMBER) continue;
                
                const neighbors = this.getNeighbors(grid, rows, cols, r, c);
                const hidden = neighbors.filter(n => n.state === CellState.HIDDEN);
                const flaggedNeighbors = neighbors.filter(n => n.state === CellState.FLAGGED);
                
                const remainingMines = cell.neighborMines - flaggedNeighbors.length;
                if (hidden.length > 0 && remainingMines >= 0) {
                    constraints.push({
                        cells: hidden,
                        mines: remainingMines,
                        row: r,
                        col: c
                    });
                }
            }
        }
        
        for (let i = 0; i < constraints.length; i++) {
            for (let j = i + 1; j < constraints.length; j++) {
                const a = constraints[i];
                const b = constraints[j];
                
                const aSet = new Set(a.cells.map(c => `${c.row},${c.col}`));
                const bSet = new Set(b.cells.map(c => `${c.row},${c.col}`));
                
                const intersection = a.cells.filter(c => bSet.has(`${c.row},${c.col}`));
                const aOnly = a.cells.filter(c => !bSet.has(`${c.row},${c.col}`));
                const bOnly = b.cells.filter(c => !aSet.has(`${c.row},${c.col}`));
                
                if (aOnly.length > 0 && intersection.length === b.cells.length) {
                    const aOnlyMines = a.mines - b.mines;
                    if (aOnlyMines === 0) {
                        for (const n of aOnly) {
                            if (n.state === CellState.HIDDEN && n.type !== CellType.MINE) {
                                n.state = CellState.REVEALED;
                                revealed++;
                            }
                        }
                    } else if (aOnlyMines === aOnly.length) {
                        for (const n of aOnly) {
                            if (n.state === CellState.HIDDEN && n.type === CellType.MINE) {
                                n.state = CellState.FLAGGED;
                                flagged++;
                            }
                        }
                    }
                }
                
                if (bOnly.length > 0 && intersection.length === a.cells.length) {
                    const bOnlyMines = b.mines - a.mines;
                    if (bOnlyMines === 0) {
                        for (const n of bOnly) {
                            if (n.state === CellState.HIDDEN && n.type !== CellType.MINE) {
                                n.state = CellState.REVEALED;
                                revealed++;
                            }
                        }
                    } else if (bOnlyMines === bOnly.length) {
                        for (const n of bOnly) {
                            if (n.state === CellState.HIDDEN && n.type === CellType.MINE) {
                                n.state = CellState.FLAGGED;
                                flagged++;
                            }
                        }
                    }
                }
            }
        }
        
        return { revealed, flagged };
    }
    
    static getNeighbors(grid, rows, cols, row, col) {
        const result = [];
        const offsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of offsets) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                result.push(grid[nr][nc]);
            }
        }
        return result;
    }
}

// ============================================================
// 【修改】游戏核心类
// ============================================================
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
        this.noGuessMode = true;
        this._generationAttempts = 0;
        
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
        this._generationAttempts = 0;
        this.stopTimer();
    }
    
    placeMines(safeRow, safeCol) {
        if (this.noGuessMode) {
            const success = this.generateNoGuessMap(safeRow, safeCol);
            if (!success) {
                console.warn('无猜模式生成失败，回退到普通生成');
                this.placeMinesRandom(safeRow, safeCol);
            }
        } else {
            this.placeMinesRandom(safeRow, safeCol);
        }
        this.calculateNeighborMines();
    }
    
    generateNoGuessMap(safeRow, safeCol) {
        const maxAttempts = 200;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            this._generationAttempts = attempts;
            
            const gridCopy = [];
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
                gridCopy.push(row);
            }
            
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
            const availableIndices = [];
            for (let i = 0; i < totalCells; i++) {
                if (!safeCells.has(i)) {
                    availableIndices.push(i);
                }
            }
            
            if (availableIndices.length < this.totalMines) continue;
            
            const shuffled = [...availableIndices];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const mineIndices = shuffled.slice(0, this.totalMines);
            
            for (const idx of mineIndices) {
                const r = Math.floor(idx / this.cols);
                const c = idx % this.cols;
                gridCopy[r][c].type = CellType.MINE;
            }
            
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (gridCopy[r][c].type === CellType.MINE) continue;
                    let count = 0;
                    for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                            if (gridCopy[nr][nc].type === CellType.MINE) count++;
                        }
                    }
                    gridCopy[r][c].neighborMines = count;
                    if (count > 0) {
                        gridCopy[r][c].type = CellType.NUMBER;
                    }
                }
            }
            
            const solvable = MinesweeperSolver.isSolvable(
                gridCopy, this.rows, this.cols, safeRow, safeCol
            );
            
            if (solvable) {
                this.grid = gridCopy;
                console.log(`✅ 无猜地图生成成功，尝试次数: ${attempts}`);
                return true;
            }
            
            if (attempts % 50 === 0) {
                console.log(`⏳ 无猜模式生成中... 已尝试 ${attempts} 次`);
            }
        }
        
        console.warn(`❌ 无猜模式生成失败，已尝试 ${maxAttempts} 次`);
        return false;
    }
    
    placeMinesRandom(safeRow, safeCol) {
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
        let mineIndices = randomUniqueIndices(this.totalMines, totalCells)
            .filter(idx => !safeCells.has(idx));
        
        while (mineIndices.length < this.totalMines) {
            const idx = randomInt(0, totalCells - 1);
            if (!safeCells.has(idx) && !mineIndices.includes(idx)) {
                mineIndices.push(idx);
            }
        }
        
        for (const idx of mineIndices) {
            const r = Math.floor(idx / this.cols);
            const c = idx % this.cols;
            this.grid[r][c].type = CellType.MINE;
        }
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
                        if (this.grid[nr][nc].type === CellType.MINE) count++;
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
        
        if (cell.neighborMines === 0) {
            this.revealNeighbors(row, col);
        }
        
        this.checkWin();
        return true;
    }
    
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
        
        addGameRecord(this.difficulty, win, this.elapsedSeconds);
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
        
        if (candidates.length === 0) return null;
        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        this.hintsUsed++;
        this.onHintUpdate?.(this.hintsUsed);
        return hint;
    }
    
    // 事件回调
    onTimerUpdate = null;
    onFlagUpdate = null;
    onGameOver = null;
    onReset = null;
    onHintUpdate = null;
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
        const hint = this.getHint();
        if (hint) {
            this.onHintApplied?.(hint.row, hint.col);
        }
    }
}

// 全局暴露
window.MinesweeperGame = {
    Game,
    DIFFICULTIES,
    GameState,
    CellState,
    CellType,
    MinesweeperSolver
};


/* ============================
   ui.js - 用户界面（修复提示+连胜展示）
   ============================ */

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
        
        this.streakIconElement = document.createElement('i');
        this.streakIconElement.classList.add('fas');
        const parent = this.streakCounterElement?.parentNode;
        if (parent) {
            parent.appendChild(this.streakIconElement);
        }
        
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
        
        this.game.onTimerUpdate = (seconds) => this.updateTimer(seconds);
        this.game.onFlagUpdate = (minesRemaining) => this.updateMinesCount(minesRemaining);
        this.game.onGameOver = (win, seconds) => this.showGameOver(win, seconds);
        this.game.onReset = () => this.resetUI();
        this.game.onHintUpdate = (hintsUsed) => this.updateHintCount(hintsUsed);
        this.game.onHintApplied = (row, col) => {
            this.highlightHint(row, col);
        };
        
        this.resetButton.addEventListener('click', () => this.game.handleReset());
        this.difficultySelect.addEventListener('change', (e) => {
            this.game.handleDifficultyChange(e.target.value);
            this.renderGrid();
            this.updateStatsDisplay();
        });
        this.hintButton.addEventListener('click', () => this.game.handleHint());
        this.statsResetButton.addEventListener('click', () => this.clearStats());
        this.statsToggleBtn.addEventListener('click', () => this.toggleStatsDetails());
        
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        console.log('开始渲染网格');
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        this.updateStatsDisplay();
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
        if (isRightClick) {
            this.game.handleCellRightClick(row, col);
        } else {
            this.game.handleCellClick(row, col);
        }
        this.renderGrid();
        this.updateGameStatus();
        if (this.game.state === GameState.WIN || this.game.state === GameState.LOSE) {
            this.updateStatsDisplay();
        }
    }
    
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
    
    highlightHint(row, col) {
        if (this._hintedCell) {
            this._hintedCell.classList.remove('hinted');
        }
        
        const cellElement = this.gridElement.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );
        if (!cellElement) return;
        
        cellElement.classList.add('hinted');
        this._hintedCell = cellElement;
        
        if (this._hintTimeout) {
            clearTimeout(this._hintTimeout);
        }
        this._hintTimeout = setTimeout(() => {
            if (this._hintedCell) {
                this._hintedCell.classList.remove('hinted');
                this._hintedCell = null;
            }
            this._hintTimeout = null;
        }, 3000);
        
        this.updateGameStatus(`💡 提示: 点击 (${row + 1}, ${col + 1}) 位置安全`);
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
        this.renderGrid();
        this.updateGameStatus();
        this.hintButton.disabled = true;
        if (win) {
            this.showConfetti();
        }
        this.updateStatsDisplay();
    }
    
    resetUI() {
        this.updateMinesCount(this.game.minesRemaining);
        this.updateTimer(0);
        this.updateHintCount(0);
        this.renderGrid();
        this.updateGameStatus('点击格子开始游戏');
        this.hintButton.disabled = false;
        this.updateStatsDisplay();
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
        
        this.statsStreakSummaryElement.textContent = formatStreak(stats.currentStreak);
        this.statsBestTimeSummaryElement.textContent = stats.bestTime > 0 ? formatTime(stats.bestTime) : '--:--';
        
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

    clearStats() {
        if (confirm('确定要清空所有游戏统计记录吗？此操作不可撤销。')) {
            clearGameRecords();
            this.updateStatsDisplay();
            alert('统计记录已清空。');
        }
    }

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