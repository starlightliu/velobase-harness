# 架构

**分析日期：** 2026-04-19

## 模式总览

**整体模式：** 单仓库多运行时架构，前台使用 `Next.js App Router`，主业务 API 使用 `tRPC`，补充 HTTP 接口使用 `Next.js Route Handlers` 与 `Hono`，异步任务使用 `BullMQ Worker`；三类服务通过 `SERVICE_MODE` 由 `src/server/standalone.ts` 统一编排。

**关键特征：**
- Web、API、Worker 共用 `Prisma`、`Redis`、`env`、日志与领域服务，但可以通过 `src/server/standalone.ts`、`src/api/index.ts`、`src/workers/index.ts` 分开启动。
- `tRPC Router` 负责鉴权、输入校验和装配，主要业务逻辑下沉到 `src/server/*/services/` 或 `src/modules/*/server/service.ts`。
- 目录按职责分层明显：页面和 Route Handlers 在 `src/app/`，独立 API 在 `src/api/`，领域代码在 `src/server/`，可复用业务模块在 `src/modules/`，异步任务在 `src/workers/`。

## 分层

**Web 表现层：**
- 用途：承载页面、布局、全局 Provider、中间件和面向浏览器的 HTTP 入口。
- 位置：`src/app/`、`src/components/`、`src/trpc/`、`src/middleware.ts`
- 包含：`page.tsx`、`layout.tsx`、`route.ts`、共享 UI 组件、`TRPCReactProvider`
- 依赖：`src/server/auth/`、`src/server/api/root.ts`、`src/analytics/`、`src/i18n/`
- 被谁使用：浏览器请求、`Next.js` 运行时、`React Server Components`

**tRPC 应用层：**
- 用途：暴露类型安全业务 API，封装 `context`、`procedure`、鉴权、限流和 Router 注册。
- 位置：`src/server/api/trpc.ts`、`src/server/api/root.ts`、`src/server/api/routers/`、`src/server/*/routers/`
- 包含：`createTRPCRouter`、`publicProcedure`、`protectedProcedure`、`adminProcedure`、按领域拆分的 Router
- 依赖：`src/server/auth/index.ts`、`src/server/db.ts`、`src/server/ratelimit.ts`、各领域 `services`
- 被谁使用：`src/app/api/trpc/[trpc]/route.ts`、`src/trpc/react.tsx`、`src/trpc/server.ts`

**领域服务层：**
- 用途：承载订单、计费、会员、认证、客服、项目、对话等业务逻辑。
- 位置：`src/server/order/services/`、`src/server/billing/services/`、`src/server/membership/services/`、`src/server/support/services/`、`src/modules/*/server/service.ts`
- 包含：数据库读写、第三方渠道调用、履约逻辑、任务入队、聚合查询
- 依赖：`src/server/db.ts`、`src/server/redis.ts`、`src/server/storage.ts`、`src/server/email/`、`src/server/order/providers/`
- 被谁使用：`tRPC Router`、`Next.js Route Handlers`、`Hono` 路由、Worker processor

**集成与基础设施层：**
- 用途：提供跨领域复用的运行时依赖与适配能力。
- 位置：`src/env.js`、`src/server/db.ts`、`src/server/redis.ts`、`src/lib/logger.ts`、`src/server/auth/`、`src/server/email/`、`src/server/storage.ts`
- 包含：环境变量校验、`PrismaClient` 单例、`Redis` 单例、结构化日志、`NextAuth`、邮件 Provider 链、对象存储抽象
- 依赖：外部库和环境配置
- 被谁使用：全仓服务端代码、`Next.js` Route Handlers、`Hono`、Worker

**独立 API 层：**
- 用途：承载不依赖 `Next.js` 页面运行时的 HTTP 接口和 Webhook。
- 位置：`src/api/app.ts`、`src/api/routes/`、`src/api/start.ts`
- 包含：`Hono` app 工厂、健康检查、Webhook 路由组
- 依赖：`src/lib/logger.ts`、`src/server/redis.ts` 与可复用领域服务
- 被谁使用：`src/api/index.ts`、`src/server/standalone.ts`

**异步任务层：**
- 用途：处理长耗时、重试型和定时任务。
- 位置：`src/workers/start.ts`、`src/workers/registry.ts`、`src/workers/queues/`、`src/workers/processors/`
- 包含：队列定义、处理器、调度器注册、Bull Board HTTP 面
- 依赖：`src/server/redis.ts`、各领域服务、`src/workers/utils/create-worker.ts`
- 被谁使用：`src/workers/index.ts`、`src/server/standalone.ts`、领域服务中的入队函数

## 数据流

**页面到业务 API：**

1. 浏览器命中 `src/app/` 下页面与布局，例如 `src/app/layout.tsx` 先装配 `NextIntlClientProvider`、`SessionProvider`、`TRPCReactProvider`。
2. 客户端或 `RSC` 通过 `src/trpc/react.tsx` 或 `src/trpc/server.ts` 调用 `/api/trpc`。
3. `src/app/api/trpc/[trpc]/route.ts` 进入 `fetchRequestHandler`，构造 `createTRPCContext`。
4. `src/server/api/root.ts` 选择具体 Router，再由 `src/server/api/trpc.ts` 的 `procedure` 中间件完成鉴权、限流和错误格式化。
5. Router 调用 `src/server/*/services/` 或 `src/modules/*/server/service.ts` 完成业务逻辑。
6. 服务层通过 `src/server/db.ts`、`src/server/redis.ts`、`src/server/storage.ts` 或 Provider 注册表持久化与集成外部能力。

**Webhook 与独立 HTTP：**

