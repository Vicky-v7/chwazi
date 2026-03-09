// pages/index/index.js
const { randomSelect, randomGroup } = require('../../utils/random')
const { getNextColor, resetColorIndex, getHighlightColor, hexToRgba, GROUP_COLORS } = require('../../utils/colors')
const { easeOut, easeIn, easeInOut, elasticOut, pulse, lerp } = require('../../utils/animation')

// 状态常量
const STATE = {
  IDLE: 'idle',           // 空闲，等待手指
  WAITING: 'waiting',     // 手指已放上，等待稳定
  SELECTING: 'selecting', // 正在执行选择动画
  RESULT: 'result',       // 展示选择结果
}

// 配置常量
const CONFIG = {
  STABLE_DELAY: 1500,         // 手指稳定后等待时间（ms）
  SELECT_ANIM_DURATION: 1600, // 选择动画持续时间（ms）— 增加仪式感
  FINGER_RADIUS: 54,          // 手指圆圈最终半径（覆盖指尖大小）
  FINGER_GROW_DURATION: 300,  // 圆圈增长动画时长（ms）
  SELECTED_RADIUS: 76,        // 选中后的圆圈半径
  RESULT_FADE_DURATION: 450,  // 未选中淡出时间（ms）
  WAIT_PULSE_PERIOD: 2400,    // 等待态呼吸周期（慢呼吸更舒适）
  RESULT_PULSE_PERIOD: 1400,  // 结果态呼吸周期
  SELECT_SCAN_CYCLES: 3,      // 选择态扫描圈数
  RING_WIDTH: 2.5,            // 外圈线宽
  MOVE_THRESHOLD: 10,         // 超过此位移(px)才重置稳定计时
  RIPPLE_COUNT: 3,            // 结果波纹数量
  RIPPLE_DURATION: 1200,      // 波纹扩散时长（ms）
  RIPPLE_INTERVAL: 300,       // 波纹间隔（ms）
  RIPPLE_MAX_RADIUS: 160,     // 波纹最大半径
}

