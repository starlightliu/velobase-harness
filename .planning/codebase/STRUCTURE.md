# 代码库结构

**分析日期：** 2026-04-19

## 目录布局

```text
[project-root]/
├── `src/app/`              # `Next.js App Router` 页面、布局、Route Handlers
├── `src/api/`              # 独立 `Hono` API 服务
├── `src/server/`           # 服务端领域代码与共享基础设施
├── `src/modules/`          # 业务模块模板与模块化实现
├── `src/workers/`          # `BullMQ` 队列、处理器、调度器与 Worker HTTP 面
├── `src/components/`       # 跨页面共享 UI 与组合组件
├── `src/analytics/`        # 客户端与服务端埋点
├── `src/i18n/`             # `next-intl` 语言解析与配置
├── `src/lib/`              # 通用工具、日志、第三方协议辅助
├── `prisma/`               # `Prisma` schema 与迁移
├── `deploy/base/`          # `Kubernetes` 基线清单
├── `docs/`                 # 架构、API 约定与集成文档
├── `.github/workflows/`    # CI / GitOps 流程
├── `messages/`             # 国际化文案
└── `scripts/`              # 运行时拆分与集成验证脚本
```

## 目录用途

**`src/app/`：**
- 用途：放浏览器可达页面和 `Next.js Route Handlers`。
- 包含：`page.tsx`、`layout.tsx`、`route.ts`、`robots.ts`、`sitemap.ts`
- 关键文件：`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/api/trpc/[trpc]/route.ts`、`src/app/api/webhooks/stripe/route.ts`

**`src/api/`：**
- 用途：放独立于 `Next.js` 页面运行时的 `Hono` HTTP 服务。
- 包含：app 工厂、进程入口、路由组
- 关键文件：`src/api/app.ts`、`src/api/start.ts`、`src/api/index.ts`、`src/api/routes/health.ts`

**`src/server/`：**
- 用途：放主要服务端领域逻辑和共享基础设施。
- 包含：`tRPC` 基础设施、认证、订单、计费、会员、客服、广告、产品、共享 env/db/redis
- 关键文件：`src/server/api/root.ts`、`src/server/api/trpc.ts`、`src/server/standalone.ts`、`src/server/db.ts`、`src/server/redis.ts`

**`src/modules/`：**
- 用途：放可独立迁移和扩展的业务模块。
- 包含：模块自己的组件、服务、路由、文档、可选 worker
- 关键文件：`src/modules/example/README.md`、`src/modules/example/server/router.ts`、`src/modules/ai-chat/server/api/route.ts`

**`src/workers/`：**
- 用途：放异步任务的所有运行时部件。
- 包含：队列定义、处理器、调度器、Worker 注册表、Worker HTTP 服务
- 关键文件：`src/workers/start.ts`、`src/workers/registry.ts`、`src/workers/queues/index.ts`、`src/workers/processors/index.ts`

**`src/components/`：**
- 用途：放跨页面和跨模块共享的 React 组件。
- 包含：账号、支付、布局、侧边栏、`ui` 基础组件
- 关键文件：`src/components/layout/`、`src/components/ui/`、`src/components/auth/use-login.ts`

**`src/analytics/`：**
- 用途：统一埋点常量、客户端 Provider 和服务端埋点封装。
- 包含：事件常量、广告埋点、`PostHog` Provider、服务端安全封装
- 关键文件：`src/analytics/index.ts`、`src/analytics/server.ts`、`src/analytics/events/`

**`src/i18n/`：**
- 用途：统一处理语言配置与请求侧 locale 解析。
- 包含：语言列表、请求配置、Cookie / `Accept-Language` 解析
- 关键文件：`src/i18n/config.ts`、`src/i18n/request.ts`

**`prisma/`：**
- 用途：放数据库 schema、迁移与种子脚本入口相关文件。
- 包含：`schema.prisma`、`migrations/`、`prisma.config.ts`
- 关键文件：`prisma/schema.prisma`、`prisma/migrations/`

**`deploy/base/`：**
- 用途：放 `Kubernetes` 拆分部署和单体部署的基线清单。
- 包含：`Deployment`、`Service`、`Ingress`、`Kustomization`
- 关键文件：`deploy/base/kustomization.yaml`、`deploy/base/deployment.yaml`、`deploy/base/deployment-api.yaml`、`deploy/base/deployment-worker.yaml`、`deploy/base/deployment-standalone.yaml`

**`docs/`：**
- 用途：放对仓库当前结构有指导意义的说明文档。
- 包含：架构拆分、API 约定、框架功能说明
- 关键文件：`docs/architecture/web-api-service-split.md`、`docs/conventions/api.md`、`docs/features/README.md`

## 关键文件位置

