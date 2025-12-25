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
];