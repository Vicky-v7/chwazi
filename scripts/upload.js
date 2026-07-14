// 微信小程序自动上传脚本
// 用法: npm run upload  (推荐)  或  node scripts/upload.js

const path = require('path')
const fs = require('fs')

// 1) 当前进程加载 localStorage polyfill
require(path.resolve(__dirname, 'polyfill-localstorage.js'))
// 2) 给后续 miniprogram-ci fork 出来的子进程也注入 polyfill（绝对路径）
const _polyfillAbs = path.resolve(__dirname, 'polyfill-localstorage.js')
const _existing = process.env.NODE_OPTIONS || ''
if (!_existing.includes(_polyfillAbs)) {
  process.env.NODE_OPTIONS = `${_existing} --require ${JSON.stringify(_polyfillAbs)}`.trim()
}

const ci = require('miniprogram-ci')

const APPID = 'wx64cf3f29560527bc'
const KEY_PATH = path.resolve(__dirname, '..', `private.${APPID}.key`)
const PROJECT_PATH = path.resolve(__dirname, '..', 'miniprogram')
const CHANGELOG_PATH = path.resolve(__dirname, '..', 'CHANGELOG.md')

// 自动从 CHANGELOG.md 第一个版本块读取 VERSION + DESC
function parseChangelog() {
  const text = fs.readFileSync(CHANGELOG_PATH, 'utf-8')
  const lines = text.split('\n')
  let version = null
  const desc = []
  let inBlock = false
  for (const line of lines) {
    const m = line.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/)
    if (m) {
      if (inBlock) break
      version = m[1]
      inBlock = true
      continue
    }
    if (inBlock && line.trim()) desc.push(line.trim())
  }
  if (!version) throw new Error('CHANGELOG.md 里没找到版本号（## x.y.z）')
  // 微信备注上限 1024 字符
  return { version, desc: desc.join('\n').slice(0, 1024) }
}

const { version: VERSION, desc: DESC } = parseChangelog()

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
