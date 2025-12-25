# 扫雷游戏网页版

一个现代化的网页版扫雷游戏，采用扁平化设计，支持响应式布局，可在 GitHub Pages 上免费部署。

![游戏截图](https://img.shields.io/badge/status-稳定-success) ![GitHub](https://img.shields.io/github/license/yourusername/minesweeper)

## 功能特点

- **经典扫雷规则**：左键翻开格子，右键标记/取消标记地雷
- **三种难度**：
  - 初级：9×9 网格，10 颗地雷
  - 中级：16×16 网格，40 颗地雷
  - 高级：16×30 网格，99 颗地雷
- **游戏状态显示**：
  - 实时计时器
  - 剩余地雷计数器
  - 重置按钮（动态表情）
- **智能提示系统**：
  - 每局游戏最多可使用 3 次提示
  - 自动高亮一个安全格子
- **撤销标记**：右键点击已标记的格子可撤销标记
- **响应式设计**：完美适配桌面、平板和手机
- **触摸支持**：移动设备上长按模拟右键
- **无障碍支持**：键盘导航、高对比度模式
- **游戏数据统计**：记录玩家的胜负记录、连胜/连败、最佳用时等统计信息，支持按难度查看。

## 在线演示

访问 [GitHub Pages 部署链接](https://heliosdragon.github.io/minesweeper/) 体验游戏。

## 本地运行

1. 克隆仓库：
   ```bash
   git clone https://github.com/heliosdragon/minesweeper.git
   cd minesweeper
   ```

2. 使用任意 HTTP 服务器打开 `index.html`，例如：
   ```bash
   # Python 3
   python -m http.server 8000
   # 或使用 Node.js 的 http-server
   npx http-server
   ```

3. 在浏览器中访问 `http://localhost:8000`

## 项目结构

```
minesweeper/
├── index.html          # 主页面
├── css/
│   ├── reset.css      # 样式重置
│   ├── style.css      # 全局样式
│   └── game.css       # 游戏网格样式
├── js/
│   ├── utils.js       # 工具函数（开发用）
│   ├── game.js        # 游戏核心逻辑（开发用）
│   ├── ui.js          # 用户界面交互（开发用）
│   ├── stats.js       # 游戏数据统计模块（开发用）
│   └── bundle.js      # 打包合并后的脚本（生产用）
├── assets/
│   └── icons/         # 图标资源（favicon.ico 等）
└── README.md          # 说明文档
```

## 技术栈

- **HTML5**：语义化标签，无障碍支持
- **CSS3**：Flexbox、Grid、CSS 变量、媒体查询
- **JavaScript (ES6+)**：模块化编程，面向对象设计
- **GitHub Pages**：静态网站托管

## 开发指南

### 代码架构
- `game.js`：游戏核心逻辑，包含 `Game` 类、网格生成、地雷布置、胜负判断、空白展开、提示系统等。
- `ui.js`：用户界面管理，负责渲染网格、绑定事件、更新状态、高亮提示等。
- `utils.js`：通用工具函数（随机数、DOM 操作、防抖节流等）。
- `stats.js`：游戏数据统计模块，负责记录玩家成绩、计算胜率、连胜/连败、最佳用时等统计数据。
- `bundle.js`：由上述四个源文件合并而成的生产打包文件，用于 `index.html` 直接引用。

### 打包流程
开发时修改 `utils.js`、`game.js`、`ui.js`、`stats.js` 后，需重新生成 `bundle.js`。可使用以下命令（Node.js 环境）：
```bash
cd minesweeper
node -e "const fs = require('fs'); const files = ['js/utils.js', 'js/game.js', 'js/ui.js', 'js/stats.js']; const bundle = files.map(f => fs.readFileSync(f, 'utf8')).join('\n\n'); fs.writeFileSync('js/bundle.js', bundle); console.log('打包完成');"
```
或手动复制粘贴四个文件内容到 `bundle.js`。

### 添加新功能
1. 在 `game.js` 中扩展 `Game` 类
2. 在 `ui.js` 中更新 UI 交互
3. 在 CSS 中添加相应样式


## 已知限制
- 排行榜功能（全站排名）暂未实现（计划在第二阶段添加）
- 不支持保存游戏进度
- 音效和高级动画待增强

## 贡献
欢迎提交 Issue 和 Pull Request 改进项目。

## 许可证
本项目采用 [MIT 许可证](LICENSE)。

## 更新

### v1.4 (2025‑12‑25)
- **修复连胜/连败逻辑**：修正 `stats.js` 中当前连胜/连败的计算错误，确保连败时能正确累积并更新状态栏。
- **控制面板连胜计数器**：在控制面板（计时器旁）添加独立的连胜/连败显示元素，实时显示当前连胜/连败次数，并通过图标（奖杯/拇指朝下）与颜色（绿色/红色）直观区分。
- **计时器风格化**：为计时器添加数字显示屏风格（深色背景、绿色发光文字、等宽字体），提升视觉冲击力。
- **苹果风格设计升级**：全面应用 Apple‑like 设计系统，定义 CSS 变量（颜色、圆角、阴影、过渡），更新头部、控制面板、网格、游戏状态、统计面板等组件的颜色、字体、间距与阴影，实现现代扁平化设计。
- **图标与细节优化**：改进地雷图标显示，使用 Font Awesome 图标并调整大小与颜色；优化格子、按钮等交互元素的视觉效果。

#### 已知问题（待解决）
- **提示功能失效**：点击提示按钮后可能无法正确高亮安全格子，需检查 `game.js` 中的提示逻辑。
- **上方连胜连败展示不刷新**：控制面板中的连胜/连败标签（“连胜/连败”）未根据当前状态动态切换为“连胜”或“连败”，仍保持静态文本。需进一步调整 UI 逻辑。

### v1.3 (2025‑12‑25)
- **新增游戏数据统计**：记录玩家的胜负记录、连胜/连败、最佳用时等统计数据，支持按难度查看。
- **统计展示 UI**：在游戏区域下方新增统计面板，默认显示连胜/连败和最佳用时，点击“详细统计”可展开完整数据。
- **本地存储**：使用 localStorage 保存最多1000条游戏记录，跨浏览器会话持久化。
- **代码重构**：新增 `stats.js` 模块，集成到打包流程；优化空白展开算法，修复 UI 刷新问题。

### v1.1 (2025‑12‑25)
- **修复空白展开功能**：点击周围无地雷的格子（数字0）现在会自动翻开相邻的所有空白区域。
- **修复提示功能**：提示按钮现在会正确高亮一个随机的未翻开非地雷格子，并显示脉冲动画。
- **代码优化**：增加 `onCellRevealed` 和 `onHintApplied` 回调，改进 UI 同步。
- **调试日志**：在控制台输出关键操作信息，便于问题排查。

### v1.0 (2025‑12‑24)
- 初始版本发布，包含扫雷核心玩法、三种难度、计时器、提示系统、响应式设计。

## 致谢
- 灵感来源于经典 Windows 扫雷游戏
- 图标来自 [Font Awesome](https://fontawesome.com)
- 字体使用 [Inter](https://fonts.google.com/specimen/Inter)
- 部署工具 [GitHub Pages](https://pages.github.com)

---
*开发日期：2025年12月*
*最后更新：2025-12-26*