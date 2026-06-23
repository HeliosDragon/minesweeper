/* 游戏核心逻辑模块 - 含无猜模式生成器 */

// 工具函数已在全局作用域中定义（由 utils.js 提供）
// 直接使用全局变量 randomUniqueIndices, padZero, NEIGHBOR_OFFSETS, addGameRecord

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
        
        // 用于跟踪已翻开的格子
        let revealedCount = 1;
        let changed = true;
        const totalSafe = rows * cols - this.countMines(state, rows, cols);
        
        // 最大迭代次数防止死循环
        let iterations = 0;
        const maxIterations = rows * cols * 2;
        
        while (changed && revealedCount < totalSafe && iterations < maxIterations) {
            changed = false;
            iterations++;
            
            // 1. 应用基本推理规则
            const result = this.applyInference(state, rows, cols);
            if (result.revealed > 0) {
                revealedCount += result.revealed;
                changed = true;
            }
            if (result.flagged > 0) {
                changed = true;
            }
            
            // 2. 如果推理没有进展，尝试更高级的推理（子集排除）
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
        
        // 如果所有安全格子都被翻开，则地图可解
        return revealedCount === totalSafe;
    }
    
    /**
     * 统计地雷数量
     */
    static countMines(grid, rows, cols) {
        let count = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].type === CellType.MINE) count++;
            }
        }
        return count;
    }
    
    /**
     * 基本推理规则：
     * R1: 如果数字格子周围未翻开格子数 == 剩余地雷数，则这些格子都是地雷
     * R2: 如果数字格子周围未翻开格子数 - 已标记地雷数 == 0，则这些格子都是安全的
     */
    static applyInference(grid, rows, cols) {
        let revealed = 0;
        let flagged = 0;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c];
                if (cell.state !== CellState.REVEALED || cell.type !== CellType.NUMBER) continue;
                
                // 获取周围未翻开和已标记的格子
                const neighbors = this.getNeighbors(grid, rows, cols, r, c);
                const hidden = neighbors.filter(n => n.state === CellState.HIDDEN);
                const flaggedNeighbors = neighbors.filter(n => n.state === CellState.FLAGGED);
                
                const remainingMines = cell.neighborMines - flaggedNeighbors.length;
                
                // R1: 如果未翻开格子数 == 剩余地雷数，标记为地雷
                if (hidden.length === remainingMines && remainingMines > 0) {
                    for (const n of hidden) {
                        if (n.state === CellState.HIDDEN && n.type === CellType.MINE) {
                            n.state = CellState.FLAGGED;
                            flagged++;
                        }
                    }
                }
                
                // R2: 如果剩余地雷数为0，翻开所有未翻开格子
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
    
    /**
     * 高级推理：子集排除（简化版）
     * 对于两个数字格子，如果它们共享未翻开格子，可以通过比较来推理
     */
    static applyAdvancedInference(grid, rows, cols) {
        let revealed = 0;
        let flagged = 0;
        
        // 收集所有已翻开的数字格子及其周围未翻开的格子集合
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
        
        // 对约束进行两两比较
        for (let i = 0; i < constraints.length; i++) {
            for (let j = i + 1; j < constraints.length; j++) {
                const a = constraints[i];
                const b = constraints[j];
                
                // 如果两个约束的格子集合相同，但地雷数不同，则矛盾（忽略）
                // 如果集合有包含关系，可以推理
                const aSet = new Set(a.cells.map(c => `${c.row},${c.col}`));
                const bSet = new Set(b.cells.map(c => `${c.row},${c.col}`));
                
                // 计算交集和差集
                const intersection = a.cells.filter(c => bSet.has(`${c.row},${c.col}`));
                const aOnly = a.cells.filter(c => !bSet.has(`${c.row},${c.col}`));
                const bOnly = b.cells.filter(c => !aSet.has(`${c.row},${c.col}`));
                
                // 如果 a 的集合包含 b 的集合 (a ⊃ b)
                if (aOnly.length > 0 && intersection.length === b.cells.length) {
                    const aOnlyMines = a.mines - b.mines;
                    if (aOnlyMines === 0) {
                        // aOnly 中的格子都是安全的
                        for (const n of aOnly) {
                            if (n.state === CellState.HIDDEN && n.type !== CellType.MINE) {
                                n.state = CellState.REVEALED;
                                revealed++;
                            }
                        }
                    } else if (aOnlyMines === aOnly.length) {
                        // aOnly 中的格子都是地雷
                        for (const n of aOnly) {
                            if (n.state === CellState.HIDDEN && n.type === CellType.MINE) {
                                n.state = CellState.FLAGGED;
                                flagged++;
                            }
                        }
                    }
                }
                
                // 如果 b 的集合包含 a 的集合 (b ⊃ a)
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
    
    /**
     * 获取相邻格子（8方向）
     */
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
        
        // 【新增】无猜模式开关，默认开启
        this.noGuessMode = true;
        // 【新增】生成尝试次数统计
        this._generationAttempts = 0;
        
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
    
    /**
     * 【修改】布置地雷 - 集成无猜模式
     * @param {number} safeRow 安全行
     * @param {number} safeCol 安全列
     */
    placeMines(safeRow, safeCol) {
        if (this.noGuessMode) {
            // 使用无猜模式生成地图
            const success = this.generateNoGuessMap(safeRow, safeCol);
            if (!success) {
                // 如果无猜生成失败，回退到普通生成
                console.warn('无猜模式生成失败，回退到普通生成');
                this.placeMinesRandom(safeRow, safeCol);
            }
        } else {
            this.placeMinesRandom(safeRow, safeCol);
        }
        
        // 计算每个格子的周围地雷数
        this.calculateNeighborMines();
    }
    
    /**
     * 【新增】无猜模式地图生成
     * 使用迭代试错法，直到生成一个可完全推理的地图
     */
    generateNoGuessMap(safeRow, safeCol) {
        const maxAttempts = 200;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            this._generationAttempts = attempts;
            
            // 1. 重置网格（保留行列信息）
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
            
            // 2. 计算安全区域
            const safeCells = new Set();
            for (const [dr, dc] of NEIGHBOR_OFFSETS) {
                const nr = safeRow + dr;
                const nc = safeCol + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    safeCells.add(nr * this.cols + nc);
                }
            }
            safeCells.add(safeRow * this.cols + safeCol);
            
            // 3. 生成地雷位置（避开安全区域）
            const totalCells = this.rows * this.cols;
            const availableIndices = [];
            for (let i = 0; i < totalCells; i++) {
                if (!safeCells.has(i)) {
                    availableIndices.push(i);
                }
            }
            
            if (availableIndices.length < this.totalMines) {
                continue; // 地雷数太多，无法避开安全区域
            }
            
            // 随机选择地雷位置
            const shuffled = [...availableIndices];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const mineIndices = shuffled.slice(0, this.totalMines);
            
            // 放置地雷
            for (const idx of mineIndices) {
                const r = Math.floor(idx / this.cols);
                const c = idx % this.cols;
                gridCopy[r][c].type = CellType.MINE;
            }
            
            // 4. 计算数字
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
            
            // 5. 使用求解器检查是否可解
            const solvable = MinesweeperSolver.isSolvable(
                gridCopy, this.rows, this.cols, safeRow, safeCol
            );
            
            if (solvable) {
                // 使用这个地图
                this.grid = gridCopy;
                console.log(`✅ 无猜地图生成成功，尝试次数: ${attempts}`);
                return true;
            }
            
            // 如果尝试次数过多，输出进度
            if (attempts % 50 === 0) {
                console.log(`⏳ 无猜模式生成中... 已尝试 ${attempts} 次`);
            }
        }
        
        console.warn(`❌ 无猜模式生成失败，已尝试 ${maxAttempts} 次`);
        return false;
    }
    
    /**
     * 【原有】随机地雷生成（作为无猜模式的回退）
     */
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
        
        // 如果地雷数量大于可用格子数，补充随机位置
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
    
    /**
     * 开始游戏
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
    
    /**
     * 游戏结束
     */
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
     * 获取提示（返回一个安全格子的坐标）
     */
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
        
        // 优先选择数字格子附近的未翻开格子（更有助于推理）
        // 简单策略：随机选择
        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        this.hintsUsed++;
        this.onHintUpdate?.(this.hintsUsed);
        
        return hint;
    }
    
    /**
     * 事件回调
     */
    onTimerUpdate = null;
    onFlagUpdate = null;
    onGameOver = null;
    onReset = null;
    onHintUpdate = null;
    onHintApplied = null;  // 【新增】提示应用回调
    
    /**
     * 处理格子点击
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
    
    /**
     * 【修改】处理提示 - 触发 onHintApplied 回调
     */
    handleHint() {
        const hint = this.getHint();
        if (hint) {
            this.onHintApplied?.(hint.row, hint.col);
        }
    }
}

// 全局暴露
if (typeof window !== 'undefined') {
    window.MinesweeperGame = {
        Game,
        DIFFICULTIES,
        GameState,
        CellState,
        CellType,
        MinesweeperSolver
    };
}