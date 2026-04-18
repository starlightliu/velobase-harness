# 支付集成（Payment）

## 1. 选型


| Gateway         | 用途                   | 状态   |
| --------------- | -------------------- | ---- |
| **Stripe**      | 信用卡 / 订阅 / 退款        | ✅ 主力 |
| **NowPayments** | 加密货币（USDT/BTC/ETH 等） | ✅ 可选 |


> Airwallex、Telegram Stars、Waffo 已移除。

---

## 2. 架构

```
src/server/
├── order/                              # 订单 + 支付核心
│   ├── providers/
│   │   ├── types.ts                    # PaymentProvider 统一接口
│   │   ├── registry.ts                 # Provider 注册表
│   │   ├── stripe.ts                   # Stripe Provider 实现（re-export getStripeClient）
│   │   └── nowpayments.ts              # NowPayments 实现
│   ├── services/
│   │   ├── stripe/                     # ★ Stripe 服务集中目录
│   │   │   ├── client.ts              # 唯一 Stripe 实例（getStripe 单例）
│   │   │   ├── charge-saved-card.ts   # 后台扣款（off_session）
│   │   │   ├── create-checkout-session.ts  # 创建 Checkout Session
│   │   │   ├── create-refund.ts       # 退款
│   │   │   ├── verify-webhook.ts      # Webhook 签名校验
│   │   │   ├── process-webhook.ts     # Webhook 事件分发
│   │   │   └── stripe-error-utils.ts  # 错误工具函数
│   │   ├── init-providers.ts           # 按 env 自动注册 Provider
│   │   ├── resolve-gateway.ts          # 网关选择（默认 Stripe）
│   │   ├── checkout.ts                 # 结账编排
│   │   ├── handle-webhooks.ts          # Webhook 处理 + 状态更新
│   │   ├── confirm-payment.ts          # 主动轮询支付状态
│   │   ├── stripe-customer.ts          # Stripe Customer 管理
│   │   └── payment-transactions.ts     # 不可变流水记录
│   ├── schemas/                        # Zod 输入校验
│   ├── routers/                        # tRPC 路由
│   └── types/                          # 类型定义
├── billing/                            # 积分账户 + 扣费
├── membership/                         # 订阅状态 + 周期管理
├── fulfillment/                        # 支付成功后的权益发放
└── product/                            # 商品 + 定价
```

### Stripe 客户端 — 单一来源

所有服务端代码获取 Stripe 实例**必须**通过唯一入口：

```typescript
import { getStripe } from "@/server/order/services/stripe/client";

const stripe = getStripe();
await stripe.checkout.sessions.create({ ... });
```

**设计要点**：


| 特性            | 说明                                                   |
| ------------- | ---------------------------------------------------- |
| 惰性单例          | 首次调用 `getStripe()` 时才创建实例，模块加载不触发初始化                 |
| 不崩进程          | `STRIPE_SECRET_KEY` 缺失时进程正常启动，只有实际调用才报错              |
| apiVersion 唯一 | `STRIPE_API_VERSION` 常量只在 `client.ts` 定义一次           |
| 密钥验证          | 通过 `getStripeSecretKey()` 获取密钥，经过 Zod 校验             |
| 向后兼容          | `providers/stripe.ts` re-export `getStripeClient` 别名 |


**禁止事项**：

- ❌ `new Stripe(process.env.STRIPE_SECRET_KEY!, { ... })` — 不要自行初始化
- ❌ `import Stripe from "stripe"` 后 `new Stripe(...)` — 不要绕过单例
- ❌ 在新文件中写 `apiVersion: "..."` — 版本已集中在 `STRIPE_API_VERSION`
- ❌ `(await import("stripe")).default` 动态导入 — 直接用 `getStripe()`

### 数据流

```
用户点击购买
  → tRPC order.checkout
    → resolvePaymentGateway()         // 默认 STRIPE
    → checkout.ts 创建 Order + Payment
    → provider.createPayment()        // 生成 Stripe Checkout URL
  → 用户在 Stripe 页面付款
  → Stripe → POST /api/webhooks/stripe
    → handlePaymentWebhook()
      → 状态更新 Payment → SUCCEEDED
      → processFulfillmentByPayment() // 发放权益
      → recordPaymentTransaction()    // 不可变流水
      → asyncSendPaymentNotification()// Lark 通知
```

