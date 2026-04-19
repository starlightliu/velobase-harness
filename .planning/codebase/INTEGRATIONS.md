# 外部集成

**分析日期:** 2026-04-19

## API 与外部服务

**身份与认证:**
- Google OAuth - 用户登录
  - SDK/客户端: `next-auth/providers/google`
  - 鉴权: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - 实现: `src/server/auth/providers.ts`, `src/server/auth/config.ts`
- GitHub OAuth - 用户登录
  - SDK/客户端: `next-auth/providers/github`
  - 鉴权: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
  - 实现: `src/server/auth/providers.ts`, `src/server/auth/config.ts`
- GitHub REST API - 连接用户 GitHub 账号并读取仓库列表与仓库详情
  - SDK/客户端: 原生 `fetch`
  - 鉴权: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`，外加用户授权后保存的 `accessToken`
  - 实现: `src/server/api/routers/github.ts`, `src/app/api/auth/github/callback/route.ts`
- Cloudflare Turnstile - 魔法链接发送前的人机验证
  - SDK/客户端: Turnstile widget + `siteverify` `fetch`
  - 鉴权: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
  - 实现: `src/components/auth/login-content.tsx`, `src/server/auth/turnstile.ts`, `src/server/features/anti-abuse/email-guard.ts`

**AI 与文档处理:**
- OpenRouter - `AI Chat` 与客服 AI 生成/分类
  - SDK/客户端: `@openrouter/ai-sdk-provider` + `ai`
  - 鉴权: `OPENROUTER_API_KEY`
  - 实现: `src/modules/ai-chat/server/services/stream.service.ts`, `src/server/support/ai/agent.ts`, `src/server/support/ai/classify.ts`
- Datalab - 文档转换、OCR 与 `markdown` 提取
  - SDK/客户端: 原生 `fetch`
  - 鉴权: `DATALAB_API_KEY`, `DATALAB_BASE_URL`
  - 实现: `src/server/lib/datalab.ts`

**支付与结算:**
- Stripe - 信用卡、订阅、退款与支付 Webhook
  - SDK/客户端: `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`
  - 鉴权: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - 实现: `src/server/order/services/stripe/client.ts`, `src/server/order/services/stripe/process-webhook.ts`, `src/app/api/webhooks/stripe/route.ts`
- NowPayments - 加密货币支付
  - SDK/客户端: 原生 `fetch`
  - 鉴权: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_PAY_CURRENCY`
  - 实现: `src/server/order/providers/nowpayments.ts`, `src/app/api/webhooks/nowpayments/route.ts`
- Telegram Bot API - Telegram 账号绑定、Telegram Stars 支付与 Bot Webhook
  - SDK/客户端: 原生 `fetch`
  - 鉴权: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
  - 实现: `src/server/telegram/api.ts`, `src/server/telegram/router.ts`, `src/server/telegram/setup-webhook.ts`, `src/app/api/webhooks/telegram/route.ts`
- Velobase Billing - 计费 SDK 封装
  - SDK/客户端: `@velobaseai/billing`
  - 鉴权: `VELOBASE_API_KEY`
  - 实现: `src/server/billing/velobase.ts`

**邮件与客服:**
- Resend - 业务邮件发送、Magic Link、投递状态 Webhook
  - SDK/客户端: `resend`, NextAuth `Nodemailer` SMTP, `svix`
  - 鉴权: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
  - 实现: `src/server/email/index.ts`, `src/server/email/providers/resend.ts`, `src/server/auth/config.ts`, `src/app/api/webhooks/resend/route.ts`
- SendGrid - 业务邮件兜底
  - SDK/客户端: `@sendgrid/mail`
  - 鉴权: `SENDGRID_API_KEY`
  - 实现: `src/server/email/index.ts`, `src/server/email/providers/sendgrid.ts`
