/* 游戏数据统计模块 */

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
 * 计算指定难度的统计信息
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
        const firstWin = sorted[sorted.length - 1].win;
        // 逆序遍历
        for (let i = sorted.length - 1; i >= 0; i--) {
            const win = sorted[i].win;
            if (win === firstWin) {
                // 与最新记录结果类型相同
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
    console.log('formatStreak called with streak:', streak);
    if (streak > 0) {
        return `${streak} 连胜`;
    } else if (streak < 0) {
        return `${-streak} 连败`;
    } else {
        return '无记录';
    }
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