### Provider 接口

```typescript
interface PaymentProvider {
  createPayment(params): Promise<PaymentResult>
  createSubscription?(params): Promise<SubscriptionResult>
  handlePaymentWebhook(req): Promise<PaymentWebhookResult | null>
  handleSubscriptionWebhook?(req): Promise<PaymentWebhookResult | null>
  confirmPayment?(params): Promise<{ isPaid: boolean; ... }>
  expireCheckoutSession?(sessionId): Promise<void>
}
```

### stripe/ 目录各文件职责


| 文件                           | 职责                         | 使用方式                                   |
| ---------------------------- | -------------------------- | -------------------------------------- |
| `client.ts`                  | **唯一**的 Stripe 实例工厂        | `import { getStripe } from "./client"` |
| `charge-saved-card.ts`       | 用已保存的卡后台扣款                 | 快速购买、续费回退                              |
| `create-checkout-session.ts` | 创建 Stripe Checkout Session | 结账流程                                   |
| `create-refund.ts`           | 发起退款                       | 客服/自动退款                                |
| `verify-webhook.ts`          | Webhook 签名校验               | Webhook 入口                             |
| `process-webhook.ts`         | Webhook 事件路由分发             | 内部使用                                   |
| `stripe-error-utils.ts`      | Stripe 错误判断工具              | Customer 不存在检测等                        |


---

## 3. 对外接口

### 发起购买

```typescript
const result = await trpc.order.checkout.mutate({
  productId: "prod_xxx",
  successUrl: "https://app.com/payment/success",
  cancelUrl: "https://app.com/pricing",
  gateway: "STRIPE",           // 可选，默认 STRIPE
  metadata: { source: "landing" },
})

if (result.url) {
  window.location.href = result.url
}
```

### 查询订阅状态

```typescript
const status = await trpc.membership.getSubscriptionStatus.query({ userId })
// → { status: "ACTIVE", currentCycle: { ... }, planSnapshot: { ... } }
```

### 查询积分余额

```typescript
const balance = await trpc.billing.getBalance.query()
// → { available: 100, pending: 0 }
```

---

## 4. 配置

### 环境变量

```env
# Stripe（必需）
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# NowPayments（可选，启用加密货币支付）
NOWPAYMENTS_API_KEY=xxx
NOWPAYMENTS_IPN_SECRET=xxx
NOWPAYMENTS_PAY_CURRENCY=usdttrc20

# 强制指定网关（仅测试用）
# FORCE_PAYMENT_GATEWAY=NOWPAYMENTS
```

### Stripe Dashboard 配置

1. **Webhook Endpoint**：`https://your-domain.com/api/webhooks/stripe`
2. **监听事件**：
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.succeeded`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.funds_withdrawn`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `invoice.voided`

### 本地开发（Docker 方式，推荐）

无需安装 Stripe CLI，通过 Docker Compose 一键启动：

```bash
# 1. 确保 .env 中已配置 STRIPE_SECRET_KEY
#    STRIPE_SECRET_KEY=sk_test_xxx

# 2. 启动 Stripe CLI 容器（前台运行，可看到日志）
make stripe

# 3. 从输出中复制 webhook signing secret：
#    > Ready! Your webhook signing secret is whsec_xxx
#    将 whsec_xxx 写入 .env 的 STRIPE_WEBHOOK_SECRET

# 4. 停止 Stripe CLI
make stripe-stop
```

> `stripe-cli` 使用 Docker `profiles`，不会随 `make db` 一起启动，需要单独运行。

### 本地开发（手动安装 CLI）

```bash
# 安装 Stripe CLI
brew install stripe/stripe-cli/stripe   # macOS
# 或 scoop install stripe               # Windows

# 登录
stripe login

# 转发 webhook 到本地
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 将输出的 whsec_xxx 写入 .env 的 STRIPE_WEBHOOK_SECRET
```

---

## 5. 新增 Stripe 功能速查

### 场景 A：新增一个需要调用 Stripe API 的服务

