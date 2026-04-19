# 技术栈

**分析日期:** 2026-04-19

## 语言

**主要语言:**
- TypeScript 5.8.2 - 主应用、`tRPC`、`Hono`、`Worker` 与 UI 代码主要位于 `src/`，版本见 `package.json`，编译目标见 `tsconfig.json`

**次要语言:**
- JavaScript `ES Modules` - 构建与工具配置位于 `next.config.js`、`eslint.config.js`、`postcss.config.js`
- Prisma Schema / Prisma Client 6.5.0 - 数据模型定义位于 `prisma/schema.prisma`，运行入口位于 `src/server/db.ts`

## 运行时

**环境:**
- Node.js 20 - `Dockerfile`、`Dockerfile.api`、`Dockerfile.web`、`Dockerfile.worker` 使用 `node:20-slim`，`.github/workflows/build.yaml` 使用 `node-version: '20'`

**包管理器:**
- `pnpm` 10.12.1 - 版本声明位于 `package.json`
- 锁文件: 已存在（`pnpm-lock.yaml`）

## 框架

**核心:**
- Next.js 15.5.9 - Web 应用与 `App Router`，页面和路由位于 `src/app/`，构建配置位于 `next.config.js`
- React 19.0.0 - 前端组件层，主要位于 `src/components/` 与 `src/modules/**/components/`
- `tRPC` 11 - 类型安全 API，服务端位于 `src/server/api/`，客户端位于 `src/trpc/`
- `Hono` 4.12.14 - 独立 API 服务，入口位于 `src/api/app.ts`、`src/api/start.ts`
- NextAuth 5.0.0-beta.25 - 认证系统，核心配置位于 `src/server/auth/config.ts`
- Prisma 6.5.0 - ORM 与数据库访问，Schema 位于 `prisma/schema.prisma`，Client 单例位于 `src/server/db.ts`

**测试:**
- 未检测到 - 仓库中未检测到 `Jest`、`Vitest`、Playwright 等测试配置；现有 CI 主要执行 `pnpm build`，见 `.github/workflows/build.yaml`

**构建与开发:**
- Tailwind CSS 4.0.15 + `PostCSS` - 样式构建链，配置位于 `postcss.config.js`
- ESLint 9 + `typescript-eslint` 8 - 静态检查，配置位于 `eslint.config.js`
- Prettier 3.5.3 + `prettier-plugin-tailwindcss` - 格式化，命令位于 `package.json`
- `tsx` 4.19.2 - `api` / `worker` / `standalone` 开发与运行脚本，见 `package.json`
- Docker 多阶段构建 - 统一镜像与拆分镜像位于 `Dockerfile`、`Dockerfile.api`、`Dockerfile.web`、`Dockerfile.worker`

## 关键依赖

**关键依赖:**
- `ai` 5.0.68 + `@openrouter/ai-sdk-provider` 1.2.0 - AI 对话流与模型调用，实际使用位于 `src/modules/ai-chat/server/services/stream.service.ts`、`src/server/support/ai/agent.ts`
- `stripe` 19.1.0 - 主支付网关，服务端单例位于 `src/server/order/services/stripe/client.ts`，Webhook 入口位于 `src/app/api/webhooks/stripe/route.ts`
- `bullmq` 5.41.2 + `ioredis` 5.8.1 - 后台任务与队列底座，位于 `src/workers/`、`src/server/redis.ts`
- `@aws-sdk/client-s3` 3.908.0 + `@aws-sdk/s3-request-presigner` 3.908.0 - 对象存储抽象，位于 `src/server/storage.ts`
- `posthog-js` 1.302.2 + `posthog-node` 5.17.2 - 客户端与服务端分析，位于 `src/analytics/posthog-provider.tsx`、`src/analytics/server.ts`

**基础设施依赖:**
- `@t3-oss/env-nextjs` 0.12.0 + `zod` 3 - 统一环境变量校验与输入 schema，位于 `src/env.js` 与各模块 `schemas/`
- `fastify` 5.6.2 + `@bull-board/api` / `@bull-board/fastify` 6.15.0 - Worker HTTP 与 Bull Board，位于 `src/workers/server.ts`
- `pino` 10.0.0 + `pino-pretty` 13.1.2 - 结构化日志与开发态美化输出，位于 `src/lib/logger.ts`
- `@velobaseai/billing` 0.1.4 - 外部计费 SDK 封装，位于 `src/server/billing/velobase.ts`

## 配置

**环境配置:**
- 所有正式环境变量 schema 统一声明在 `src/env.js`，代码侧约定从 `@/env` 读取
- 本地模板文件存在 `.env.example`；CI 在 `.github/workflows/build.yaml` 中按分支复制 `.env.dev`、`.env.pre` 或 `.env.prod` 到 `.env`
- 关键配置覆盖认证、数据库、Redis、对象存储、OpenRouter、Stripe、NowPayments、PostHog、Google Ads、Lark / Feishu、Telegram、Datalab 与 Velobase，定义见 `src/env.js`

**构建配置:**
- Web 构建配置位于 `next.config.js`
- TypeScript 编译配置位于 `tsconfig.json`
- Lint 配置位于 `eslint.config.js`
- CSS 管线配置位于 `postcss.config.js`
- 容器构建与服务拆分配置位于 `Dockerfile`、`Dockerfile.api`、`Dockerfile.web`、`Dockerfile.worker`、`docker-compose.yml`

## 平台要求

**开发环境:**
- Node.js 20 + `pnpm` 10.12.1
- PostgreSQL 16 与 Redis 7，可由 `docker-compose.yml` 启动
- 若需本地 Stripe Webhook 转发，可启用 `docker compose --profile stripe`，配置位于 `docker-compose.yml`

**生产环境:**
- Docker 容器运行，`next.config.js` 使用 `output: "standalone"`
- 可通过 `SERVICE_MODE` 运行统一镜像中的 `web` / `api` / `worker`，入口位于 `src/server/standalone.ts`
- CI/CD 通过 GitHub Actions 构建镜像、推送到 Aliyun Container Registry，并更新 GitOps 仓库，流程位于 `.github/workflows/build.yaml`

---

*技术栈分析: 2026-04-19*
