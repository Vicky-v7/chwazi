// utils/animation.js
// 动画缓动函数和工具

/**
 * 缓动函数：ease-out（快入慢出）
 * @param {number} t - 进度 0~1
 * @returns {number} 缓动后的值 0~1
 */
function easeOut(t) {
  // 从三次曲线强化为四次曲线，让结束时更加顺滑
  return 1 - Math.pow(1 - t, 4)
}

/**
 * 缓动函数：ease-in-out
 * @param {number} t - 进度 0~1
 * @returns {number} 缓动后的值 0~1
 */
function easeInOut(t) {
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 4) / 2
}

/**
 * 弹性缓动（用于选中时的弹跳效果）
 * @param {number} t - 进度 0~1
 * @returns {number} 缓动后的值
 */
function elasticOut(t) {
  const c4 = (2 * Math.PI) / 4.5 // 减小频率，使反弹看起来更轻柔、高级
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

/**
 * 脉冲效果（用于等待选择时的呼吸灯）
 * @param {number} t - 时间（毫秒）
 * @param {number} period - 周期（毫秒）
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 当前值
 */
function pulse(t, period = 1000, min = 0.6, max = 1.0) {
  const phase = (t % period) / period
  const value = (Math.sin(phase * Math.PI * 2) + 1) / 2
  return min + value * (max - min)
}

/**
 * 线性插值
 * @param {number} a - 起始值
 * @param {number} b - 结束值
 * @param {number} t - 进度 0~1
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * 弹性过冲（轻微弹跳，比 elasticOut 更柔和）
 */
function bounceOut(t) {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75
    return 7.5625 * t * t + 0.75
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75
    return 7.5625 * t * t + 0.9375
  } else {
    t -= 2.625 / 2.75
    return 7.5625 * t * t + 0.984375
  }
}

/**
 * ease-in 加速
 */
function easeIn(t) {
  return t * t * t
}

module.exports = {
  easeOut,
  easeIn,
  easeInOut,
  elasticOut,
  bounceOut,
  pulse,
  lerp,
}