```typescript
// src/server/xxx/services/my-service.ts
import { getStripe } from "@/server/order/services/stripe/client";

export async function myStripeFunction() {
  const stripe = getStripe();
  // 直接使用 stripe 实例
  const customer = await stripe.customers.retrieve("cus_xxx");
  return customer;
}
```

### 场景 B：新增一个 Worker 中的 Stripe 操作

```typescript
// src/workers/processors/my-task/processor.ts
import { getStripe } from "@/server/order/services/stripe/client";

export async function processMyJob(job: Job) {
  // STRIPE_SECRET_KEY 缺失时进程不会崩溃
  // 只有执行到这里才会报错
  const stripe = getStripe();
  await stripe.invoices.list({ subscription: job.data.subId });
}
```

### 场景 C：新增支付网关

1. 实现 `PaymentProvider` 接口（`src/server/order/providers/my-gateway.ts`）
2. 在 `init-providers.ts` 按环境变量条件注册
3. 添加 Webhook 路由（`src/app/api/webhooks/my-gateway/route.ts`）
4. 更新本文档

---

## 6. 异常处理

### Webhook 幂等

- `PaymentWebhookLog` 表按 `eventId` 去重，重复事件直接跳过
- 支付状态只允许「升级」（PENDING → SUCCEEDED），不允许降级
- 订阅周期通过 `outerBizId` 确保续费积分不重复发放

### Worker 补偿机制


| Worker                      | 频率  | 职责                                    |
| --------------------------- | --- | ------------------------------------- |
| `order-compensation`        | 每分钟 | 扫描 PENDING 支付，通过 Stripe API 确认状态并补偿履约 |
| `subscription-compensation` | 每分钟 | 扫描 TRIAL 订阅，检查 Stripe 是否已扣款但本地未转正     |
| `payment-reconciliation`    | 每小时 | 对账：Stripe/NowPayments 状态与本地差异报告       |


### 常见场景


| 场景           | 处理方式                                            |
| ------------ | ----------------------------------------------- |
| Webhook 重复到达 | `PaymentWebhookLog` 幂等拦截                        |
| Webhook 乱序   | 状态只升级不降级                                        |
| 履约失败         | 抛 `WebhookFulfillmentError`，返回 500 触发 Stripe 重试 |
| Checkout 过期  | `order-compensation` 定期清理 PENDING 状态的 Payment   |
| 退款/争议        | Webhook 处理退款，作废 affiliate 佣金并通知                 |
| 密钥缺失         | 进程正常启动，仅调用 `getStripe()` 时才抛错                   |


---

## 7. AI 引导

### 规则（写入 AGENTS.md）

1. **Stripe 客户端**：必须通过 `getStripe()` from `@/server/order/services/stripe/client`，**禁止**自行 `new Stripe()`
2. **发起支付**：必须通过 `trpc.order.checkout` tRPC，**禁止**直接调用 Stripe SDK 创建 Checkout
3. **支付状态更新**：仅由 Webhook 驱动，前端轮询 `confirmPayment` 仅作补偿
4. **权益发放**：通过 `fulfillment/manager.ts`，**禁止**在 Webhook handler 中直接操作用户余额
5. **积分操作**：通过 `billing` 域的 `grant/deduct`，不直接写 DB
6. **订阅管理**：通过 `membership` 域，**禁止**直接操作 `UserSubscription` 表
7. **新增支付网关**：实现 `PaymentProvider` 接口 → 在 `init-providers.ts` 注册 → 添加 Webhook 路由
8. **不可变流水**：每笔资金变动必须有 `PaymentTransaction` 记录

### 常见错误

- ❌ `new Stripe(process.env.STRIPE_SECRET_KEY!, ...)` — 必须用 `getStripe()`
- ❌ 在前端直接创建 Stripe PaymentIntent
- ❌ 在 Webhook handler 中直接 `db.user.update({ credits })`
- ❌ 忘记在 Stripe Dashboard 配置 Webhook endpoint
- ❌ 硬编码商品价格，应通过 Product 表查询
- ❌ 在新文件中写 `apiVersion: "2025-09-30.clover"` — 由 `client.ts` 统一管理

