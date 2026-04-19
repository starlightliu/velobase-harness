# 编码约定

**分析日期：** 2026-04-19

## 命名模式

**文件：**
- 业务与组件文件以 kebab-case 为主，例如 `src/components/account/profile-form.tsx`、`src/server/order/services/create-order.ts`、`src/server/order/routers/procedures/create-order.ts`。
- 路由入口沿用框架约定文件名，例如 `src/app/api/webhooks/resend/route.ts`、`src/app/account/profile/page.tsx`。
- 聚合导出常用 `index.ts`，例如 `src/server/billing/routers/index.ts`、`src/server/billing/schemas/index.ts`、`src/server/support/index.ts`。

**函数：**
- 函数与过程名使用 camelCase，并带领域后缀或动作语义，例如 `createTRPCRouter`，见 `src/server/api/trpc.ts`；`validateChatRequest`，见 `src/modules/ai-chat/server/validators/request.validator.ts`；`redeemCode`，见 `src/server/promo/services/redeem.ts`。
- tRPC procedure 常以 `*Procedure` 结尾，例如 `grantProcedure`，见 `src/server/billing/routers/procedures/grant.ts`；`createOrderProcedure`，见 `src/server/order/routers/procedures/create-order.ts`。

**变量：**
- 普通变量使用 camelCase，例如 `repoData`，见 `src/server/api/routers/repository.ts`；`effectiveCurrency`，见 `src/server/order/services/create-order.ts`。
- 常量使用 UPPER_SNAKE_CASE 或全大写对象名，例如 `TURNSTILE_SITE_KEY`、`COMMON_EMAIL_DOMAINS`、`PASSWORD_LOGIN_PREFIX`，均见 `src/components/auth/use-login.ts`。

**类型：**
- `interface`、`type`、`Schema` 名使用 PascalCase，例如 `CreateItemInput`，见 `src/modules/example/server/service.ts`；`GrantInputSchema`，见 `src/server/billing/schemas/grant.ts`；`ChatRequest`，见 `src/modules/ai-chat/server/validators/request.validator.ts`。
- 通过 `z.infer` 派生类型时仍保持 PascalCase，例如 `ChatRequest`，见 `src/modules/ai-chat/server/validators/request.validator.ts`。

## 代码风格

**格式化：**
- `package.json` 声明了 `prettier` 与 `prettier-plugin-tailwindcss`，并提供 `format:check`、`format:write` 命令。
- 未检测到 `.prettierrc` 或 `prettier.config.*`。仓库当前更多依赖文件内既有风格与 `prettier` 默认行为。
- 引号风格并未统一强制。`src/server/api/trpc.ts`、`src/components/auth/use-login.ts` 以双引号为主，`src/server/billing/services/grant.ts`、`src/server/promo/services/redeem.ts` 以单引号为主。改动时更稳妥的做法是跟随当前文件已有风格。

**Lint：**
- 主配置是 `eslint.config.js`，同时仓库内保留 `.eslintrc.json`。
- `eslint.config.js` 叠加 `next/core-web-vitals` 与 `typescript-eslint` 的 `recommended`、`recommendedTypeChecked`、`stylisticTypeChecked`。
- `eslint.config.js` 明确要求 `@typescript-eslint/no-unused-vars`，允许参数以下划线开头忽略；要求 `@typescript-eslint/no-misused-promises`；禁止 `console.log`，仅允许 `console.warn` 与 `console.error`。
- `tsconfig.json` 开启 `strict`、`noUncheckedIndexedAccess`、`checkJs`，并启用 `@/*` 路径别名。

## 导入组织

**顺序：**
1. 先导入第三方包，例如 `zod`、`@trpc/server`、`next-auth/react`，见 `src/server/api/trpc.ts`、`src/server/api/routers/repository.ts`、`src/components/auth/use-login.ts`。
2. 再导入 `@/` 别名路径下的项目模块，例如 `@/server/db`、`@/lib/logger`、`@/analytics`。
3. 最后导入相对路径模块，例如 `./service`，见 `src/modules/example/server/router.ts`；`../types`，见 `src/server/promo/services/redeem.ts`。

**路径别名：**
- 统一使用 `@/* -> ./src/*`，定义在 `tsconfig.json`。
- `src/` 内部跨目录引用明显优先使用 `@/`，例如 `src/server/order/services/create-order.ts`、`src/app/api/trpc/[trpc]/route.ts`。

## 输入校验

**模式：**
- tRPC 输入普遍在 router/procedure 层以 `z.object(...)` 或共享 schema 做校验，例如 `src/modules/example/server/router.ts`、`src/server/billing/routers/procedures/grant.ts`、`src/server/order/routers/procedures/create-order.ts`。
- 领域 schema 常拆到独立目录，再由 procedure 复用，例如 `src/server/billing/schemas/*.ts`、`src/server/order/schemas/order.ts`、`src/server/promo/schemas/index.ts`。
- 请求体场景会先 `parse` 再做触发条件校验，例如 `validateChatRequest()` 与 `validateTriggerRequirements()`，见 `src/modules/ai-chat/server/validators/request.validator.ts`。
- 非 tRPC 路径存在手写校验与正则校验，例如 GitHub URL 校验，见 `src/server/api/routers/repository.ts`；邮箱正则与标准化逻辑，见 `src/components/auth/use-login.ts`。
- 环境变量校验集中在 `src/env.js`，通过 `@t3-oss/env-nextjs` 和 `zod` 定义服务端/客户端 schema。

