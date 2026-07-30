// ========== js/utils.js ==========
/* 工具函数模块 */

/**
 * 生成 min 到 max 之间的随机整数（包含两端）
 */function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 从数组中随机选择一个元素
 */function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

/**
 * 生成不重复的随机索引列表
 * @param {number} count 需要生成的个数
 * @param {number} max 最大索引（0~max-1）
 * @returns {number[]} 不重复的索引数组
 */function randomUniqueIndices(count, max) {
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
 */function deepCopy2D(grid) {
    return grid.map(row => [...row]);
}

/**
 * 格式化数字为指定位数的字符串，前面补零
 * @param {number} num 数字
 * @param {number} digits 位数
 */function padZero(num, digits = 3) {
    return String(num).padStart(digits, '0');
}

/**
 * 防抖函数
 */function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * 节流函数
 */function throttle(func, limit) {
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
 */function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 添加事件监听器，支持 passive 选项
 */function addEventListener(el, event, handler, options = {}) {
    const passive = options.passive ?? true;
    el.addEventListener(event, handler, { passive, ...options });
    return () => el.removeEventListener(event, handler, { passive, ...options });
}

/**
 * 创建 DOM 元素
 */function createElement(tag, className, attributes = {}) {
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
 */const NEIGHBOR_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// ========== js/game.js ==========
/* 游戏核心逻辑模块 */

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
    FLAGGED: 'flagged'    // 标记地雷
};

// 格子类型
const CellType = {
    EMPTY: 'empty',
    NUMBER: 'number',
    MINE: 'mine'
};

// 计时器上限（秒）
const MAX_TIME = 999;

/**
 * 游戏核心类
 */class Game {
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
                    col: c,
                    exploded: false,   // 是否为踩中的雷
                    wrongFlag: false   // 是否为错误标记
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
        safeCells.add(safeRow * this.cols + safeCol);
        for (const [dr, dc] of NEIGHBOR_OFFSETS) {
            const nr = safeRow + dr;
            const nc = safeCol + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                safeCells.add(nr * this.cols + nc);
            }
        }

        // 从非安全区中构建候选列表，再随机抽取
        const candidates = [];
        for (let i = 0; i < this.rows * this.cols; i++) {
            if (!safeCells.has(i)) candidates.push(i);
        }

        // Fisher-Yates 洗牌后取前 totalMines 个
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const mineIndices = candidates.slice(0, this.totalMines);

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
     * 清空网格用于重新生成开局（保留难度配置）
     */
    clearGridForRetry() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                cell.type = CellType.EMPTY;
                cell.state = CellState.HIDDEN;
                cell.neighborMines = 0;
                cell.exploded = false;
                cell.wrongFlag = false;
            }
        }
        this.revealedCount = 0;
        this.flaggedCount = 0;
        this.minesRemaining = this.totalMines;
    }

    /**
     * 纯翻开（不触发回调与胜负判定），用于生成开局时试探性地展开
     */
    revealFrom(row, col) {
        const start = this.grid[row][col];
        start.state = CellState.REVEALED;
        this.revealedCount++;
        if (start.neighborMines !== 0) return;

        const stack = [[row, col]];
        const visited = new Set([`${row},${col}`]);
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
     * 分析当前局面是否存在「逻辑可推导」的格子（不靠猜测）
     * 基础规则：数字 N 的隐藏邻居数 == N → 全为雷；已插旗数 == N → 隐藏邻居全安全。
     * 子集规则：数字 a 的隐藏邻居集合 ⊇ 数字 b 的隐藏邻居集合时，
     *   - 若 N(a)-N(b) == |差集| → 差集全为雷
     *   - 若 N(a) == N(b) → 差集全安全
     * @returns {{move:boolean, safe:boolean, mine:boolean}}
     */
    analyzeLogical() {
        const numbers = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell.state !== CellState.REVEALED || cell.type !== CellType.NUMBER) continue;
                const hidden = [];
                let flagged = 0;
                for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
                    const n = this.grid[nr][nc];
                    if (n.state === CellState.HIDDEN) hidden.push(`${nr},${nc}`);
                    else if (n.state === CellState.FLAGGED) flagged++;
                }
                numbers.push({ r, c, value: cell.neighborMines, hidden: new Set(hidden), hiddenCount: hidden.length, flagged });
            }
        }

        // 基础规则
        for (const n of numbers) {
            if (n.hiddenCount === 0) continue;
            if (n.flagged === n.value) return { move: true, safe: true, mine: false };
            if (n.flagged + n.hiddenCount === n.value) return { move: true, safe: false, mine: true };
        }

        // 子集规则
        for (let i = 0; i < numbers.length; i++) {
            for (let j = 0; j < numbers.length; j++) {
                if (i === j) continue;
                const a = numbers[i];
                const b = numbers[j];
                if (a.hiddenCount <= b.hiddenCount) continue;
                let superset = true;
                for (const h of b.hidden) {
                    if (!a.hidden.has(h)) { superset = false; break; }
                }
                if (!superset) continue;
                const extra = a.hiddenCount - b.hiddenCount;
                const dv = a.value - b.value;
                if (dv === extra) return { move: true, safe: false, mine: true };
                if (dv === 0) return { move: true, safe: true, mine: false };
            }
        }

        return { move: false, safe: false, mine: false };
    }

    /**
     * 是否存在逻辑可推导的下一步
     */
    hasLogicalMove() {
        return this.analyzeLogical().move;
    }

    /**
     * 找出一个「逻辑可推导为安全」的隐藏格（用于智能提示）
     * @returns {null|{row:number, col:number}}
     */
    findSafeMove() {
        const numbers = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                if (cell.state !== CellState.REVEALED || cell.type !== CellType.NUMBER) continue;
                const hidden = [];
                let flagged = 0;
                for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
                    const n = this.grid[nr][nc];
                    if (n.state === CellState.HIDDEN) hidden.push([nr, nc]);
                    else if (n.state === CellState.FLAGGED) flagged++;
                }
                numbers.push({ r, c, value: cell.neighborMines, hidden, flagged });
            }
        }

        // 基础：已插旗数 == 数字 → 隐藏邻居全安全
        for (const n of numbers) {
            if (n.hidden.length > 0 && n.flagged === n.value) {
                return { row: n.hidden[0][0], col: n.hidden[0][1] };
            }
        }
        // 子集：N(a)==N(b) 且 a.hidden ⊇ b.hidden → 差集全安全
        for (let i = 0; i < numbers.length; i++) {
            for (let j = 0; j < numbers.length; j++) {
                if (i === j) continue;
                const a = numbers[i];
                const b = numbers[j];
                if (a.hidden.length <= b.hidden.length) continue;
                const bSet = new Set(b.hidden.map(([r, c]) => `${r},${c}`));
                const isSuperset = a.hidden.every(([r, c]) => bSet.has(`${r},${c}`));
                if (!isSuperset) continue;
                if (a.value === b.value) {
                    const extra = a.hidden.find(([r, c]) => !bSet.has(`${r},${c}`));
                    if (extra) return { row: extra[0], col: extra[1] };
                }
            }
        }
        return null;
    }

    /**
     * 生成开局：反复重排地雷，直到第一下点开后存在至少一个逻辑可推导的下一步，
     * 保证玩家无需猜测即可继续。
     */
    generateOpening(safeRow, safeCol) {
        const MAX_TRIES = 500;
        for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
            this.clearGridForRetry();
            this.placeMines(safeRow, safeCol);
            this.revealFrom(safeRow, safeCol);
            if (this.hasLogicalMove()) break;
        }

        // 将已翻开的区域同步给 UI
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].state === CellState.REVEALED) {
                    this.onCellRevealed?.(r, c);
                }
            }
        }
        this.onFlagUpdate?.(this.minesRemaining);

        this.startGame();
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
            this.elapsedSeconds = Math.min(
                MAX_TIME,
                Math.floor((Date.now() - this.startTime) / 1000)
            );
            this.onTimerUpdate?.(this.elapsedSeconds);
            if (this.elapsedSeconds >= MAX_TIME) {
                this.stopTimer();
            }
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

        // 第一次点击时生成开局，并保证第一下点开后存在至少一个逻辑可推导的下一步
        if (this.isFirstClick) {
            this.generateOpening(row, col);
            this.checkWin();
            return true;
        }

        // 如果是地雷，游戏结束
        if (cell.type === CellType.MINE) {
            cell.state = CellState.REVEALED;
            cell.exploded = true;
            this.gameOver(false);
            return false;
        }

        // 翻开当前格子
        cell.state = CellState.REVEALED;
        this.revealedCount++;
        this.onCellRevealed?.(row, col);

        // 如果是空白格子，递归翻开周围
        if (cell.neighborMines === 0) {
            this.revealNeighbors(row, col);
        }

        // 检查是否胜利
        this.checkWin();

        return true;
    }

    /**
     * 递归翻开周围空白格子（迭代式 BFS/DFS）
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
                        this.onCellRevealed?.(nr, nc);
                        if (cell.neighborMines === 0) {
                            stack.push([nr, nc]);
                        }
                    }
                }
            }
        }
    }

    /**
     * 和弦点击：点击已翻开的数字格子，若周围旗帜数等于数字，
     * 自动翻开周围所有未标记格子
     * @returns {boolean} 是否触发了和弦操作
     */
    chordCell(row, col) {
        const cell = this.grid[row][col];
        if (cell.state !== CellState.REVEALED || cell.type !== CellType.NUMBER) {
            return false;
        }

        // 统计周围旗帜数和待翻开的格子
        let flagCount = 0;
        const toReveal = [];
        for (const [dr, dc] of NEIGHBOR_OFFSETS) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const neighbor = this.grid[nr][nc];
                if (neighbor.state === CellState.FLAGGED) {
                    flagCount++;
                } else if (neighbor.state === CellState.HIDDEN) {
                    toReveal.push([nr, nc]);
                }
            }
        }

        // 旗帜数不匹配，不执行
        if (flagCount !== cell.neighborMines || toReveal.length === 0) {
            return false;
        }

        // 翻开所有未标记的邻居
        for (const [nr, nc] of toReveal) {
            this.revealCell(nr, nc);
            if (this.state === GameState.LOSE) break;
        }

        return true;
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
    }

    /**
     * 检查是否胜利（标准规则：翻开所有非地雷格子即胜）
     */
    checkWin() {
        const nonMineCells = this.rows * this.cols - this.totalMines;
        if (this.revealedCount === nonMineCells) {
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

        if (win) {
            // 胜利时自动给所有未标记的地雷插旗
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (cell.type === CellType.MINE && cell.state !== CellState.FLAGGED) {
                        cell.state = CellState.FLAGGED;
                    }
                }
            }
        } else {
            // 失败时显示所有地雷，标记错误的旗帜
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (cell.type === CellType.MINE && cell.state !== CellState.FLAGGED) {
                        cell.state = CellState.REVEALED;
                    } else if (cell.type !== CellType.MINE && cell.state === CellState.FLAGGED) {
                        cell.wrongFlag = true;
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
     * 获取提示（优先返回逻辑可推导的安全格；找不到则随机返回一个安全格）
     */
    getHint() {
        if (this.hintsUsed >= this.maxHints || this.state !== GameState.PLAYING) {
            return null;
        }

        // 优先返回一个「逻辑可推导为安全」的格子
        const safe = this.findSafeMove();
        let hint = safe;

        if (!hint) {
            // 退而求其次：随机挑一个安全格（此时局面可能已需要猜测）
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
            hint = candidates[Math.floor(Math.random() * candidates.length)];
        }

        this.hintsUsed++;
        this.onHintUpdate?.(this.hintsUsed);

        return hint;
    }

    // 事件回调占位
    onTimerUpdate = null;          // (seconds) => void
    onFlagUpdate = null;           // (minesRemaining) => void
    onGameOver = null;             // (win, seconds) => void
    onReset = null;                // () => void
    onHintUpdate = null;           // (hintsUsed) => void
    onCellRevealed = null;         // (row, col) => void
    onHintApplied = null;          // (row, col) => void

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

// ========== js/ui.js ==========
/* 用户界面模块 */

/* 格子图标（内联 SVG，不依赖外部字体，保证任何环境都可见） */
const ICONS = {
    // 地雷
    bomb: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6a1.5 1.5 0 0 1 1.5 1.5c0 .55-.3 1.02-.76 1.24.74.27 1.4.7 1.94 1.27a6.2 6.2 0 1 1-9.36 0c.54-.57 1.2-1 1.94-1.27A1.5 1.5 0 0 1 10.5 4.1 1.5 1.5 0 0 1 12 2.6Z"/></svg>',
    // 旗帜
    flag: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3a1 1 0 0 1 1 1v2.3l11.5-2.9a.7.7 0 0 1 .87.68v12.2a.7.7 0 0 1-.87.68L8 15.7V20a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Z"/></svg>',
    // 错误标记（×）
    wrong: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'
};class UI {
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
