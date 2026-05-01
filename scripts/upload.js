// 微信小程序自动上传脚本
// 用法: node scripts/upload.js
const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

const APPID = 'wx64cf3f29560527bc'
const VERSION = '1.0.5'
const KEY_PATH = path.resolve(__dirname, '..', `private.${APPID}.key`)
const PROJECT_PATH = path.resolve(__dirname, '..', 'miniprogram')

const DESC = [
  '1. 新增数据埋点（分享/再来一轮/完成选人/设置变更）',
  '2. 鸿蒙系统首次进入提示双指手势冲突',
  '3. 修复多指 cancel 时圆圈被误清除',
  '4. 稳定时间 1.5s→2s，与文案对齐',
  '5. 圆圈渐变重做，颜色更通透',
].join('\n')

if (!fs.existsSync(KEY_PATH)) {
  console.error(`❌ 找不到上传密钥: ${KEY_PATH}`)
  console.error('请从微信公众平台下载后放到该路径')
  process.exit(1)
}

;(async () => {
  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_PATH,
    privateKeyPath: KEY_PATH,
    ignores: ['node_modules/**/*'],
  })

  console.log(`📦 上传 v${VERSION} 中...`)
  const result = await ci.upload({
    project,
    version: VERSION,
    desc: DESC,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      autoPrefixWXSS: true,
    },
    onProgressUpdate: (info) => {
      if (typeof info === 'string') console.log('  ', info)
      else if (info && info._msg) console.log('  ', info._msg)
    },
  })

  console.log('✅ 上传成功')
  console.log(JSON.stringify(result, null, 2))
})().catch(err => {
  console.error('❌ 上传失败:', err.message || err)
  process.exit(1)
})