## 错误处理

**模式：**
- tRPC / API 边界更偏向抛出 `TRPCError`，例如 `src/server/api/trpc.ts`、`src/server/billing/services/grant.ts`、`src/server/api/routers/repository.ts`、`src/server/affiliate/services/admin-actions.ts`。
- 领域 service 中也大量直接抛出 `Error`，例如 `src/server/order/services/create-order.ts`、`src/server/order/services/refund-payment.ts`、`src/server/support/services/conversation.ts`。
- 部分 service 选择返回结果对象而不是抛错，例如 `validateCode()`，见 `src/server/promo/services/validate.ts`；`redeemCode()`，见 `src/server/promo/services/redeem.ts`。
- Webhook / readiness 端点常用 `try/catch` 返回 HTTP 状态与简化错误信息，例如 `src/app/api/webhooks/resend/route.ts`、`src/api/routes/health.ts`。
- 对可忽略的外围依赖失败，代码倾向记录日志并继续主流程，例如 `src/app/api/webhooks/resend/route.ts` 中 `touchRecord` 更新失败、`src/server/order/services/checkout.ts` 中补偿逻辑失败。

## 日志

**框架：**
- 统一日志入口是 `createLogger()` 与 `logger`，定义在 `src/lib/logger.ts`。
- `src/lib/logger.ts` 基于 `pino` 与 `pino-pretty`，开发环境同时写控制台和 `logs/app.log`。

**模式：**
- 模块级 logger 通常在文件顶层以上下文名创建，例如 `const logger = createLogger("google-ads-upload")`，见 `src/workers/processors/google-ads-upload/processor.ts`；`const log = createLogger("api")`，见 `src/api/app.ts`。
- 日志调用偏向结构化字段 + 文本消息，例如 `logger.info({ userId, productId, orderId }, "Order created successfully")`，见 `src/server/order/services/create-order.ts`。
- 错误日志可触发告警；若是预期内拒绝，可通过 `skipAlert` 抑制，见 `src/app/api/trpc/[trpc]/route.ts` 与 `src/lib/logger.ts`。

## 注释

**何时注释：**
- 复杂边界、约束和流程分段会写块注释，例如 `src/server/api/trpc.ts`、`src/server/order/services/create-order.ts`、`src/server/promo/services/redeem.ts`。
- 测试脚本大量用中文场景标题和分段注释解释测试目的，见 `scripts/tests/features/anti-abuse/test-anti-abuse.ts`、`scripts/tests/features/cdn-adapters/test-cdn-adapters.ts`。

**JSDoc/TSDoc：**
- 使用存在但不完全统一。示例与基础框架文件更常见，例如 `src/server/api/trpc.ts`、`src/modules/example/server/service.ts`、`src/modules/ai-chat/server/validators/request.validator.ts`。
- 普通业务文件更多使用行注释与分隔注释，而不是完整 TSDoc。

## 函数设计

**大小：**
- Router 层函数通常很薄，只做 `.input()` / `.output()` 绑定与参数透传，见 `src/server/billing/routers/procedures/grant.ts`、`src/server/order/routers/procedures/create-order.ts`。
- 业务复杂度下沉到 service 层，复杂函数可明显变长，例如 `src/server/promo/services/redeem.ts`、`src/server/order/services/handle-webhooks.ts`。

**参数：**
- service 常接收单个对象参数，便于扩展与命名传参，例如 `createItem(input)`，见 `src/modules/example/server/service.ts`；`grant(params)`，见 `src/server/billing/services/grant.ts`；`createOrder({ ... })`，见 `src/server/order/services/create-order.ts`。
- 简单工具函数使用标量参数或少量字段，例如 `validateTriggerRequirements(request)`，见 `src/modules/ai-chat/server/validators/request.validator.ts`。

**返回值：**
- Procedure 多直接返回 service 结果。
- service 返回风格并不唯一：有的返回实体或聚合对象，例如 `createOrder()`；有的返回布尔/状态对象，例如 `validateCode()`、`redeemCode()`。

## 模块设计

**导出：**
- 业务域常按 `routers` / `schemas` / `services` / `types` 分目录组织，例如 `src/server/billing/`、`src/server/promo/`、`src/server/order/`。
- tRPC router 常由域级 `index.ts` 聚合，再在 `src/server/api/root.ts` 注册。

**Barrel Files：**
- 有选择地使用 barrel file。`src/server/billing/schemas/index.ts`、`src/server/support/index.ts`、`src/modules/ai-chat/server/services/index.ts` 明确承担聚合职责。
- 也存在直接按文件路径导入而不经过 barrel 的情况，例如 `src/server/order/routers/procedures/create-order.ts` 直接引用 `../../schemas/order` 与 `../../services/create-order`。

---

*约定分析：2026-04-19*
