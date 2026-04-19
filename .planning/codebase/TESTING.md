# 测试模式

**分析日期：** 2026-04-19

## 测试框架

**运行方式：**
- 未检测到 `vitest`、`jest`、`playwright` 或 `cypress` 配置文件；`package.json` 也没有 `test`、`test:watch`、`coverage` 脚本。
- 当前测试主要是用 `tsx` 或 `node` 直接执行脚本，例如 `scripts/tests/features/cdn-adapters/test-cdn-adapters.ts`、`scripts/tests/integrations/database/test-database.ts`、`scripts/test-service-mode.mjs`。
- `docker-compose.test.yml` 存在，用于 `scripts/test-service-mode.mjs` 的容器化冒烟测试；本次未读取其内容。

**断言方式：**
- 未检测到独立 assertion library。
- 各脚本自定义 `assert()`、`ok()`、`fail()` 计数函数，例如 `scripts/tests/features/cdn-adapters/test-cdn-adapters.ts`、`scripts/tests/integrations/database/test-database.ts`、`scripts/tests/features/anti-abuse/test-anti-abuse.ts`。

**运行命令：**
```bash
npx tsx scripts/tests/features/cdn-adapters/test-cdn-adapters.ts
npx tsx scripts/tests/integrations/database/test-database.ts
npx tsx scripts/tests/features/anti-abuse/test-anti-abuse.ts
node scripts/test-service-mode.mjs standalone
```

## 测试文件组织

**位置：**
- 测试主要集中在 `scripts/tests/`，不是与 `src/` 源码同目录共置。
- 功能级测试放在 `scripts/tests/features/`，集成测试放在 `scripts/tests/integrations/`。
- 另外有一个服务模式 smoke test 放在 `scripts/test-service-mode.mjs`。

**命名：**
- 文件名使用 `test-*.ts` 或 `test-*.mjs`，例如 `scripts/tests/features/anti-abuse/test-anti-abuse.ts`、`scripts/tests/integrations/storage/test-storage.ts`、`scripts/test-service-mode.mjs`。
- 未检测到 `*.test.ts` 或 `*.spec.ts` 风格的源码侧测试文件。

**结构：**
```text
scripts/
├── test-service-mode.mjs
└── tests/
    ├── features/
    │   ├── anti-abuse/test-anti-abuse.ts
    │   └── cdn-adapters/test-cdn-adapters.ts
    └── integrations/
        ├── ads/test-ads.ts
        ├── analytics/test-posthog.ts
        ├── database/test-database.ts
        ├── payment/test-billing.ts
        ├── queue/test-queue.ts
        ├── security/test-turnstile.ts
        └── storage/test-storage.ts
```

## 测试结构

**套件组织：**
```typescript
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  await testOne();
  await testTwo();
  process.exit(failed > 0 ? 1 : 0);
}
```
- 上面这一类模式直接见于 `scripts/tests/features/cdn-adapters/test-cdn-adapters.ts`、`scripts/tests/integrations/database/test-database.ts`、`scripts/tests/integrations/queue/test-queue.ts`。

**模式：**
- 启动即做环境前置检查；缺配置直接 `process.exit(1)`，例如 `scripts/tests/integrations/database/test-database.ts`、`scripts/tests/features/anti-abuse/test-anti-abuse.ts`。
- 单文件内按场景拆成多个 `async function testXxx()`，再由 `main()` 串行执行，例如 `scripts/tests/features/anti-abuse/test-anti-abuse.ts`。
- 结果汇总统一依赖 `passed` / `failed` 计数与退出码，而不是依赖测试运行器报告。

## 替身模式

**框架：**
- 未检测到 `vi.mock`、`jest.mock`、`msw`、`nock` 一类 mocking 框架。

