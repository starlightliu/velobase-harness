# 网站、API 与 Worker：架构拆分与部署

> **范围**：本文件描述**本仓库**内三类运行时（Web / API / Worker）的职责边界、灵活部署模式、CI 差异、Kubernetes 清单差异，以及通过 GitOps 触达集群的方式。

---

## 1. 架构拆分：三类进程各自解决什么问题

同一 Git 仓库、三套**入口进程**，对应三套可独立或合并部署的服务：


| 维度         | 网站（Web）                                                 | API（HTTP）                               | Worker（队列消费者）                          |
| ---------- | ------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| **职责**     | 面向浏览器与 SEO 的 Next.js 站点、页面与 tRPC 等                      | 独立对外 HTTP 面（Hono）：集成、Webhook、与站点解耦的接口   | BullMQ Worker：异步任务、长耗时作业、与请求路径解耦       |
| **入口**     | Next production server（`server.js`）/ `src/web/start.ts` | `src/api/index.ts`（`@hono/node-server`） | `src/workers/index.ts`                 |
| **本地脚本**   | `pnpm dev` / `pnpm start`                               | `pnpm api:dev` / `pnpm api:prod`        | `pnpm worker:dev` / `pnpm worker:prod` |
| **容器监听端口** | **3000**                                                | **3002**（`API_PORT`）                    | **3001**（`WORKER_PORT`）                |
| **统一入口**   | `src/server/standalone.ts`（SERVICE_MODE 控制）             | 同左                                      | 同左                                     |


**数据面**：三者可共享同一套 Prisma/Redis 等配置（通过 `.env` 注入），但运行时不共享进程内存；扩缩容与发布彼此独立。

---

## 2. SERVICE_MODE 灵活部署

通过 `SERVICE_MODE` 环境变量控制在一个进程中启动哪些服务：


| SERVICE_MODE | 启动的服务              | 适用场景            |
| ------------ | ------------------ | --------------- |
| `all`（默认）    | Web + API + Worker | 本地开发、小规模部署      |
| `web`        | 仅 Next.js          | 生产拆分部署          |
| `api`        | 仅 Hono API         | 生产拆分部署          |
| `worker`     | 仅 BullMQ Worker    | 生产拆分部署          |
| `web,api`    | Web + API          | 中等规模（Worker 单独） |


**关键约束**：三类服务共享同一套 Prisma/Redis 配置，但运行时各自持有独立连接实例，不共享进程内存状态，因此无论合并还是拆分都不影响业务正确性。

### 统一入口

`src/server/standalone.ts` 根据 `SERVICE_MODE` 调用对应的启动函数：

- `startWeb()` — `src/web/start.ts`
- `startApi()` — `src/api/start.ts`
- `startWorker()` — `src/workers/start.ts`

### 容器镜像

- **统一 Dockerfile**（推荐）：`Dockerfile` 构建包含 Next.js standalone + API + Worker 源码的完整镜像，通过 `SERVICE_MODE` 环境变量控制启动模式
- **拆分 Dockerfile**（可选）：`Dockerfile.web`、`Dockerfile.api`、`Dockerfile.worker` 各构建最小化镜像

---

## 3. GitHub Actions CI/CD

触发条件：`dev` / `pre` / `prod` 分支 `push`（忽略 `scripts/`、`docs/`、`*.md`）。

### 3.1 流水线结构

```
setup（生成 VERSION / ENV_NAME 等）
    └── build（pnpm install + pnpm build + docker build 统一镜像 + 拆分镜像）
            └── deploy（更新 gitops 仓库的 kustomization.yaml）
```

### 3.2 镜像产物


| 镜像名                | 说明                      |
| ------------------ | ----------------------- |
| `vibevideo`        | 统一镜像，通过 SERVICE_MODE 切换 |
| `vibevideo-web`    | 仅 Web（最小体积）             |
| `vibevideo-api`    | 仅 API（最小体积）             |
| `vibevideo-worker` | 仅 Worker（最小体积）          |


**镜像 Tag 规则**（四者一致）：`${ENV_NAME}-${VERSION}`，例如 `prod-20260101120000-abcdefg`；并额外打 `${ENV_NAME}-latest`。

### 3.3 `deploy` Job：GitOps 写回

- 使用 `GH_PAT` 检出 `utopixelart/gitops`，在路径 `apps/vibevideo/overlays/${ENV_NAME}/` 下执行 `sed` 替换 `kustomization.yaml` 里的 `newTag:`。
- 集群侧由 **GitOps（Argo CD）** 监听该仓库变更并同步到 Kubernetes。

---

## 4. Kubernetes 部署

### 4.1 方案 A：单 Pod 全能模式（dev / 小规模）

```
deploy/base/deployment-standalone.yaml  — SERVICE_MODE=all
deploy/base/service.yaml                — :80 → :3000
deploy/base/service-api.yaml            — :80 → :3002
deploy/base/service-worker.yaml         — :80 → :3001
```

### 4.2 方案 B：三 Pod 拆分模式（生产）


| 资源                | Web                                         | API                                 | Worker                              |
| ----------------- | ------------------------------------------- | ----------------------------------- | ----------------------------------- |
| **Deployment 名称** | `vibevideo`                                 | `vibevideo-api`                     | `vibevideo-worker`                  |
| **SERVICE_MODE**  | `web`                                       | `api`                               | `worker`                            |
| **Pod 标签**        | `app: vibevideo`                            | `app: vibevideo-api`                | `app: vibevideo-worker`             |
| **存活/就绪**         | **HTTP** `/api/health` `/api/ready` `:3000` | **HTTP** `/health` `/ready` `:3002` | **HTTP** `/health` `/ready` `:3001` |


### 4.3 Service 与 Ingress

- **Service**：三个 Deployment 各有一个 ClusterIP Service，端口 **80** 分别转到 **3000 / 3002 / 3001**。
- **Ingress**：挂载站点 Host（`your-domain.com`）和 API 子域 Host（`api.your-domain.com`）两条规则。**Worker 不挂 Ingress**。

### 4.4 在 kustomization.yaml 中切换方案

`deploy/base/kustomization.yaml` 默认使用方案 B（拆分模式），可通过注释切换到方案 A（全能模式）。

---

## 5. GitOps 与 Argo CD


| 项目            | 说明                                                                  |
| ------------- | ------------------------------------------------------------------- |
| **本仓库职责**     | 业务代码、Dockerfile、`deploy/` 基线；CI 构建镜像并推送 ACR；更新 `gitops` 仓库中的镜像 tag。 |
| **GitOps 仓库** | `utopixelart/gitops`，路径 `apps/vibevideo/overlays/<env>/`。           |
| **Argo CD**   | Application 指向上述 overlay，自动或手动 Sync 后集群 Deployment 滚动升级。            |


本地若执行 `make deploy`，仅打印说明：部署经 GitOps（Argo CD）完成，需推送对应分支触发流水线。

---

*若修改 CI 的 tag 规则、增加第四类服务，或变更 Ingress 规则，请同步更新本文与 `deploy/base`。*