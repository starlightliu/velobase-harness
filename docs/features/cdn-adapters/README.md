# CDN 适配（CDN Adapters）

## 功能说明

自动感知部署环境（Cloudflare / Vercel / Nginx / 裸部署），从 HTTP 请求头中提取客户端上下文信息，并根据 SSL 模式自动调整 cookie 安全属性。

### 提供三类能力


| 能力                  | 说明                                                  | 来源 Header                                                 |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| **IP 感知**           | 提取客户端真实 IP，支持 IPv6 限速标准化                            | `CF-Connecting-IP` → `X-Real-IP` → `X-Forwarded-For`      |
| **国家感知**            | 提取客户端国家代码（ISO 3166-1 alpha-2）                       | `CF-IPCountry` → `x-vercel-ip-country` → `x-country-code` |
| **Flexible SSL 适配** | 检测 Cloudflare Flexible SSL 模式，自动调整 cookie secure 属性 | `CF-Visitor` + `CF-Connecting-IP`                         |


### 为什么有用

- **零配置**：不需要 API Key，不需要显式调用，部署到任意环境自动适配
- **防伪造**：优先使用 CDN 提供商注入的可信 header（如 `CF-Connecting-IP`）
- **多环境兼容**：通过 fallback 链支持 Cloudflare / Vercel / Nginx / 裸部署

### 什么是 Flexible SSL

```
用户  ── HTTPS ──>  Cloudflare 边缘  ── HTTP ──>  你的源站
```

用户看到 HTTPS（绿锁），但源站实际收到 HTTP 连接。此时 NextAuth 等框架默认设置的 `secure: true` cookie 无法在 HTTP 上正确设置，导致登录失败。本功能通过 `COOKIE_SECURE=false` 环境变量或运行时检测自动解决此问题。

## 依赖

无外部依赖。仅依赖 HTTP 请求头（由部署环境自动注入）。

## 代码位置

```
src/server/features/cdn-adapters/
├── request-context.ts   # 全部逻辑（IP、国家、Flexible SSL 检测）
└── index.ts             # 导出

兼容层（re-export，旧 import 路径不受影响）：
  src/server/lib/get-client-ip.ts
  src/server/lib/get-client-country.ts
```

## 使用方式

```typescript
import {
  getClientIpFromHeaders,
  getClientCountryFromHeaders,
  isFlexibleSSL,
  shouldCookieBeSecure,
  normalizeIpForRateLimit,
} from '@/server/features/cdn-adapters'

// IP
const ip = getClientIpFromHeaders(request.headers)

// 国家
const country = getClientCountryFromHeaders(request.headers)

// Flexible SSL
const isFlexible = isFlexibleSSL(request.headers)

// Cookie secure 属性
const secure = shouldCookieBeSecure(request.headers)
```

## 配置

### 环境变量


| 变量              | 必填  | 默认   | 说明                                                                           |
| --------------- | --- | ---- | ---------------------------------------------------------------------------- |
| `COOKIE_SECURE` | 否   | 自动推断 | `true` = HTTPS 直连; `false` = Cloudflare Flexible SSL; 空 = 生产 true / 开发 false |


### Flexible SSL 一键开启

如果使用 Cloudflare Flexible SSL，在 `.env` 中添加：

```env
COOKIE_SECURE=false
```

无需修改任何代码。NextAuth cookie 的 `secure` 属性会自动设为 `false`。

### 部署场景对照表


| 部署方式                    | COOKIE_SECURE | IP 来源              | 国家来源                  |
| ----------------------- | ------------- | ------------------ | --------------------- |
| Cloudflare Flexible SSL | `false`       | `CF-Connecting-IP` | `CF-IPCountry`        |
| Cloudflare Full SSL     | 留空（自动 true）   | `CF-Connecting-IP` | `CF-IPCountry`        |
| Vercel                  | 留空（自动 true）   | `X-Forwarded-For`  | `x-vercel-ip-country` |
| Nginx 反代                | 留空（自动 true）   | `X-Real-IP`        | 无                     |
| 本地开发                    | 留空（自动 false）  | `unknown`          | 无                     |


## AI 修改指南

### 添加新的 CDN 提供商

在 `request-context.ts` 的 fallback 链中添加对应 header。例如添加 AWS CloudFront 支持：

```typescript
// 在 getClientIpFromHeaders 中添加
const cfViewerAddress = headers.get('cloudfront-viewer-address');
if (cfViewerAddress) return cfViewerAddress.split(':')[0]?.trim() ?? 'unknown';
```

### 调整 fallback 优先级

修改 `getClientIpFromHeaders` 和 `getClientCountryFromHeaders` 中 header 的检查顺序。注意：CDN 提供商注入的 header（`CF-*`、`x-vercel-*`）应始终优先于标准 proxy header。

### 不要修改的部分

- `normalizeIpForRateLimit` 的 IPv6 /64 截取逻辑 — 这是限速准确性的关键
- `isFlexibleSSL` 的检测条件 — 必须同时满足 `CF-Connecting-IP` 存在 + `scheme=https`
- 旧文件的 re-export 兼容层 — 删除会破坏现有 import