**模式：**
```typescript
const { checkSignupAbuse } = await import('../../../../src/server/features/anti-abuse')
const result = await checkSignupAbuse({ userId, email, signupIp })
```
- 测试更偏向直接导入真实模块并调用真实依赖，示例见 `scripts/tests/features/anti-abuse/test-anti-abuse.ts`。
- 纯函数测试通过手工构造输入替代替身，例如 `makeHeaders()`，见 `scripts/tests/features/cdn-adapters/test-cdn-adapters.ts`。

**应如何替身：**
- 当前代码库里未形成通用替身约定；从现状看，更常见做法是构造最小输入对象，而不是替换模块。

**当前未替身的对象：**
- 数据库、Redis、第三方服务通常直接打真实连接，例如 `new PrismaClient()`，见 `scripts/tests/integrations/database/test-database.ts`；`new Redis(...)`，见 `scripts/tests/integrations/queue/test-queue.ts` 与 `scripts/tests/integrations/database/test-database.ts`。

## 固定数据与工厂

**测试数据：**
```typescript
async function createTestUser(opts: {
  id: string
  email: string
  signupIp: string
  deviceKey?: string
}) {
  await prisma.user.create({ data: { ... } })
}
```
- 这类临时 helper 存在于 `scripts/tests/features/anti-abuse/test-anti-abuse.ts`。
- 纯函数输入构造 helper 存在于 `scripts/tests/features/cdn-adapters/test-cdn-adapters.ts` 的 `makeHeaders()`。

**位置：**
- 未检测到共享 fixture 目录、factory 库或 `__fixtures__`。
- 测试数据辅助函数通常与测试脚本放在同一文件内。

## 覆盖率

**要求：**
- 未检测到 coverage 阈值、coverage 脚本或覆盖率配置。

**查看覆盖率：**
```bash
未检测到
```

## 测试类型

**单元测试：**
- 纯函数脚本测试最接近单元测试，例如 `scripts/tests/features/cdn-adapters/test-cdn-adapters.ts`，覆盖 `src/server/features/cdn-adapters` 的 header 解析与判定逻辑。

**集成测试：**
- 以真实依赖为主，覆盖数据库、Redis、支付、存储、分析、队列、安全校验，例如 `scripts/tests/integrations/database/test-database.ts`、`scripts/tests/integrations/queue/test-queue.ts`、`scripts/tests/integrations/security/test-turnstile.ts`。

**端到端测试：**
- 未检测到浏览器级 UI E2E 测试。
- `scripts/test-service-mode.mjs` 属于服务编排冒烟测试，不是前端交互型端到端测试。

## 常见模式

**异步测试：**
```typescript
try {
  await client.connect();
  const pong = await client.ping();
  assert("Redis PING", pong === "PONG", `返回: ${pong}`);
} catch (err: any) {
  assert("Redis 连接", false, err.message);
} finally {
  client.disconnect();
}
```
- 这一类 `try/catch/finally` 资源管理模式直接见于 `scripts/tests/integrations/database/test-database.ts`。

**错误测试：**
```typescript
try {
  await guardEmail('test@mailinator.com', '1.2.3.4')
  fail('临时邮箱', '应该被拦截但没有')
} catch (err) {
  const msg = (err as Error).message
  if (msg.startsWith('DISPOSABLE_EMAIL:')) {
    ok('临时邮箱', `正确拦截: ${msg}`)
  }
}
```
- 这一类“主动触发异常，再按错误消息前缀断言”的模式见于 `scripts/tests/features/anti-abuse/test-anti-abuse.ts`。

## 额外观察

- `tsconfig.json` 将 `scripts` 排除在主工程类型检查之外，因此 `scripts/tests/**` 不受 `tsc --noEmit` 的主流程覆盖。
- 测试入口没有统一汇总脚本；执行粒度以单文件为主。
- 测试脚本经常依赖 `.env`、数据库、Redis 或第三方凭据，因此它们更接近验证脚本，而不是完全隔离的本地单元测试。

---

*测试分析：2026-04-19*
