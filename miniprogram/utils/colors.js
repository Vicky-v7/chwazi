// utils/colors.js
// 手指圆圈颜色配置 — 鲜艳饱和、在深色背景上辨识度高

const FINGER_COLORS = [
  '#FF6B6B', // 珊瑚红
  '#4ECDC4', // 青绿
  '#5B8DEF', // 宝蓝
  '#FFD93D', // 明黄
  '#C471ED', // 紫罗兰
  '#FF8A5C', // 橙色
  '#6BCB77', // 翠绿
  '#4D96FF', // 天蓝
  '#FF6E9C', // 粉红
  '#A8E6CF', // 薄荷绿
]

// 选中时的高亮颜色（更亮的版本）
const HIGHLIGHT_COLORS = [
  '#FF8A8A', // 亮珊瑚红
  '#7EDDD6', // 亮青绿
  '#85AFFF', // 亮宝蓝
  '#FFE566', // 亮明黄
  '#D99BF0', // 亮紫罗兰
  '#FFAB85', // 亮橙色
  '#8FDB9A', // 亮翠绿
  '#7AB4FF', // 亮天蓝
  '#FF96B8', // 亮粉红
  '#C5F0DC', // 亮薄荷绿
]

// 分组模式的组颜色
const GROUP_COLORS = [
  '#FF6B6B',
  '#5B8DEF',
  '#4ECDC4',
  '#FFD93D',
  '#C471ED',
  '#6BCB77',
]

let colorIndex = 0

/**
 * 获取下一个手指颜色（循环分配）
 */
function getNextColor() {
  const color = FINGER_COLORS[colorIndex % FINGER_COLORS.length]
  colorIndex++
  return color
}

/**
 * 重置颜色索引
 */
function resetColorIndex() {
  colorIndex = 0
}

/**
 * 获取颜色对应的高亮版本
 */
function getHighlightColor(color) {
  const idx = FINGER_COLORS.indexOf(color)
  if (idx >= 0) return HIGHLIGHT_COLORS[idx]
  return color
}

/**
 * 将hex颜色转换为rgba（带缓存）
 */
const _rgbCache = {}
function hexToRgb(hex) {
  if (_rgbCache[hex]) return _rgbCache[hex]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  _rgbCache[hex] = { r, g, b }
  return _rgbCache[hex]
}

function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

module.exports = {
  FINGER_COLORS,
  HIGHLIGHT_COLORS,
  GROUP_COLORS,
  getNextColor,
  resetColorIndex,
  getHighlightColor,
  hexToRgba,
}
