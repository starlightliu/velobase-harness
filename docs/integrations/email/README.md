# 邮件（Email）集成文档

> 第三方集成梳理 · 第 3 站

## 1. 选型

### 支持的邮件服务

| 服务 | 用途 | 状态 |
|------|------|------|
| Resend | 主力发信（API + React 模板） | ✅ 已接入 |
| SendGrid | 备选发信（API + HTML 模板） | ✅ 已接入 |

### 选型理由

- **Resend**：开发者体验最好，支持 React 组件作为邮件模板，免费额度对个人开发者够用（100 封/天）。
- **SendGrid**：成熟稳定，免费额度更高（100 封/天），作为 Resend 的 fallback。

### 共存关系

两者通过 `EMAIL_PROVIDER` 环境变量控制：
- `resend`：仅用 Resend
- `sendgrid`：仅用 SendGrid
- `auto`（默认）：优先 Resend，失败时自动 fallback 到 SendGrid

### 邮件使用场景

| 场景 | 说明 | 当前实现位置 |
|------|------|------------|
| 认证 Magic Link | 登录/注册时发送一次性登录链接 | `src/server/email/resend.ts` |
| 触达通知 | 订阅提醒、营销邮件等 | `src/server/touch/providers/email/` |
| 客服回复 | 回复用户支持邮件 | `src/server/support/providers/smtp.ts` |

## 2. 架构设计

### 当前状态（问题）

当前有**两套重复的邮件实现**：

```
src/server/email/              ← 第 1 套：仅用于 Magic Link
├── index.ts                   # 只导出 sendMagicLinkEmail
├── resend.ts                  # Resend 实现 + fallback 逻辑
├── sendgrid.ts                # SendGrid 实现
└── templates/magic-link.tsx   # React 邮件模板

src/server/touch/providers/email/  ← 第 2 套：用于触达通知
├── index.ts                   # sendEmail(params) + fallback 逻辑
├── resend.ts                  # Resend 实现
├── sendgrid.ts                # SendGrid 实现
└── types.ts                   # SendEmailParams 类型
```

问题：
1. **代码重复**：两套几乎相同的 Resend/SendGrid 实现 + fallback 逻辑
2. **接口不统一**：`src/server/email/` 只能发 Magic Link，没有通用发信能力
3. **职责混乱**：通用邮件能力被埋在 `touch` 模块内部

### 目标架构

统一为一套邮件能力层：

```
src/server/email/
├── index.ts                   # 统一导出：sendEmail, sendTemplateEmail
├── providers/
│   ├── resend.ts              # Resend 实现
│   └── sendgrid.ts            # SendGrid 实现
├── templates/
│   └── magic-link.tsx         # Magic Link 模板
└── types.ts                   # SendEmailParams, SendEmailResult 类型
```

所有邮件发送（Magic Link、触达、客服）都通过统一的 `sendEmail()` 接口。

### 数据流

```
业务代码
    │
    ├── auth config ──→ sendEmail({ template: "magic-link", ... })
    ├── touch service ──→ sendEmail({ subject, html, ... })
    └── support service ──→ sendEmail({ subject, text, ... })
                              │
                              ▼
                     email capability layer
                     （根据 EMAIL_PROVIDER 选择）
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
                  Resend             SendGrid
              （优先，失败 fallback）
```

## 3. 接口定义

### 统一发信接口

```typescript
interface SendEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  react?: React.ReactElement;  // Resend 专属，SendGrid 时自动降级为 html
  from?: string;               // 可选，默认从 EMAIL_FROM 环境变量读取
  replyTo?: string;
}

interface SendEmailResult {
  provider: "resend" | "sendgrid";
  messageId: string;
}

// 通用发信
function sendEmail(params: SendEmailParams): Promise<SendEmailResult>;

// 模板发信（语法糖）
function sendTemplateEmail(params: {
  to: string;
  template: "magic-link" | "welcome" | "subscription-reminder";
  data: Record<string, unknown>;
}): Promise<SendEmailResult>;
```

### 功能边界

**邮件模块做的事：**
- 发送邮件（文本、HTML、React 模板）
- Provider 选择和 fallback
- 错误处理和日志

**邮件模块不做的事：**
- 邮件模板内容设计（由各业务模块定义）
- 发送频率控制（由调用方负责）
- 收件（IMAP，属于 support 模块）

## 4. 配置

### 环境变量

| 变量 | 必填 | 说明 | 获取方式 |
|------|------|------|---------|
| `RESEND_API_KEY` | 至少配一个 | Resend API Key | [Resend Dashboard](https://resend.com/) → API Keys |
| `SENDGRID_API_KEY` | 至少配一个 | SendGrid API Key | [SendGrid](https://sendgrid.com/) → Settings → API Keys |
| `EMAIL_PROVIDER` | 否 | `resend` / `sendgrid` / `auto`（默认 `auto`） | 手动设置 |
| `EMAIL_FROM` | 否 | 默认发件人地址 | 如 `App <noreply@yourdomain.com>` |

### 第三方平台配置

#### Resend

1. 注册 [Resend](https://resend.com/)
2. Domains → Add Domain → 添加你的发件域名
3. 按提示配置 DNS 记录（MX, SPF, DKIM）
4. API Keys → Create API Key → 复制到 `RESEND_API_KEY`

#### SendGrid

1. 注册 [SendGrid](https://sendgrid.com/)
2. Settings → Sender Authentication → 验证域名
3. Settings → API Keys → Create API Key（Full Access 或 Mail Send 权限）
4. 复制到 `SENDGRID_API_KEY`

## 5. 异常处理

| 场景 | 处理方式 |
|------|---------|
| API Key 未配置 | 抛出明确错误：`Email service not configured: XXX_API_KEY is missing` |
| Resend API 调用失败 | auto 模式下自动 fallback 到 SendGrid，记录 warn 日志 |
| SendGrid API 调用失败 | 抛出错误，记录 error 日志（含 statusCode 和 body） |
| 两个 Provider 都失败 | 抛出 `Failed to send email: All providers failed`，记录两者的错误信息 |
| 收件人地址无效 | 由 Provider API 返回错误，框架透传 |

## 6. AI 引导

### 类型约束

```typescript
// SendEmailParams 的 to 和 subject 是必填的，类型系统强制
sendEmail({
  to: "user@example.com",  // 必填
  subject: "Hello",         // 必填
  html: "<p>Content</p>",   // text 或 html 至少提供一个
});
```

### AI 使用规则（AGENTS.md）

```markdown
## 邮件

- 发送邮件统一使用 `sendEmail()` from `@/server/email`
- 不要直接调用 Resend SDK 或 SendGrid SDK
- 邮件模板放在 `src/server/email/templates/` 下，使用 React 组件（Resend 支持）
- 发件人地址默认从 EMAIL_FROM 环境变量读取，不要硬编码
- 不要在邮件中包含敏感信息（密码、token 等），只放一次性链接
```

## 待办：重构步骤

当前状态到目标架构的重构路径：

1. [ ] 将 `src/server/touch/providers/email/types.ts` 的类型定义移到 `src/server/email/types.ts`
2. [ ] 统一 `src/server/email/` 下的 Resend/SendGrid 实现，合并两套重复代码
3. [ ] 创建统一的 `sendEmail()` 接口替代当前的 `sendMagicLinkEmail()`
4. [ ] 更新 `src/server/auth/config.ts` 中 Magic Link 的发送调用
5. [ ] 更新 `src/server/touch/` 中的邮件发送调用，改为使用统一接口
6. [ ] 删除 `src/server/touch/providers/email/` 下的重复实现
