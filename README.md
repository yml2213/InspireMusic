# InspireMusic

[在线体验](https://inspire-music.pages.dev/) | [下载 Windows 桌面端](https://github.com/yml2213/InspireMusic/releases)

一个现代化的纯前端音乐 APP,可以在 Cloudflare Pages / Netlify / Vercel 上轻松部署,同时提供 Windows 桌面端。

后端基于 [TuneHub API](https://api.tunefree.fun/),请多多支持后端项目原作者开发的 [TuneFreeNext](https://tunefree.fun/),更强大、更好用。

## ⚠️ 免责声明

 1. 本项目仅供个人学习研究使用，禁止用于商业及非法用途。使用本项目所产生的一切后果由使用者自行承担，开发者不承担任何责任。
 2. 本项目由目前最先进的多款 AI Agent 联合开发，99.9% 以上代码由 AI 生成。虽然经过多轮迭代和代码审查，且以 MIT 许可证完全开源，但无法为可靠性提供任何保证。
 3. 我们承诺，本项目：不存储版权资源、不提供下载功能、不以任何形式盈利。
 4. 在部分平台或服务器上部署此类项目，可能面临版权投诉，请遵守相关平台规则。

## 📌 已知问题

 1. 受限于浏览器安全策略，部分资源无法在 https 生产环境中加载，但使用桌面端不受影响。
 2. 我们暂未提供 Linux 或 Mac OS 的打包，但您可以使用 Tauri 自行打包和体验。
 3. 本项目没有在非 Chrome 内核的浏览器上进行测试，不保证完全正常的显示效果。
 4. 使用 Windows 桌面端需要 Webview2 支持，已知在 Windows 10（从版本 1803 开始）和更高版本的 Windows 上默认提供，如您使用其他 Windows 版本，请自行研究解决方案。

## ✨ 功能特性

- **🔍 聚合搜索** - 支持网XX音乐、酷X音乐、QX音乐聚合搜索
- **📋 歌单管理** - 创建、导入、管理自定义歌单
- **❤️ 收藏功能** - 轻松收藏和管理喜爱的歌曲
- **⏰ 定时播放** - 睡眠定时器，支持自定义时长
- **🎨 响应式设计** - 完美适配 PC 和移动端
- **📱 PWA 支持** - 可安装为桌面/移动应用，支持媒体会话通知
- **💾 智能缓存** - 本地缓存歌曲信息，减少重复请求

## 🛠️ 技术栈

### 核心框架

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.2.3 | 前端 UI 框架 |
| TypeScript | 5.9.3 | 类型安全的 JavaScript |
| Vite | 7.2.7 | 下一代前端构建工具 |

### 样式与动画

| 技术 | 版本 | 说明 |
|------|------|------|
| Tailwind CSS | 4.1.18 | 原子化 CSS 框架 |
| Framer Motion | 12.23.26 | React 动画库 |
| Lucide React | 0.561.0 | 精美图标库 |

### 工具链

| 技术 | 版本 | 说明 |
|------|------|------|
| ESLint | 9.39.1 | 代码规范检查 |
| PostCSS | 8.5.6 | CSS 处理器 |
| vite-plugin-pwa | 1.2.0 | PWA 支持插件 |

## 📱 PWA 功能

应用支持 PWA (Progressive Web App)，具有以下特性：

- **可安装** - 在浏览器地址栏点击安装按钮，添加到桌面/启动器
- **离线支持** - Service Worker 缓存静态资源
- **媒体会话** - 在系统通知中心显示当前播放歌曲，支持控制播放

## ☁️ 部署 (Cloudflare Pages)

本项目已针对 Cloudflare Pages 进行了深度优化,支持边缘计算功能(User Management / History / Admin)。

### 1. 准备工作
- Cloudflare 账号
- Node.js 环境
- Git 仓库

### 2. KV 存储配置
在 Cloudflare Dashboard 中创建两个 KV Namespace:
- `inspire-users` - 用于存储用户数据
- `inspire-history` - 用于存储播放历史

或者使用 Wrangler CLI 创建:
```bash
npx wrangler kv:namespace create USERS_KV
npx wrangler kv:namespace create HISTORY_KV
```

### 3. 项目配置
修改 `wrangler.toml` 文件,填入你的 KV Namespace ID:

```toml
[[kv_namespaces]]
binding = "USERS_KV"
id = "<YOUR_USERS_KV_ID>"  # 替换为你的 USERS_KV ID

[[kv_namespaces]]
binding = "HISTORY_KV"
id = "<YOUR_HISTORY_KV_ID>"  # 替换为你的 HISTORY_KV ID

[vars]
ADMIN_PASSWORD = "your_secure_password"  # 修改为安全的管理员密码
```

### 4. 部署
```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build

# 部署到 Cloudflare Pages (确保部署 dist 目录而非根目录)
npx wrangler pages deploy dist
```

### 5. 注意事项
⚠️ **重要**: 部署时必须使用 `dist` 目录,而不是项目根目录 `.`
- ✅ 正确: `npx wrangler pages deploy dist`
- ❌ 错误: `npx wrangler pages deploy .`

如果使用 Git 集成部署,确保 Cloudflare Pages 的构建配置为:
- **构建命令**: `pnpm build`
- **构建输出目录**: `dist`
- **根目录**: `/` (项目根目录)

## 🔐 核心功能增强 (Cloudflare KV)

部署到 Cloudflare 后，将自动启用以下功能：

- **👤 用户系统** - 注册/登录，数据存储在 KV
- **📜 播放记录** - 自动云端同步播放历史
- **🛡️ 管理接口** - 提供 RESTful API 管理用户数据


## 🚀 快速开始

### 本地开发
```bash
# 克隆项目
git clone https://github.com/yml2213/InspireMusic.git
cd InspireMusic

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

### Tauri 桌面端开发
```bash
# 启动 Tauri 开发模式
pnpm tauri:dev

# 构建桌面应用
pnpm tauri:build
```

## 🚀 开发环境要求

- Node.js v24.12.0+
- pnpm 10.25.0+

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

## 🙏 致谢

- [TuneHub API](https://api.tunefree.fun/) - 提供强大的音乐 API 支持
- [TuneFreeNext](https://tunefree.fun/) - 更强大的音乐播放器
- 所有为本项目做出贡献的开发者

## ⚠️ 重要提醒

本项目由 AI Agent 辅助开发,代码质量已经过多轮审查和测试,但仍建议在生产环境使用前进行充分测试。如发现问题,欢迎提交 Issue 或 Pull Request。
