# AI Agent 项目指南

本文件为 AI 编码工具提供项目上下文和规则。适用于 Cursor、Claude Code、GitHub Copilot、Windsurf 等。

## 技术栈

- Next.js 15 (App Router) + React 19 + TypeScript
- tRPC v11 + Zod（类型安全 API）
- Prisma 6 + PostgreSQL（数据库）
- NextAuth v5（认证）
- Tailwind CSS 4 + Radix UI（UI）
- BullMQ + Redis（后台任务）

## 项目结构

```
src/
├── app/              # Next.js 页面和 API 路由
├── modules/          # 业务功能模块（参考 modules/example/）
├── server/           # 服务端代码
│   ├── api/          # tRPC 路由（root.ts 是注册中心）
│   ├── auth/         # 认证
│   ├── billing/      # 计费
│   ├── order/        # 订单
│   └── ...
├── components/       # 共享 UI 组件
├── workers/          # BullMQ 后台任务
└── analytics/        # 事件追踪
```

## 添加新功能

1. 参考 `src/modules/example/` 的结构
2. 在 `prisma/schema.prisma` 添加数据模型
3. 创建 `src/modules/<name>/server/router.ts` + `service.ts`
4. 在 `src/server/api/root.ts` 注册新 router
5. 运行 `npx prisma db push`

## 认证

- 所有需要用户身份的 tRPC procedure 必须使用 `protectedProcedure`
- Server Component 中获取用户：`const session = await auth()`（从 `@/server/auth` 导入）
- 客户端获取用户：`useSession()` from `next-auth/react`
- 登录逻辑统一通过 `useLogin()` hook（`@/components/auth/use-login`），不要直接调用 `signIn()`
- 支持的登录方式：Google OAuth、GitHub OAuth、邮箱 Magic Link、密码（白名单）
- 不要在客户端存储敏感的认证信息
- 不要直接操作 JWT 或 session token

## 代码约定

- 所有 mutation 必须使用 `protectedProcedure`（类型强制）
- 所有用户输入必须用 Zod 校验
- 数据库查询必须分页（cursor-based pagination，默认 limit=20）
- 使用 `createLogger("module-name")` 创建结构化日志
- 环境变量通过 `src/env.js`（T3 Env）统一管理，不要直接读 `process.env`

