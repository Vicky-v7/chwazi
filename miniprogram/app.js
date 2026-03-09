// app.js
App({
  globalData: {
    // 选人模式: 'single' 单选 | 'multi' 多选 | 'group' 分组
    mode: 'single',
    // 选中数量（multi模式下生效）
    selectCount: 2,
    // 分组数量（group模式下生效）
    groupCount: 2,
    // 是否开启音效
    soundEnabled: true,
    // 是否开启震动
    vibrateEnabled: true,
  },

  onLaunch() {
    // 从本地缓存读取设置
    this.loadSettings()
  },

  loadSettings() {
    try {
      const settings = wx.getStorageSync('settings')
      if (settings) {
        // 历史数据迁移：selectCount 最小值改为 2
        if (settings.selectCount && settings.selectCount < 2) {
          settings.selectCount = 2
        }
        Object.assign(this.globalData, settings)
      }
    } catch (e) {
      console.error('读取设置失败', e)
    }
  },

  saveSettings() {
    try {
      const { mode, selectCount, groupCount, soundEnabled, vibrateEnabled } = this.globalData
      wx.setStorageSync('settings', { mode, selectCount, groupCount, soundEnabled, vibrateEnabled })
    } catch (e) {
      console.error('保存设置失败', e)
    }
  },
})