- Lark / Feishu - 客服线程、卡片审批、系统告警
  - SDK/客户端: `@larksuiteoapi/node-sdk` + 本地 `LarkBot`
  - 鉴权: `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_DEFAULT_CHAT_ID`, `LARK_ENCRYPT_KEY`, `LARK_VERIFICATION_TOKEN`, 可选 `FEISHU_APP_ID`, `FEISHU_APP_SECRET`
  - 实现: `src/lib/lark/index.ts`, `src/server/support/providers/lark-notify.ts`, `src/app/api/webhooks/lark-support/route.ts`, `src/lib/logger.ts`
- Support SMTP / IMAP - 客服邮箱发信与收信
  - SDK/客户端: `nodemailer`, `imap`, `mailparser`
  - 鉴权: `SUPPORT_EMAIL_ADDRESS`, `SUPPORT_EMAIL_PASSWORD`, `SUPPORT_SMTP_HOST`, `SUPPORT_SMTP_PORT`, `SUPPORT_IMAP_HOST`, `SUPPORT_IMAP_PORT`
  - 实现: `src/server/support/providers/smtp.ts`, `src/server/support/providers/imap.ts`

**分析与增长:**
- PostHog - 客户端事件、服务端事件、Feature Flag
  - SDK/客户端: `posthog-js`, `posthog-node`
  - 鉴权: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, 可选 `POSTHOG_API_KEY`
  - 实现: `src/analytics/posthog-provider.tsx`, `src/analytics/server.ts`, `src/server/experiments/get-feature-flag.ts`
- Google Ads - 前端转化与服务端离线回传
  - SDK/客户端: `google-ads-api` + `gtag`
  - 鉴权: `NEXT_PUBLIC_GOOGLE_ADS_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_CONVERSION_ACTION_ID`, `GOOGLE_ADS_WEB_CONVERSION_ACTION_ID`
  - 实现: `src/server/ads/google-ads/client.ts`, `src/server/ads/google-ads/queue.ts`, `src/workers/processors/google-ads-upload/processor.ts`, `src/app/payment/success/success-client.tsx`
- X / Twitter Ads - 前端像素转化
  - SDK/客户端: `twq`
  - 鉴权: `NEXT_PUBLIC_TWITTER_PIXEL_ID`, `NEXT_PUBLIC_TWITTER_PURCHASE_EVENT_ID`
  - 实现: `src/analytics/ads/twitter.ts`, `src/app/payment/success/success-client.tsx`