**入口点：**
- `src/server/standalone.ts`：`SERVICE_MODE` 统一入口
- `src/web/start.ts`：程序化启动 `Next.js` Web 服务
- `src/api/index.ts`：独立 `Hono` API 进程入口
- `src/workers/index.ts`：独立 Worker 进程入口
- `src/app/layout.tsx`：页面树根布局与全局 Provider 入口
- `src/middleware.ts`：请求级 Cookie / 归因中间件入口

**配置：**
- `package.json`：脚本、依赖、运行命令
- `next.config.js`：`Next.js`、`next-intl`、standalone output 配置
- `tsconfig.json`：TypeScript 严格模式与 `@/*` 路径别名
- `src/env.js`：环境变量 schema
- `.env.example`：环境变量模板，仅应作为存在性参考

**核心逻辑：**
- `src/server/api/root.ts`：所有 `tRPC Router` 注册中心
- `src/server/api/trpc.ts`：`context`、procedure、中间件
- `src/server/order/services/`：订单与支付核心业务
- `src/server/billing/services/`：账本与积分业务
- `src/server/auth/config.ts`：认证主配置
- `src/modules/ai-chat/server/`：`AI Chat` 模块的独立服务与流式接口

**测试与验证：**
- `scripts/test-service-mode.mjs`：验证 `SERVICE_MODE` 拆分模式
- `scripts/tests/integrations/`：集成验证脚本
- `scripts/tests/features/`：框架内置功能验证脚本
- `docker-compose.test.yml`：容器化测试编排

## 命名约定

**文件：**
- 页面入口使用 `page.tsx`、布局使用 `layout.tsx`、HTTP 入口使用 `route.ts`，例如 `src/app/account/profile/page.tsx`、`src/app/api/health/route.ts`。
- 领域过程文件多用 `kebab-case`，例如 `src/server/order/services/create-order.ts`、`src/workers/processors/support-send/processor.ts`。
- 聚合导出使用 `index.ts`，例如 `src/workers/queues/index.ts`、`src/server/billing/routers/index.ts`。
- 队列定义使用 `*.queue.ts`，例如 `src/workers/queues/google-ads-upload.queue.ts`。

**目录：**
- 服务端目录按业务域拆分，优先放在 `src/server/<domain>/`，例如 `src/server/order/`、`src/server/product/`。
- Worker Processor 目录按任务名拆分，优先放在 `src/workers/processors/<job-name>/`，例如 `src/workers/processors/payment-reconciliation/`。
- 可复用业务功能优先放在 `src/modules/<module-name>/`，例如 `src/modules/ai-chat/`、`src/modules/example/`。

## 新代码应放哪里

**新增业务功能：**
- 主体实现：优先新建 `src/modules/<feature>/`
- 页面入口：在 `src/app/<feature>/page.tsx` 或对应子路由下挂页面
- tRPC API：在 `src/modules/<feature>/server/router.ts` 或 `src/server/<domain>/routers/` 实现，并注册到 `src/server/api/root.ts`
- 业务逻辑：放在 `src/modules/<feature>/server/service.ts` 或 `src/server/<domain>/services/`
- 数据模型：修改 `prisma/schema.prisma`

**新增 HTTP / Webhook：**
- 需要 `Next.js` 会话、`RSC` 或站点同域能力：放 `src/app/api/<name>/route.ts`
- 需要独立 API 面或和站点解耦：放 `src/api/routes/`，并在 `src/api/app.ts` 注册

**新增异步任务：**
- 队列定义：放 `src/workers/queues/<job>.queue.ts`
- Processor：放 `src/workers/processors/<job>/`
- 注册：同步改 `src/workers/queues/index.ts`、`src/workers/processors/index.ts`、`src/workers/start.ts`
- 若功能自带模板，可参照 `src/modules/example/worker/`

**新增共享组件或工具：**
- 跨页面 UI：放 `src/components/`
- 基础原子组件：放 `src/components/ui/`
- 通用工具：放 `src/lib/`
- 浏览器侧 hooks：放 `src/hooks/`
- 全局状态：放 `src/stores/`

## 特殊目录

**`prisma/migrations/`：**
- 用途：保存数据库迁移历史
- 是否生成产物：是
- 是否提交到仓库：是

**`messages/`：**
- 用途：保存 `next-intl` 文案文件
- 是否生成产物：否
- 是否提交到仓库：是

**`deploy/base/`：**
- 用途：保存 `Kubernetes` 基线部署清单
- 是否生成产物：否
- 是否提交到仓库：是

**`.github/workflows/`：**
- 用途：保存 CI / GitOps 流程定义
- 是否生成产物：否
- 是否提交到仓库：是

---

*结构分析：2026-04-19*
