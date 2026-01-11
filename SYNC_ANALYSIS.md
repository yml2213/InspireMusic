# InspireMusic 同步逻辑与账号系统分析

## 📊 当前架构概览

### 1. 认证系统 (Authentication)

**前端**: `src/store/authStore.ts`
- **存储方式**: Zustand + localStorage 持久化
- **存储内容**:
  - `user`: { id, email }
  - `token`: JWT Token (7天有效期)
  - `isAuthenticated`: 登录状态

**后端**: `functions/api/auth/`
- **登录** (`login.ts`): 验证邮箱密码,返回 JWT Token
- **注册** (`register.ts`): 创建新用户,存储到 Cloudflare KV
- **Token 验证**: JWT 签名验证 (HMAC-SHA256)

---

## ✅ 已实现的云端同步功能 (更新于 2026-01-11)

### 1. 播放历史同步 ⭐ (已完整实现)

**API 端点**: `/api/user/history`

**实现位置**:
- 后端: `functions/api/user/history.ts`
- 前端: `src/App.tsx:422-442`

**同步逻辑**:
```typescript
// 前端自动记录逻辑
useEffect(() => {
  if (isPlaying && currentSong && user && token) {
    const songId = `${currentSong.platform}-${currentSong.id}`;
    if (lastRecordedSongIdRef.current !== songId) {
      lastRecordedSongIdRef.current = songId;

      // 自动调用 API 记录播放历史
      fetch('/api/user/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(currentSong)
      }).catch(console.error);
    }
  }
}, [isPlaying, currentSong, user, token]);
```

**功能特性**:
- ✅ 自动记录: 播放歌曲时自动上传
- ✅ 去重机制: 同一首歌不重复记录
- ✅ 数据限制: 最多保存 100 条历史记录
- ✅ 时间戳: 自动添加 `playedAt` 时间戳
- ✅ 云端存储: 存储在 Cloudflare KV (`history:{userId}`)

**API 操作**:
- `GET /api/user/history` - 获取播放历史
- `POST /api/user/history` - 添加播放记录
- `DELETE /api/user/history` - 清空播放历史

---

## ❌ 原计划未实现的同步功能 → ✅ 已于 2026-01-11 完成!

### 2. 收藏歌曲同步 ✅ (已完整实现)

**当前实现**:
- 后端 API: `functions/api/user/favorites.ts`
- 前端服务: `src/services/sync.ts`
- Store 集成: `src/store/useAppStore.ts:149-186`

**功能特性**:
- ✅ 添加/删除收藏自动同步到云端
- ✅ 登录后从云端加载收藏列表
- ✅ 失败时自动回滚本地状态
- ✅ 同步状态实时反馈

**存储位置**:
- ✅ 本地: localStorage (`inspire-music-store`)
- ✅ 云端: Cloudflare KV (`favorites:{userId}`)

**API 端点**:
```
GET    /api/user/favorites           # 获取收藏列表
POST   /api/user/favorites           # 添加收藏
DELETE /api/user/favorites?id=&platform= # 删除收藏
PUT    /api/user/favorites           # 批量同步
```

---

### 3. 自定义歌单同步 ✅ (已完整实现)

**当前实现**:
- 后端 API: `functions/api/user/playlists.ts`
- 前端服务: `src/services/sync.ts`
- Store 集成: `src/store/useAppStore.ts:188-314`

**功能特性**:
- ✅ 创建/更新/删除歌单自动同步
- ✅ 歌单内歌曲管理同步
- ✅ 登录后从云端加载所有歌单
- ✅ 失败时自动回滚本地状态

**存储位置**:
- ✅ 本地: localStorage (`inspire-music-store`)
- ✅ 云端: Cloudflare KV (`playlists:{userId}`)

**API 端点**:
```
GET    /api/user/playlists           # 获取所有歌单
POST   /api/user/playlists           # 创建歌单
PUT    /api/user/playlists           # 更新歌单/批量同步
DELETE /api/user/playlists?id=       # 删除歌单
```

---

## 🎨 同步状态 UI 指示器 ✅ (已实现)

**实现位置**: `src/components/SyncIndicator.tsx`

**功能特性**:
- ✅ 右上角浮层显示同步状态
- ✅ 四种状态:同步中/成功/失败/空闲
- ✅ Framer Motion 动画效果
- ✅ 自动隐藏(成功后 2 秒)
- ✅ 仅在登录状态显示

---

## ⏳ 未来可选优化功能

## 📦 本地持久化数据 (localStorage)

### 存储结构

**Key**: `inspire-music-store`