1. 第三方回调可进入 `src/app/api/webhooks/*/route.ts`，也可进入 `src/api/routes/` 下的 `Hono` 路由。
2. 路由层负责读取原始 body、验证签名、做最薄的一层协议转换，例如 `src/app/api/webhooks/stripe/route.ts`。
3. 业务处理下沉到领域服务，例如 `src/server/order/services/handle-webhooks.ts`。
4. 领域服务更新 `Prisma` 数据、触发履约、发送埋点或把后续工作入队。

**异步任务执行：**

1. 队列定义集中导出在 `src/workers/queues/index.ts`。
2. `src/workers/start.ts` 把队列、Processor、Scheduler 注册到 `src/workers/registry.ts`。
3. `WorkerRegistry` 通过 `src/workers/utils/create-worker.ts` 创建 `BullMQ Worker`。
4. Processor 在 `src/workers/processors/*` 中执行业务逻辑，并复用 `src/server/*` 服务层。

**状态管理：**
- 浏览器侧请求状态由 `React Query` + `tRPC` 管理，入口在 `src/trpc/react.tsx`。
- 服务端会话状态由 `NextAuth` 提供，入口在 `src/server/auth/index.ts` 和 `src/server/auth/config.ts`。
- 持久化状态以 `PostgreSQL` 为主，模型定义在 `prisma/schema.prisma`，访问统一走 `src/server/db.ts`。
- 短期状态、限流、队列连接走 `Redis`，入口在 `src/server/redis.ts` 与 `src/server/ratelimit.ts`。

## 关键抽象

**`appRouter` 注册中心：**
- 用途：把跨目录的领域 Router 汇总为唯一业务 API 树。
- 示例：`src/server/api/root.ts`
- 模式：集中注册 + 分领域实现

**`WorkerRegistry`：**
- 用途：统一注册队列、Worker 与 Scheduler，并管理生命周期。
- 示例：`src/workers/registry.ts`、`src/workers/start.ts`
- 模式：声明式注册表

**支付 Provider 注册表：**
- 用途：用统一接口屏蔽 `Stripe`、`NowPayments` 差异。
- 示例：`src/server/order/providers/registry.ts`、`src/server/order/providers/types.ts`、`src/server/order/services/init-providers.ts`
- 模式：Provider 接口 + 运行时注册

**模块模板：**
- 用途：定义新业务功能的最小落位方式。
- 示例：`src/modules/example/README.md`、`src/modules/example/server/router.ts`、`src/modules/example/server/service.ts`
- 模式：模块目录封装 + 显式注册到 `src/server/api/root.ts`

## 入口点

**统一服务入口：**
- 位置：`src/server/standalone.ts`
- 触发方式：`pnpm dev:all`、`pnpm start:all`
- 职责：解析 `SERVICE_MODE`，按需启动 `Web`、`API`、`Worker`，并统一处理优雅退出

**Web 入口：**
- 位置：`src/app/layout.tsx`、`src/web/start.ts`
- 触发方式：`Next.js` 页面请求，或 `SERVICE_MODE=web` / `SERVICE_MODE=all`
- 职责：装配全局 Provider、字体、埋点、认证会话与页面请求处理

**tRPC HTTP 入口：**
- 位置：`src/app/api/trpc/[trpc]/route.ts`
- 触发方式：前端和 `RSC` 调用 `/api/trpc`
- 职责：构造上下文、做 IP 限流、分发到 `appRouter`

**独立 API 入口：**
- 位置：`src/api/index.ts`、`src/api/start.ts`、`src/api/app.ts`
- 触发方式：`pnpm api:dev`、`pnpm api:prod` 或 `SERVICE_MODE=api`
- 职责：启动 `Hono` HTTP 服务并注册路由组

**Worker 入口：**
- 位置：`src/workers/index.ts`、`src/workers/start.ts`
- 触发方式：`pnpm worker:dev`、`pnpm worker:prod` 或 `SERVICE_MODE=worker`
- 职责：注册队列/调度器、启动 Worker HTTP 面、暴露 Bull Board

## 错误处理

**策略：** 以边界处拦截为主，辅以结构化日志和告警；只有明确需要上游重试的场景才返回非 `2xx`。

**模式：**
- `src/server/api/trpc.ts` 用 `TRPCError`、`errorFormatter`、`protectedProcedure`、`rateLimitedProcedure` 统一 API 错误语义。
- `src/app/api/trpc/[trpc]/route.ts` 在 `onError` 中记录错误，并只对 `INTERNAL_SERVER_ERROR` 发送 `Lark` 后端告警。
- `src/api/app.ts` 使用 `app.onError()` 兜底 `Hono` 路由异常。
- `src/app/api/webhooks/stripe/route.ts` 只对 `WebhookFulfillmentError` 返回 `500`，其余异常吞掉并返回 `2xx`，避免无意义重放。
- `src/workers/utils/create-worker.ts` 统一监听 `active`、`completed`、`failed`、`error`、`stalled` 事件，并发送后台告警。

## 横切关注点

**日志：** `src/lib/logger.ts` 是全局日志入口，`src/server/shared/telemetry/logger.ts` 只是别名转发；各层都通过 `createLogger()` 或 `logger` 使用统一格式与告警钩子。

**校验：** 环境变量校验在 `src/env.js`；`tRPC` 输入校验依赖各领域 `schemas`，例如 `src/server/order/schemas/`；模块级请求校验可放在 `src/modules/*/server/validators/`，如 `src/modules/ai-chat/server/validators/request.validator.ts`。

**认证：** `NextAuth` 配置在 `src/server/auth/config.ts`，运行时入口在 `src/server/auth/index.ts`，HTTP 暴露在 `src/app/api/auth/[...nextauth]/route.ts`；服务端通过 `auth()` 把会话注入 `tRPC context`。

---

*架构分析：2026-04-19*
