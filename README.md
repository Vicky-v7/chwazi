# Chwazi吃袜子选人 🤚

> 把命运交给手指！所有人按住屏幕，屏息等待——被选中的就是天选之人。

一款**微信小程序**，复刻经典 [Chwazi](https://apps.apple.com/us/app/chwazi-finger-chooser/id689674978) App 的核心体验：多人同时把手指放在屏幕上，随机选中一个人。聚餐买单、桌游先手、团建分组，一按搞定。

## 功能

- **三种模式**：随机选一人 / 选多人 / 自动分组
- **炫酷动画**：手指按下渐入、等待呼吸脉冲、扫描选择、波纹扩散
- **多感官反馈**：音效 + 震动 + 视觉动画
- **分享功能**：转发好友 / 分享朋友圈

## 使用方式

1. 设置模式（选几人 / 分几组）
2. 所有人把手指放到屏幕上
3. 等待倒计时动画
4. 被选中的手指高亮，其余淡出

## 技术栈

- 微信原生小程序（WXML / WXSS / JS）
- Canvas 2D + requestAnimationFrame 实现 60fps 动画
- 多指触控（touchstart / touchmove / touchend）
- Fisher-Yates 洗牌算法
- 零第三方依赖

## 为什么做这个

原版 Chwazi 是 iOS/Android App，2025 年已从 Google Play 下架，且没有微信小程序版本。在国内聚会场景里，让大家装一个 App 太重了，小程序扫码即用才是正确的打开方式。

目前微信生态内**没有同类的手指触屏选人小程序**，这是一个蓝海。

## 项目结构

```
miniprogram/
├── pages/
│   ├── index/          # 主页面（Canvas 触控 + 动画）
│   └── settings/       # 设置页（模式选择）
├── utils/
│   ├── random.js       # 随机选择 & 分组算法
│   ├── colors.js       # 颜色配置
│   └── animation.js    # 缓动函数
├── assets/sounds/      # 音效资源
└── app.js              # 全局入口 & 设置管理
```

## 本地开发

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目，选择 `miniprogram/` 目录
3. 使用自己的 AppID 或测试号

## License

MIT
