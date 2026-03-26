// pages/settings/settings.js
Page({
  data: {
    mode: 'single',
    selectCount: 2,
    groupCount: 2,
    soundEnabled: true,
    vibrateEnabled: true,
    statusBarHeight: 20,
    navHeight: 64,
  },

  onLoad() {
    // 获取系统信息计算导航栏高度
    const sysInfo = wx.getWindowInfo()
    const statusBarHeight = sysInfo.statusBarHeight || 20
    const navHeight = statusBarHeight + 44 // 44 是导航栏内容区高度

    // 从全局读取当前设置
    const app = getApp()
    const { mode, selectCount, groupCount, soundEnabled, vibrateEnabled } = app.globalData

    this.setData({
      mode,
      selectCount,
      groupCount,
      soundEnabled,
      vibrateEnabled,
      statusBarHeight,
      navHeight,
    })
  },

  onUnload() {
    // 页面销毁时保存设置
    this.saveToGlobal()
  },

  // ========== 模式切换 ==========

  setMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode })
    this.saveToGlobal()
    this.triggerLightVibrate()
  },

  // ========== 多选人数 ==========

  increaseSelectCount() {
    if (this.data.selectCount >= 9) return
    this.setData({ selectCount: this.data.selectCount + 1 })
    this.saveToGlobal()
    this.triggerLightVibrate()
  },

  decreaseSelectCount() {
    if (this.data.selectCount <= 2) return
    this.setData({ selectCount: this.data.selectCount - 1 })
    this.saveToGlobal()
    this.triggerLightVibrate()
  },

  // ========== 分组数量 ==========

  increaseGroupCount() {
    if (this.data.groupCount >= 6) return
    this.setData({ groupCount: this.data.groupCount + 1 })
    this.saveToGlobal()
    this.triggerLightVibrate()
  },

  decreaseGroupCount() {
    if (this.data.groupCount <= 2) return
    this.setData({ groupCount: this.data.groupCount - 1 })
    this.saveToGlobal()
    this.triggerLightVibrate()
  },

  // ========== 开关 ==========

  toggleSound(e) {
    this.setData({ soundEnabled: e.detail.value })
    this.saveToGlobal()
  },

  toggleVibrate(e) {
    this.setData({ vibrateEnabled: e.detail.value })
    this.saveToGlobal()
  },

  // ========== 保存 ==========

  saveToGlobal() {
    const app = getApp()
    const { mode, selectCount, groupCount, soundEnabled, vibrateEnabled } = this.data
    Object.assign(app.globalData, { mode, selectCount, groupCount, soundEnabled, vibrateEnabled })
    app.saveSettings()
  },

  triggerLightVibrate() {
    if (!this.data.vibrateEnabled) return
    try {
      wx.vibrateShort({ type: 'light' })
    } catch (e) {
      // 静默失败（某些设备或环境不支持）
    }
  },

  // ========== 分享 ==========

  onShareAppMessage() {
    return {
      title: '所有人把手指放上来！随机帮你选',
      path: '/pages/index/index',
    }
  },

  // ========== 导航 ==========

  goBack() {
    wx.navigateBack()
  },
})