**持久化内容** (见 `src/store/useAppStore.ts:196-209`):
```typescript
{
  currentSong: Song | null,      // 当前播放歌曲
  queue: Song[],                 // 播放队列
  queueIndex: number,            // 队列索引
  volume: number,                // 音量 (0-1)
  playMode: 'list'|'shuffle'|'single', // 播放模式
  quality: Quality,              // 音质偏好 (128k/320k/flac)
  favorites: Song[],             // ⭐ 收藏列表 (仅本地)
  playlists: LocalPlaylist[],    // ⭐ 歌单列表 (仅本地)
  savedProgress: number,         // 播放进度
}
```

### 不持久化内容 (会话状态):
- `isPlaying`: 播放状态
- `lyrics`: 歌词
- `currentInfo`: 歌曲详情
- `infoError`: 错误信息
- `sleepEndTime`: 睡眠定时器

---

## 🔄 数据同步触发时机

### 自动同步:
1. **播放历史**:
   - 触发: 播放歌曲时
   - 频率: 每首歌播放时记录一次

### 手动操作 (无同步):
2. **收藏/取消收藏**:
   - 触发: 用户点击收藏按钮
   - 同步: ❌ 无

3. **创建/编辑/删除歌单**:
   - 触发: 用户操作歌单
   - 同步: ❌ 无

---

## 🛡️ 权限控制

### Token 验证流程:
```
客户端请求 → Authorization: Bearer {token}
           ↓
      后端验证 JWT
           ↓
   ✅ 通过: 返回数据
   ❌ 失败: 401 Unauthorized
```

### Token 信息:
- **有效期**: 7 天
- **加密**: HMAC-SHA256
- **Payload**: `{ sub: userId, email, iat, exp }`

---

## 📊 数据流向图 (更新于 2026-01-11)

```
┌─────────────────────────────────────────────────┐
│                   用户界面                       │
│  (收藏/歌单/播放历史)                             │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│          Zustand Store (状态管理)                │
│  • authStore (认证)                              │
│  • useAppStore (播放/收藏/歌单)                  │
└────┬─────────────────────────┬──────────────────┘
     │                         │
     ▼                         ▼
┌──────────────┐      ┌──────────────────────────┐
│  localStorage│      │   Cloudflare Pages API   │
│  (本地持久化) │      │   (云端同步)             │
│              │      │                          │
│ • 收藏 ✅    │      │ • 播放历史 ✅            │
│ • 歌单 ✅    │      │ • 收藏 ✅ (已实现)       │
│ • 播放状态   │      │ • 歌单 ✅ (已实现)       │
└──────────────┘      └───────┬──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Cloudflare KV   │
                    │                  │
                    │ • USERS_KV       │
                    │ • HISTORY_KV     │
                    │   - history:{id} │
                    │   - favorites:{id}│
                    │   - playlists:{id}│
                    └──────────────────┘
```

---

## 🔧 技术债务

### 安全问题:
1. **JWT Secret 硬编码**: `temp_secret_key_change_me`
   - 建议: 使用环境变量 `env.JWT_SECRET`

2. **密码存储**: SHA-256 + salt
   - 现状: 可接受
   - 建议: 考虑升级到 bcrypt/argon2

### 性能优化:
1. **播放历史限制**: 100 条
   - 现状: 合理
   - 建议: 可考虑分页加载

2. **本地缓存**:
   - 现状: API 响应有缓存 (`src/utils/cache.ts`)
   - 建议: 继续优化缓存策略

---

## 📝 总结

### ✅ 已实现:
- ✅ 用户注册/登录系统
- ✅ JWT Token 认证
- ✅ 播放历史云端同步 (自动)
- ✅ **收藏歌曲云端同步** (2026-01-11 新增)
- ✅ **自定义歌单云端同步** (2026-01-11 新增)
- ✅ **同步状态 UI 指示器** (2026-01-11 新增)

### 🎉 功能完整度:
- ✅ 多设备同步收藏和歌单
- ✅ 云端优先策略(登录后加载云端数据)
- ✅ 乐观 UI 更新(失败自动回滚)
- ✅ 实时同步状态反馈

### ⏳ 未实现(可选):
- ⏳ 用户设置云端同步(音质、音量等)
- ⏳ 冲突检测和解决
- ⏳ 离线队列同步
- ⏳ 实时协同编辑

### 🎯 下一步建议:
**核心功能已完成!** 可部署到生产环境使用。详见 [SYNC_IMPLEMENTATION.md](SYNC_IMPLEMENTATION.md) 获取完整的实现说明和测试指南。
