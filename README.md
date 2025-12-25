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

## 在线演示

访问 [GitHub Pages 部署链接](https://yourusername.github.io/minesweeper/) 体验游戏。

## 本地运行

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/minesweeper.git
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
│   ├── utils.js       # 工具函数
│   ├── game.js        # 游戏核心逻辑
│   └── ui.js          # 用户界面交互
└── README.md          # 说明文档
```

## 技术栈

- **HTML5**：语义化标签，无障碍支持
- **CSS3**：Flexbox、Grid、CSS 变量、媒体查询
- **JavaScript (ES6+)**：模块化编程，面向对象设计
- **GitHub Pages**：静态网站托管

## 部署到 GitHub Pages

### 方法一：使用 `docs` 文件夹
1. 将本仓库 `minesweeper` 文件夹重命名为 `docs`
2. 在 GitHub 仓库设置中启用 GitHub Pages，选择 `docs` 文件夹作为源

### 方法二：使用根目录
1. 将 `minesweeper` 文件夹内所有文件移动到仓库根目录
2. 在 GitHub 仓库设置中启用 GitHub Pages，选择 `main` 分支根目录

### 方法三：使用 GitHub Actions（推荐）
1. 在仓库根目录创建 `.github/workflows/deploy.yml`：
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [ main ]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: |
             cd minesweeper
             # 可选：构建步骤（如压缩）
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./minesweeper
   ```
2. 推送后会自动部署到 `gh-pages` 分支

## 开发指南

### 代码架构
- `game.js`：游戏核心逻辑，包含 `Game` 类、网格生成、地雷布置、胜负判断
- `ui.js`：用户界面管理，负责渲染网格、绑定事件、更新状态
- `utils.js`：通用工具函数（随机数、DOM 操作等）

### 添加新功能
1. 在 `game.js` 中扩展 `Game` 类
2. 在 `ui.js` 中更新 UI 交互
3. 在 CSS 中添加相应样式

### 测试
游戏已通过以下测试：
- 不同难度下的游戏流程
- 计时器与计数器准确性
- 提示系统次数限制
- 响应式布局断点
- 跨浏览器兼容性（Chrome、Firefox、Safari、Edge）

## 已知限制
- 排行榜功能暂未实现（计划在第二阶段添加）
- 不支持保存游戏进度
- 音效和高级动画待增强

## 贡献
欢迎提交 Issue 和 Pull Request 改进项目。

## 许可证
本项目采用 [MIT 许可证](LICENSE)。

## 致谢
- 灵感来源于经典 Windows 扫雷游戏
- 图标来自 [Font Awesome](https://fontawesome.com)
- 字体使用 [Inter](https://fonts.google.com/specimen/Inter)
- 部署工具 [GitHub Pages](https://pages.github.com)

---
*开发日期：2025年12月*
*最后更新：2025-12-25*