**对象存储:**
- S3-compatible Object Storage - 文件上传、下载、`presigned URL`
  - SDK/客户端: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
  - 鉴权: `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, 可选 `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_PATH_PREFIX`, `CDN_BASE_URL`
  - 实现: `src/server/storage.ts`, `src/components/upload/file-upload.tsx`

## 数据存储

**数据库:**
- PostgreSQL
  - 连接: `DATABASE_URL`
  - 客户端: Prisma (`@prisma/client`)
  - 实现: `prisma/schema.prisma`, `src/server/db.ts`

**文件存储:**
- S3-compatible Object Storage
  - 连接: `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ENDPOINT`, `STORAGE_REGION`
  - 客户端: `src/server/storage.ts`

**缓存:**
- Redis
  - 连接: `REDIS_URL` 或 `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_DB`
  - 客户端: `src/server/redis.ts`
- BullMQ 队列
  - 连接: 复用 Redis
  - 客户端: `src/workers/queues/`, `src/workers/start.ts`

## 认证与身份

**认证提供方:**
- NextAuth
  - Implementation: Google OAuth、GitHub OAuth、Email Magic Link、白名单密码登录，核心位于 `src/server/auth/config.ts` 与 `src/server/auth/providers.ts`
- GitHub 二次授权连接
  - Implementation: 面向仓库读取的独立 OAuth App 流程，位于 `src/server/api/routers/github.ts` 与 `src/app/api/auth/github/callback/route.ts`

## 监控与可观测性

**错误追踪:**
- 未检测到专用 SaaS
  - 实现: 结构化日志由 `src/lib/logger.ts` 处理，`error` / `fatal` 会通过 `src/lib/lark/notifications.ts` 触发 Lark 告警

**日志:**
- `pino`
  - 实现: `src/lib/logger.ts`
- Bull Board
  - 实现: Worker 可视化面板位于 `src/workers/server.ts`

## CI/CD 与部署

**托管方式:**
- Docker
  - 实现: 统一镜像位于 `Dockerfile`，拆分镜像位于 `Dockerfile.web`、`Dockerfile.api`、`Dockerfile.worker`
- GitOps + Kustomize overlays
  - 实现: `.github/workflows/build.yaml` 会更新外部 `gitops` 仓库中的 `kustomization.yaml`

**CI 流水线:**
- GitHub Actions
  - 实现: `.github/workflows/build.yaml`
  - 流程: `pnpm install --frozen-lockfile` → `pnpm build` → 推送镜像到 Aliyun Container Registry → 提交 GitOps 版本变更

## 环境配置

**关键 env 变量:**
- Core: `NEXTAUTH_SECRET`, `APP_URL` 或 `NEXTAUTH_URL`, `DATABASE_URL`, `REDIS_URL` 或 `REDIS_HOST` / `REDIS_PORT`，定义位于 `src/env.js`
- AI: `OPENROUTER_API_KEY`, 可选 `DATALAB_API_KEY`, `DATALAB_BASE_URL`，定义位于 `src/env.js`
- Payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, 可选 `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `TELEGRAM_BOT_TOKEN`
- Email / Support: `RESEND_API_KEY` 或 `SENDGRID_API_KEY`，以及 `SUPPORT_EMAIL_ADDRESS`, `SUPPORT_EMAIL_PASSWORD`
- Storage / Growth / Ops: `STORAGE_*`, `NEXT_PUBLIC_POSTHOG_KEY`, `GOOGLE_ADS_*`, `LARK_*`, 可选 `FEISHU_*`, `VELOBASE_API_KEY`
- GitHub repo 连接: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`，实现位于 `src/server/api/routers/github.ts`

**密钥位置:**
- 类型校验入口位于 `src/env.js`
- 本地模板文件存在 `.env.example`
- CI 在 `.github/workflows/build.yaml` 中选择 `.env.dev`、`.env.pre` 或 `.env.prod`

## Webhook 与回调

**入站:**
- `POST /api/webhooks/stripe` - `src/app/api/webhooks/stripe/route.ts`
- `POST /api/webhooks/nowpayments` - `src/app/api/webhooks/nowpayments/route.ts`
- `POST /api/webhooks/resend` - `src/app/api/webhooks/resend/route.ts`
- `POST /api/webhooks/telegram` - `src/app/api/webhooks/telegram/route.ts`
- `POST /api/webhooks/lark-support` 与 `GET` challenge - `src/app/api/webhooks/lark-support/route.ts`
- `GET /api/auth/github/callback` - `src/app/api/auth/github/callback/route.ts`
- NextAuth 回调面 - `src/app/api/auth/[...nextauth]/route.ts`
- `Hono` 示例 Webhook - `src/api/routes/webhooks/example.ts`

**出站:**
- `https://api.github.com/*` 与 `https://github.com/login/oauth/*` - `src/server/api/routers/github.ts`, `src/app/api/auth/github/callback/route.ts`
- `https://api.nowpayments.io/*` - `src/server/order/providers/nowpayments.ts`
- `https://api.telegram.org/bot*/setWebhook` 与其他 Bot API - `src/server/telegram/api.ts`, `src/server/telegram/setup-webhook.ts`
- `https://api.datalab.to/api/v1/marker` - `src/server/lib/datalab.ts`
- PostHog Cloud host - `src/analytics/posthog-provider.tsx`, `src/analytics/server.ts`
- Google Ads API - `src/server/ads/google-ads/client.ts`
- S3-compatible endpoint / CDN endpoint - `src/server/storage.ts`

---

*外部集成审计: 2026-04-19*