Page({
  data: {
    showHint: true,
    modeName: '随机选一人',
    statusText: '',
    state: 'idle',
  },

  // ========== 生命周期 ==========

  onLoad() {
    this.fingers = {}
    this.state = STATE.IDLE
    this.stableTimer = null
    this.selectionTimer = null
    this.selectedIds = []
    this.selectedSet = new Set()
    this.groups = []
    this.groupIndexMap = {}
    this.selectStartTime = 0
    this.resultTime = 0
    this.animationId = null
    this.requestFrame = null
    this.cancelFrame = null
    this.waitingSince = 0
    this.fingerOrder = []
    this.resetDelayTimer = null
    this.statusClearTimer = null
  },

  onReady() {
    this.initCanvas()
    this.initSounds()
  },

  onShow() {
    this.updateModeDisplay()
    // 从设置页返回时恢复渲染循环
    if (this.canvas && this.ctx && !this._renderRunning) {
      this.startRenderLoop()
    }
  },

  onHide() {
    // 页面不可见时暂停渲染循环，节省 CPU
    this._renderRunning = false
    if (this.animationId && this.cancelFrame) {
      this.cancelFrame(this.animationId)
      this.animationId = null
    }
  },

  onUnload() {
    this._renderRunning = false
    if (this.animationId && this.cancelFrame) {
      this.cancelFrame(this.animationId)
    }
    if (this.stableTimer) clearTimeout(this.stableTimer)
    if (this.selectionTimer) clearTimeout(this.selectionTimer)
    if (this.resetDelayTimer) clearTimeout(this.resetDelayTimer)
    if (this.statusClearTimer) clearTimeout(this.statusClearTimer)
    if (this.tapSound) this.tapSound.destroy()
    if (this.selectSound) this.selectSound.destroy()
    resetColorIndex()
  },

  // ========== 初始化 ==========

  initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          console.error('Canvas 初始化失败')
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio

        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        ctx.scale(dpr, dpr)

        this.canvas = canvas
        this.ctx = ctx
        this.canvasWidth = res[0].width
        this.canvasHeight = res[0].height

        this.startRenderLoop()
      })
  },

  initSounds() {
    if (typeof wx.setInnerAudioOption === 'function') {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOther: true,
      })
    }

    this.selectSound = this.createSoundContext('select', [
      '/assets/sounds/select.wav',
      'assets/sounds/select.wav',
    ], 0.6)
    this.tapSound = this.createSoundContext('tap', [
      '/assets/sounds/tap.wav',
      'assets/sounds/tap.wav',
    ], 0.35)
  },

  createSoundContext(name, sources, volume = 1.0) {
    const audio = wx.createInnerAudioContext()
    audio.autoplay = false
    audio.loop = false
    audio.volume = volume
    audio._sources = sources
    audio._sourceIndex = 0
    audio.src = sources[0]
    audio.onError((err) => {
      const nextIndex = audio._sourceIndex + 1
      if (nextIndex < audio._sources.length) {
        audio._sourceIndex = nextIndex
        audio.src = audio._sources[nextIndex]
        return
      }
      console.warn(`${name} 音效加载失败`, err)
    })
    return audio
  },

  updateModeDisplay() {
    const app = getApp()
    const { mode, selectCount, groupCount } = app.globalData
    let modeName = '随机选一人'

    if (mode === 'multi') {
      modeName = `随机选 ${selectCount} 人`
    } else if (mode === 'group') {
      modeName = `分成 ${groupCount} 组`
    }

    this.setData({ modeName })
  },

  // ========== 触控事件 ==========

  onTouchStart(e) {
    if (this.state === STATE.SELECTING) return

    if (this.state === STATE.RESULT) {
      this.resetGame()
    }

    const touches = e.changedTouches
    const now = Date.now()
    touches.forEach(touch => {
      this.fingers[touch.identifier] = {
        x: touch.clientX,
        y: touch.clientY,
        refX: touch.clientX,
        refY: touch.clientY,
        color: getNextColor(),
        radius: 0,
        startTime: now,
      }
    })

    this.playTapSound()

    if (this.data.showHint) {
      this.setData({ showHint: false })
    }

    this.state = STATE.WAITING
    this.setData({ state: STATE.WAITING })
    this.restartStableTimer()
  },

  onTouchMove(e) {
    const touches = e.changedTouches
    const threshold = CONFIG.MOVE_THRESHOLD
    let shouldRestart = false

    touches.forEach(touch => {
      const finger = this.fingers[touch.identifier]
      if (!finger) return
      finger.x = touch.clientX
      finger.y = touch.clientY
      const dx = touch.clientX - finger.refX
      const dy = touch.clientY - finger.refY
      if (this.state === STATE.WAITING && (dx * dx + dy * dy > threshold * threshold)) {
        finger.refX = touch.clientX
        finger.refY = touch.clientY
        shouldRestart = true
      }
    })

    if (shouldRestart) {
      this.restartStableTimer()
    }
  },

  onTouchEnd(e) {
    if (this.state === STATE.SELECTING) {
      // 选择动画中记录哪些手指离开了，但不中断动画
      const touches = e.changedTouches
      touches.forEach(touch => {
        if (this.fingers[touch.identifier]) {
          this.fingers[touch.identifier]._lifted = true
        }
      })
      return
    }

    if (this.state === STATE.RESULT) {
      const touches = e.changedTouches
      touches.forEach(touch => {
        delete this.fingers[touch.identifier]
        })
      if (Object.keys(this.fingers).length === 0) {
        if (this.resetDelayTimer) clearTimeout(this.resetDelayTimer)
        this.resetDelayTimer = setTimeout(() => {
          this.resetDelayTimer = null
          this.resetGame()
        }, 300)
      }
      return
    }

    const touches = e.changedTouches
    touches.forEach(touch => {
      delete this.fingers[touch.identifier]
    })

    const fingerCount = Object.keys(this.fingers).length

    if (fingerCount === 0) {
      this.resetGame()
    } else if (this.state === STATE.WAITING) {
      this.restartStableTimer()
    }
  },

  // ========== 选择逻辑 ==========

  restartStableTimer() {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = null
    }

    const fingerCount = Object.keys(this.fingers).length
    const app = getApp()
    const { mode, groupCount } = app.globalData

    if (fingerCount < 2) {
      this.waitingSince = 0
      this.setData({ statusText: '再多放一根手指' })
      return
    }
    if (mode === 'group' && fingerCount < groupCount) {
      this.waitingSince = 0
      this.setData({ statusText: `至少需要 ${groupCount} 人才能分组` })
      return
    }

    // 条件满足，清除之前的不足提示
    if (this.data.statusText && this.data.statusText !== '') {
      this.setData({ statusText: '' })
    }

    this.waitingSince = Date.now()
    this.stableTimer = setTimeout(() => {
      this.startSelection()
    }, CONFIG.STABLE_DELAY)
  },

  startSelection() {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = null
    }

    const ids = Object.keys(this.fingers)
    if (ids.length < 2) {
      if (ids.length === 1) {
        this.selectedIds = [ids[0]]
        this.selectedSet = new Set(this.selectedIds)
        this.onSelectionComplete()
      }
      return
    }

    const app = getApp()
    const { mode, selectCount, groupCount } = app.globalData

    this.state = STATE.SELECTING
    this.setData({ state: STATE.SELECTING })
    this.selectStartTime = Date.now()

    if (mode === 'group') {
      this.groups = randomGroup(ids, groupCount)
      this.groupIndexMap = {}
      this.groups.forEach((group, groupIndex) => {
        group.forEach((id) => {
          this.groupIndexMap[id] = groupIndex
        })
      })
      this.selectedIds = this.groups[0]
      this.selectedSet = new Set(this.selectedIds)
    } else {
      const count = mode === 'multi' ? Math.min(selectCount, ids.length) : 1
      // 多选模式下实际人数不足设定值时提示
      if (mode === 'multi' && ids.length <= selectCount) {
        this.setData({ statusText: `仅 ${ids.length} 人，已全部选中` })
      }
      this.selectedIds = randomSelect(ids, count)
      this.selectedSet = new Set(this.selectedIds)
      this.groups = []
      this.groupIndexMap = {}
    }

    this.selectionTimer = setTimeout(() => {
      this.selectionTimer = null
      this.onSelectionComplete()
    }, CONFIG.SELECT_ANIM_DURATION)
  },

  onSelectionComplete() {
    // 清理动画期间已离开的手指
    const ids = Object.keys(this.fingers)
    ids.forEach(id => {
      if (this.fingers[id]._lifted) {
        delete this.fingers[id]
      }
    })

    if (Object.keys(this.fingers).length === 0) {
      this.resetGame()
      return
    }

    this.state = STATE.RESULT
    this.setData({ state: STATE.RESULT })
    this.resultTime = Date.now()

    // 双震动反馈 - 更有仪式感
    const app = getApp()
    if (app.globalData.vibrateEnabled) {
      wx.vibrateShort({ type: 'heavy' })
      setTimeout(() => {
        wx.vibrateShort({ type: 'light' })
      }, 120)
    }

    this.playSelectSound()

    // statusText 自动消失
    if (this.data.statusText) {
      if (this.statusClearTimer) clearTimeout(this.statusClearTimer)
      this.statusClearTimer = setTimeout(() => {
        this.statusClearTimer = null
        this.setData({ statusText: '' })
      }, 2000)
    }
  },

  resetGame() {
    this.state = STATE.IDLE
    this.setData({ state: STATE.IDLE })
    this.fingers = {}
    this.selectedIds = []
    this.selectedSet = new Set()
    this.groups = []
    this.groupIndexMap = {}
    this.waitingSince = 0
    resetColorIndex()

    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = null
    }
    if (this.selectionTimer) {
      clearTimeout(this.selectionTimer)
      this.selectionTimer = null
    }
    if (this.resetDelayTimer) {
      clearTimeout(this.resetDelayTimer)
      this.resetDelayTimer = null
    }
    if (this.statusClearTimer) {
      clearTimeout(this.statusClearTimer)
      this.statusClearTimer = null
    }

    this.setData({ showHint: true, statusText: '' })
    this.updateModeDisplay()
  },

  // ========== 渲染循环 ==========

  startRenderLoop() {
    if (!this.canvas || !this.ctx) return

    if (typeof this.canvas.requestAnimationFrame === 'function') {
      this.requestFrame = (cb) => this.canvas.requestAnimationFrame(cb)
      this.cancelFrame = (id) => this.canvas.cancelAnimationFrame(id)
    } else {
      this.requestFrame = (cb) => setTimeout(cb, 16)
      this.cancelFrame = (id) => clearTimeout(id)
    }

    this._renderRunning = true
    const render = () => {
      if (!this._renderRunning) return
      this.renderFrame()
      this.animationId = this.requestFrame(render)
    }
    render()
  },

  renderFrame() {
    const ctx = this.ctx
    if (!ctx) return
    const w = this.canvasWidth
    const h = this.canvasHeight
    const now = Date.now()

    this.drawBackground(ctx, w, h, now)

    const fingerIds = Object.keys(this.fingers)
    this.fingerOrder = fingerIds
    if (fingerIds.length === 0) return

    const isGroupMode = this.groups.length > 0

    // 在 RESULT 状态下，先绘制未选中的手指（它们会淡出），再绘制选中的手指（在上层）
    if (this.state === STATE.RESULT && !isGroupMode) {
      // 先画未选中
      fingerIds.forEach(id => {
        const finger = this.fingers[id]
        if (!finger || this.selectedSet.has(id)) return
        this.drawResultFinger(ctx, finger, id, false, false, now)
      })
      // 再画选中的（波纹 + 主体）
      fingerIds.forEach(id => {
        const finger = this.fingers[id]
        if (!finger || !this.selectedSet.has(id)) return
        this.drawResultRipples(ctx, finger, now)
        this.drawResultFinger(ctx, finger, id, true, false, now)
      })
    } else {
      fingerIds.forEach(id => {
        const finger = this.fingers[id]
        if (!finger) return

        const elapsed = now - finger.startTime
        const isSelected = this.selectedSet.has(id)

        switch (this.state) {
          case STATE.WAITING:
            this.drawWaitingFinger(ctx, finger, id, elapsed, now)
            break
          case STATE.SELECTING:
            this.drawSelectingFinger(ctx, finger, id, isSelected, now)
            break
          case STATE.RESULT:
            if (isGroupMode) {
              this.drawGroupResult(ctx, finger, id, now)
            }
            break
          default:
            this.drawWaitingFinger(ctx, finger, id, elapsed, now)
        }
      })
    }
  },

  drawBackground(ctx, w, h, now) {
    // 根据状态微调背景
    let brightBoost = 0
    if (this.state === STATE.SELECTING) {
      const progress = Math.min(1, (now - this.selectStartTime) / CONFIG.SELECT_ANIM_DURATION)
      brightBoost = Math.sin(progress * Math.PI) * 0.03
    } else if (this.state === STATE.RESULT) {
      const resultElapsed = now - this.resultTime
      brightBoost = Math.max(0, 0.08 - resultElapsed / 3000 * 0.08)
    }

    const centerX = w * (0.5 + Math.sin(now / 6200) * 0.06)
    const centerY = h * (0.45 + Math.cos(now / 7000) * 0.05)
    const radius = Math.max(w, h) * 0.9
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)

    const addBright = (hex, boost) => {
      const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.floor(boost * 255))
      const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.floor(boost * 255))
      const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.floor(boost * 255))
      return `rgb(${r},${g},${b})`
    }

    gradient.addColorStop(0, addBright('#121926', brightBoost))
    gradient.addColorStop(0.45, addBright('#0b0f18', brightBoost * 0.5))
    gradient.addColorStop(1, addBright('#07090f', brightBoost * 0.2))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
  },

  /**
   * 绘制等待状态的手指（呼吸灯效果）
   */
  drawWaitingFinger(ctx, finger, id, elapsed, now) {
    // 入场增长动画
    const growProgress = Math.min(1, elapsed / CONFIG.FINGER_GROW_DURATION)
    const baseRadius = lerp(0, CONFIG.FINGER_RADIUS, easeOut(growProgress))

    // 呼吸效果：用慢正弦做平滑呼吸，带轻微停顿感
    // 使用 smoothstep 式曲线让峰值和谷值各停留一小段
    const breathPhase = (now % CONFIG.WAIT_PULSE_PERIOD) / CONFIG.WAIT_PULSE_PERIOD
    const breathSin = (Math.sin(breathPhase * Math.PI * 2 - Math.PI / 2) + 1) / 2
    // 三次平滑让过渡更柔和，峰谷更明显
    const breathCurve = breathSin * breathSin * (3 - 2 * breathSin)

    // 透明度呼吸：0.5 ~ 0.92
    const breathAlpha = lerp(0.5, 0.92, breathCurve)
    // 大小呼吸：圆圈微微胀缩 ±6%
    const breathScale = lerp(0.94, 1.06, breathCurve)
    const currentRadius = baseRadius * breathScale
    // 光晕呼吸：光晕范围也跟着脉动
    const glowScale = lerp(2.2, 3.2, breathCurve)

    finger.radius = currentRadius

    // 第一层：大范围柔光晕（跟随呼吸扩缩）
    const glowRadius = currentRadius * glowScale
    const gradient = ctx.createRadialGradient(
      finger.x, finger.y, currentRadius * 0.3,
      finger.x, finger.y, glowRadius
    )
    gradient.addColorStop(0, hexToRgba(finger.color, breathAlpha * 0.2))
    gradient.addColorStop(0.4, hexToRgba(finger.color, breathAlpha * 0.08))
    gradient.addColorStop(0.7, hexToRgba(finger.color, breathAlpha * 0.02))
    gradient.addColorStop(1, hexToRgba(finger.color, 0))
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // 第二层：紧贴主圆的内发光边缘
    const innerGlowRadius = currentRadius * 1.35
    const innerGlow = ctx.createRadialGradient(
      finger.x, finger.y, currentRadius * 0.85,
      finger.x, finger.y, innerGlowRadius
    )
    innerGlow.addColorStop(0, hexToRgba(getHighlightColor(finger.color), breathAlpha * 0.25))
    innerGlow.addColorStop(1, hexToRgba(finger.color, 0))
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, innerGlowRadius, 0, Math.PI * 2)
    ctx.fillStyle = innerGlow
    ctx.fill()

    // 第三层：主圆 — 带偏移高光模拟立体感
    const hlOffset = currentRadius * 0.22
    const mainGradient = ctx.createRadialGradient(
      finger.x - hlOffset, finger.y - hlOffset, currentRadius * 0.1,
      finger.x, finger.y, currentRadius
    )
    const hlColor = getHighlightColor(finger.color)
    mainGradient.addColorStop(0, hexToRgba('#ffffff', breathAlpha * 0.18))
    mainGradient.addColorStop(0.15, hexToRgba(hlColor, breathAlpha * 0.95))
    mainGradient.addColorStop(0.6, hexToRgba(finger.color, breathAlpha * 0.9))
    mainGradient.addColorStop(1, hexToRgba(finger.color, breathAlpha * 0.7))
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, currentRadius, 0, Math.PI * 2)
    ctx.fillStyle = mainGradient
    ctx.fill()

    // 第四层：外环（呼吸时透明度也跟着变）
    const ringAlpha = lerp(0.2, 0.5, breathCurve)
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, currentRadius + 5, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba(finger.color, ringAlpha)
    ctx.lineWidth = CONFIG.RING_WIDTH
    ctx.stroke()

    // 稳定倒计时环
    const stableProgress = this.waitingSince > 0
      ? Math.min(1, (now - this.waitingSince) / CONFIG.STABLE_DELAY)
      : 0
    if (stableProgress > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(
        finger.x, finger.y,
        currentRadius + 12,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * easeOut(stableProgress)
      )
      ctx.strokeStyle = hexToRgba(hlColor, 0.85)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()
    }
  },

  /**
   * 绘制选择动画中的手指
   * 改进：更自然的减速扫描 + 最终锁定到选中者
   */
  drawSelectingFinger(ctx, finger, id, isSelected, now) {
    const rawProgress = Math.min(1, (now - this.selectStartTime) / CONFIG.SELECT_ANIM_DURATION)
    const fingerCount = this.fingerOrder.length
    const fingerIndex = this.fingerOrder.indexOf(id)

    // 使用 easeInOut 让扫描先加速再减速，更有紧张感
    const eased = easeInOut(rawProgress)

    // 扫描高光计算
    const totalPhase = eased * CONFIG.SELECT_SCAN_CYCLES * fingerCount
    const diff = fingerCount > 0
      ? Math.abs(((totalPhase - fingerIndex + fingerCount) % fingerCount))
      : 0
    const wrappedDiff = Math.min(diff, fingerCount - diff)
    // 扫描高光宽度随进度变窄（越来越精确）
    const scanWidth = lerp(1.8, 0.6, rawProgress)
    const scanBoost = fingerCount > 0 ? Math.max(0, 1 - wrappedDiff / scanWidth) : 0

    // 在后半段，选中者逐渐亮起
    const settlePhase = Math.max(0, (rawProgress - 0.6) / 0.4)
    const winnerBoost = isSelected ? easeIn(settlePhase) : 0
    // 未选中者在后半段逐渐变暗
    const loserDim = !isSelected ? settlePhase * 0.5 : 0

    const baseAlpha = Math.max(0.12, 0.25 - loserDim * 0.2)
    const alpha = baseAlpha + scanBoost * 0.65 + winnerBoost * 0.3
    const radius = CONFIG.FINGER_RADIUS * (0.85 + scanBoost * 0.22 + winnerBoost * 0.2)

    // 光晕
    if (scanBoost > 0.05 || winnerBoost > 0.01) {
      const glowIntensity = scanBoost * 0.25 + winnerBoost * 0.18
      const gradient = ctx.createRadialGradient(
        finger.x, finger.y, radius * 0.3,
        finger.x, finger.y, radius * 3.2
      )
      gradient.addColorStop(0, hexToRgba(finger.color, glowIntensity))
      gradient.addColorStop(0.5, hexToRgba(finger.color, glowIntensity * 0.3))
      gradient.addColorStop(1, hexToRgba(finger.color, 0))
      ctx.beginPath()
      ctx.arc(finger.x, finger.y, radius * 3.2, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }

    // 主圆
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(finger.color, alpha)
    ctx.fill()

    // 被扫描到时闪一下外环
    if (scanBoost > 0.3) {
      ctx.beginPath()
      ctx.arc(finger.x, finger.y, radius + 3, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(finger.color, scanBoost * 0.4)
      ctx.lineWidth = 2
      ctx.stroke()
    }
  },

  /**
   * 绘制结果波纹效果（选中手指的扩散波纹）
   */
  drawResultRipples(ctx, finger, now) {
    const resultElapsed = now - this.resultTime
    const hlColor = getHighlightColor(finger.color)

    for (let i = 0; i < CONFIG.RIPPLE_COUNT; i++) {
      const rippleStart = i * CONFIG.RIPPLE_INTERVAL
      const rippleElapsed = resultElapsed - rippleStart
      if (rippleElapsed < 0 || rippleElapsed > CONFIG.RIPPLE_DURATION) continue

      const rippleProgress = rippleElapsed / CONFIG.RIPPLE_DURATION
      const rippleRadius = lerp(CONFIG.SELECTED_RADIUS, CONFIG.RIPPLE_MAX_RADIUS, easeOut(rippleProgress))
      const rippleAlpha = lerp(0.35, 0, easeOut(rippleProgress))

      ctx.beginPath()
      ctx.arc(finger.x, finger.y, rippleRadius, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(hlColor, rippleAlpha)
      ctx.lineWidth = lerp(3, 1, rippleProgress)
      ctx.stroke()
    }
  },

  /**
   * 绘制结果状态的手指
   */
  drawResultFinger(ctx, finger, id, isSelected, isGroupMode, now) {
    const resultElapsed = now - this.resultTime

    if (isSelected) {
      // --- 选中的手指：弹性放大 + 大光晕 + 呼吸 ---
      const growProgress = Math.min(1, resultElapsed / 500)
      const easedGrow = elasticOut(growProgress)
      const targetRadius = CONFIG.SELECTED_RADIUS
      const currentRadius = lerp(CONFIG.FINGER_RADIUS, targetRadius, easedGrow)
      const breathAlpha = pulse(now, CONFIG.RESULT_PULSE_PERIOD, 0.85, 1.0)

      const hlColor = getHighlightColor(finger.color)

      // 选中瞬间白色闪烁
      if (resultElapsed < 200) {
        const flashAlpha = lerp(0.5, 0, resultElapsed / 200)
        const flashRadius = lerp(currentRadius, currentRadius * 2.5, easeOut(resultElapsed / 200))
        ctx.beginPath()
        ctx.arc(finger.x, finger.y, flashRadius, 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba('#ffffff', flashAlpha)
        ctx.fill()
      }

      // 大范围柔和光晕
      const glowRadius = currentRadius * 4
      const gradient = ctx.createRadialGradient(
        finger.x, finger.y, currentRadius * 0.3,
        finger.x, finger.y, glowRadius
      )
      gradient.addColorStop(0, hexToRgba(hlColor, 0.35 * breathAlpha))
      gradient.addColorStop(0.3, hexToRgba(hlColor, 0.12 * breathAlpha))
      gradient.addColorStop(0.6, hexToRgba(hlColor, 0.04 * breathAlpha))
      gradient.addColorStop(1, hexToRgba(hlColor, 0))
      ctx.beginPath()
      ctx.arc(finger.x, finger.y, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // 主圆 - 带内部高光
      const mainGradient = ctx.createRadialGradient(
        finger.x - currentRadius * 0.15, finger.y - currentRadius * 0.15, 0,
        finger.x, finger.y, currentRadius
      )
      mainGradient.addColorStop(0, hexToRgba('#ffffff', breathAlpha * 0.25))
      mainGradient.addColorStop(0.3, hexToRgba(hlColor, breathAlpha))
      mainGradient.addColorStop(1, hexToRgba(finger.color, breathAlpha * 0.9))
      ctx.beginPath()
      ctx.arc(finger.x, finger.y, currentRadius, 0, Math.PI * 2)
      ctx.fillStyle = mainGradient
      ctx.fill()

      // 高亮外环
      ctx.beginPath()
      ctx.arc(finger.x, finger.y, currentRadius + 5, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(hlColor, breathAlpha * 0.6)
      ctx.lineWidth = 3
      ctx.stroke()

    } else {
      // --- 未选中的手指：缩小 + 淡出 ---
      const fadeProgress = Math.min(1, resultElapsed / CONFIG.RESULT_FADE_DURATION)
      const alpha = 1 - easeOut(fadeProgress)

      if (alpha <= 0.01) return

      const shrinkRadius = lerp(CONFIG.FINGER_RADIUS, CONFIG.FINGER_RADIUS * 0.4, easeOut(fadeProgress))

      ctx.beginPath()
      ctx.arc(finger.x, finger.y, shrinkRadius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(finger.color, alpha * 0.35)
      ctx.fill()
    }
  },

  /**
   * 绘制分组结果（每组不同颜色）
   */
  drawGroupResult(ctx, finger, id, now) {
    const resultElapsed = now - this.resultTime

    const groupIndex = this.groupIndexMap[id]
    if (groupIndex === undefined) return

    const groupColor = GROUP_COLORS[groupIndex % GROUP_COLORS.length]
    const growProgress = Math.min(1, resultElapsed / 450)
    const easedGrow = elasticOut(growProgress)
    const currentRadius = lerp(CONFIG.FINGER_RADIUS * 0.7, CONFIG.FINGER_RADIUS * 1.15, easedGrow)
    const breathAlpha = pulse(now, 2200, 0.72, 0.98)

    // 光晕
    const glowRadius = currentRadius * 3
    const gradient = ctx.createRadialGradient(
      finger.x, finger.y, currentRadius * 0.3,
      finger.x, finger.y, glowRadius
    )
    gradient.addColorStop(0, hexToRgba(groupColor, 0.22 * breathAlpha))
    gradient.addColorStop(0.5, hexToRgba(groupColor, 0.06 * breathAlpha))
    gradient.addColorStop(1, hexToRgba(groupColor, 0))
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // 主圆（带内部高光）
    const mainGradient = ctx.createRadialGradient(
      finger.x - currentRadius * 0.15, finger.y - currentRadius * 0.15, 0,
      finger.x, finger.y, currentRadius
    )
    mainGradient.addColorStop(0, hexToRgba('#ffffff', breathAlpha * 0.15))
    mainGradient.addColorStop(0.4, hexToRgba(groupColor, breathAlpha))
    mainGradient.addColorStop(1, hexToRgba(groupColor, breathAlpha * 0.85))
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, currentRadius, 0, Math.PI * 2)
    ctx.fillStyle = mainGradient
    ctx.fill()

    // 外环
    ctx.beginPath()
    ctx.arc(finger.x, finger.y, currentRadius + 4, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba(groupColor, breathAlpha * 0.45)
    ctx.lineWidth = 2.5
    ctx.stroke()

    // 组编号
    ctx.save()
    ctx.fillStyle = hexToRgba('#FFFFFF', breathAlpha * 0.95)
    // 使用固定字体大小避免动画过程中文字闪烁
    const fontSize = Math.round(CONFIG.FINGER_RADIUS * 1.15 * 0.65)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${groupIndex + 1}`, finger.x, finger.y + 1)
    ctx.restore()
  },

  // ========== 音效 ==========

  playTapSound() {
    const app = getApp()
    if (!app.globalData.soundEnabled || !this.tapSound) return
    try {
      this.tapSound.stop()
      this.tapSound.seek(0)
      this.tapSound.play()
    } catch (e) {}
  },

  playSelectSound() {
    const app = getApp()
    if (!app.globalData.soundEnabled || !this.selectSound) return
    try {
      this.selectSound.stop()
      this.selectSound.seek(0)
      this.selectSound.play()
    } catch (e) {}
  },

  // ========== 导航 ==========

  goSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings',
    })
  },
})
