/* 工具函数模块 */

/**
 * 生成 min 到 max 之间的随机整数（包含两端）
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 从数组中随机选择一个元素
 */
export function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

/**
 * 生成不重复的随机索引列表
 * @param {number} count 需要生成的个数
 * @param {number} max 最大索引（0~max-1）
 * @returns {number[]} 不重复的索引数组
 */
export function randomUniqueIndices(count, max) {
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
export function deepCopy2D(grid) {
    return grid.map(row => [...row]);
}

/**
 * 格式化数字为指定位数的字符串，前面补零
 * @param {number} num 数字
 * @param {number} digits 位数
 */
export function padZero(num, digits = 3) {
    return String(num).padStart(digits, '0');
}

/**
 * 防抖函数
 */
export function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
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
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 添加事件监听器，支持 passive 选项
 */
export function addEventListener(el, event, handler, options = {}) {
    const passive = options.passive ?? true;
    el.addEventListener(event, handler, { passive, ...options });
    return () => el.removeEventListener(event, handler, { passive, ...options });
}

/**
 * 创建 DOM 元素
 */
export function createElement(tag, className, attributes = {}) {
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
export const NEIGHBOR_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];/* 游戏数据统计模块 */

const STORAGE_KEY = 'minesweeper_stats';
const MAX_RECORDS = 1000; // 最多保存的记录数

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
export function getGameRecords() {
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
export function addGameRecord(difficulty, win, time) {
    const records = getGameRecords();
    const record = {
        timestamp: Date.now(),
        difficulty,
        win,
        time
    };
    records.push(record);
    
    // 保留最近 MAX_RECORDS 条记录
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
export function clearGameRecords() {
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
 * 计算指定难度的统计信息
 * @param {string} difficulty - 难度 ('beginner', 'intermediate', 'expert')，或 'all' 表示全部难度
 * @returns {DifficultyStats}
 */
export function getStats(difficulty = 'all') {
    const records = getGameRecords();
    let filtered = records;
    if (difficulty !== 'all') {
        filtered = records.filter(r => r.difficulty === difficulty);
    }
    
    const total = filtered.length;
    const wins = filtered.filter(r => r.win).length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    // 计算连胜/连败
    let currentStreak = 0;
    let maxStreak = 0;
    let maxLosingStreak = 0;
    let tempStreak = 0;
    let tempLosingStreak = 0;
    
    // 按时间戳排序（从旧到新）
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
    
    // 当前连胜/连败：从最新记录开始往前追溯
    if (sorted.length > 0) {
        let streak = 0;
        let isWin = null;
        // 逆序遍历
        for (let i = sorted.length - 1; i >= 0; i--) {
            const win = sorted[i].win;
            if (isWin === null) {
                isWin = win;
                streak = win ? 1 : -1;
            } else if ((win && isWin > 0) || (!win && isWin < 0)) {
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
export function getAllDifficultyStats() {
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
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化连胜显示
 * @param {number} streak 
 * @returns {string}
 */
export function formatStreak(streak) {
    if (streak > 0) return `${streak} 连胜`;
    if (streak < 0) return `${-streak} 连败`;
    return '无记录';
}

// 导出默认对象（可选）
export default {
    getGameRecords,
    addGameRecord,
    clearGameRecords,
    getStats,
    getAllDifficultyStats,
    formatTime,
    formatStreak
};/* 游戏核心逻辑模块 */

import { randomUniqueIndices, padZero, NEIGHBOR_OFFSETS } from './utils.js';
import { addGameRecord } from './stats.js';

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
        
        // 记录游戏结果
        addGameRecord(this.difficulty, win, this.elapsedSeconds);
        
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
export { DIFFICULTIES, GameState, CellState, CellType };/* 用户界面模块 */

import { Game, DIFFICULTIES, GameState, CellState, CellType } from './game.js';
import { padZero, createElement, addEventListener } from './utils.js';
import { getStats, formatTime, formatStreak, clearGameRecords } from './stats.js';

export class UI {
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
        this.updateCellUI(row, col);
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
}

// 初始化UI
document.addEventListener('DOMContentLoaded', () => {
    new UI();
});