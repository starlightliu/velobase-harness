# 安全（Security）— Cloudflare Turnstile

## 选型

人机验证（CAPTCHA）用于防止自动化脚本批量注册、薅积分。


| 方案                       | 选择  | 理由                                              |
| ------------------------ | --- | ----------------------------------------------- |
| **Cloudflare Turnstile** | 已选  | 免费、隐私友好、无需用户交互（Managed Challenge）、Cloudflare 生态 |
| Google reCAPTCHA         | 不选  | 需要用户点图片、有隐私争议、部分地区不可用                           |
| hCaptcha                 | 不选  | 类似 reCAPTCHA 体验、免费版功能有限                         |


## 架构

```
┌──────────────────────────────────────────────────────────────┐
│ 前端（用户浏览器）                                              │
│                                                              │
│  login-content.tsx / login-modal-mobile.tsx                   │
│  ├── 加载 Turnstile JS（challenges.cloudflare.com）            │
│  ├── 渲染 widget → 用户自动通过 → 获得 token                    │
│  └── 写入 cookie: cf_turnstile_token（max-age=600）            │
└─────────────────────────┬────────────────────────────────────┘
                          │ 用户点击"发送魔法链接"
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ 后端                                                         │
│                                                              │
│  guardEmail()（anti-abuse/email-guard.ts）                    │
│  └── 层 5：读 cookie cf_turnstile_token                       │
│      └── verifyTurnstileToken()（auth/turnstile.ts）          │
│          └── POST challenges.cloudflare.com/turnstile/v0/    │
│              siteverify { secret, response, remoteip }        │
│              └── success: true → 放行                         │
│              └── success: false → 抛错阻止                    │
└──────────────────────────────────────────────────────────────┘
```

## 代码位置

```
前端：
  src/components/auth/login-content.tsx       — 桌面端 Turnstile widget 渲染
  src/components/auth/login-modal-mobile.tsx   — 移动端 Turnstile widget 渲染
  src/components/auth/use-login.ts            — 导出 TURNSTILE_SITE_KEY、管理 token 状态

后端：
  src/server/auth/turnstile.ts                — verifyTurnstileToken()，核心验证函数
  src/server/features/anti-abuse/email-guard.ts — guardEmail() 的第 5 层自动调用 Turnstile
```

## 对外接口

### 自动集成（默认路径）

Turnstile 已通过 `guardEmail()` 自动集成到魔法链接发送流程中，无需手动调用：

```typescript
// auth/config.ts 中已自动调用，无需业务代码关心
import { guardEmail } from '@/server/features/anti-abuse'
await guardEmail(email, clientIp)
// 内部：临时邮箱检查 → Gmail tricks → 封禁检查 → Turnstile 验证
```

### 手动调用（扩展场景）

如需在其他场景（表单提交、API 请求等）使用 Turnstile 验证：

```typescript
import { verifyTurnstileToken } from '@/server/auth/turnstile'

const result = await verifyTurnstileToken(token, clientIp)
if (!result.success) {
  // 机器人或 token 无效
}
if (result.skipped) {
  // Turnstile 未配置或服务不可用，跳过了验证
}
```

### 前端 Widget（扩展场景）

如需在其他页面添加 Turnstile widget，参考 `login-content.tsx` 的模式：

```typescript
import Script from 'next/script'
import { TURNSTILE_SITE_KEY } from '@/components/auth/use-login'

// 1. 加载 Turnstile JS
<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" />

// 2. 渲染 widget
window.turnstile.render(containerRef.current, {
  sitekey: TURNSTILE_SITE_KEY,
  callback: (token: string) => {
    // 3. 将 token 发送到后端验证
    document.cookie = `cf_turnstile_token=${token}; path=/; max-age=600`
  },
})
```

## 配置

### 环境变量


| 变量                               | 位置  | 必填  | 说明                             |
| -------------------------------- | --- | --- | ------------------------------ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 客户端 | 否   | 前端 widget 站点密钥（未配置则不渲染 widget） |
| `TURNSTILE_SECRET_KEY`           | 服务端 | 否   | 后端 siteverify 密钥（未配置则跳过验证）     |


两个 key 都不配置时，Turnstile 完全禁用，不影响其他功能。

### 获取步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单 → **Turnstile**
3. 点击 **Add Site**
4. 填写站点名称和域名（本地开发可添加 `localhost`）
5. Widget Type 选择 **Managed**（推荐，Cloudflare 自动决定是否展示挑战）
6. 创建后复制 **Site Key** → 填入 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
7. 复制 **Secret Key** → 填入 `TURNSTILE_SECRET_KEY`

### 本地开发

Cloudflare 提供测试用密钥，无需创建真实站点：

```env
# 测试密钥（始终通过验证）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# 测试密钥（始终拒绝）
# TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA

# 测试密钥（强制交互式挑战）
# NEXT_PUBLIC_TURNSTILE_SITE_KEY=3x00000000000000000000FF
```

详见：[Cloudflare Turnstile Testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

## 异常处理

采用 **fail-open** 策略：Turnstile 服务出问题时不阻止正常用户。


| 场景                            | 行为                | 返回值                                        |
| ----------------------------- | ----------------- | ------------------------------------------ |
| `TURNSTILE_SECRET_KEY` 未配置    | 跳过验证，记 debug 日志   | `{ success: true, skipped: true }`         |
| Cloudflare API HTTP 错误（非 200） | 跳过验证，记 warn 日志    | `{ success: true, skipped: true }`         |
| 网络异常（fetch 抛错）                | 跳过验证，记 error 日志   | `{ success: true, skipped: true }`         |
| 验证失败（机器人/无效 token）            | 正常返回失败            | `{ success: false, "error-codes": [...] }` |
| 前端未渲染 widget（无 token）         | `guardEmail()` 抛错 | `TURNSTILE_REQUIRED`                       |


## AI 引导

### 默认行为（无需 AI 操作）

- Turnstile 已自动集成到魔法链接登录流程
- 未配置密钥时自动禁用，不影响开发
- 前端 widget 在用户输入邮箱后自动渲染

### AI 扩展指南

**在新页面添加 Turnstile 验证**：

1. 前端：加载 Turnstile JS + 渲染 widget（参考 `login-content.tsx`）
2. 将 token 通过 cookie 或请求体传到后端
3. 后端：调用 `verifyTurnstileToken(token, ip)` 验证

**切换 Widget 类型**：

- 在 Cloudflare Dashboard 修改，代码无需改动
- Managed（推荐）：自动决定是否展示挑战
- Non-interactive：仅后台验证，用户无感知
- Invisible：完全隐藏（需 JS API 手动触发）

**不要修改的部分**：

- `turnstile.ts` 的 fail-open 策略 — 这是防止误伤的安全设计
- cookie 名 `cf_turnstile_token` — 前后端约定

