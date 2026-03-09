// utils/random.js
// 随机选择算法

/**
 * 从手指列表中随机选择指定数量（Fisher-Yates 洗牌算法）
 * @param {string[]} ids - 手指ID数组
 * @param {number} count - 需要选中的数量
 * @returns {string[]} 选中的手指ID数组
 */
function randomSelect(ids, count = 1) {
  if (ids.length <= count) return [...ids]

  const shuffled = [...ids]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, count)
}

/**
 * 将手指随机分成指定数量的组
 * @param {string[]} ids - 手指ID数组
 * @param {number} groupCount - 组数
 * @returns {string[][]} 分组结果，每组包含手指ID数组
 */
function randomGroup(ids, groupCount = 2) {
  if (groupCount <= 0) groupCount = 2
  if (groupCount > ids.length) groupCount = ids.length

  // 先洗牌
  const shuffled = [...ids]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // 均匀分配到各组
  const groups = Array.from({ length: groupCount }, () => [])
  shuffled.forEach((id, index) => {
    groups[index % groupCount].push(id)
  })

  return groups
}

module.exports = {
  randomSelect,
  randomGroup,
}
