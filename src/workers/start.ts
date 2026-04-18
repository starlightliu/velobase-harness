/**
 * Worker Service Starter
 *
 * Exports `startWorker()` which can be called either:
 *  - from `src/workers/index.ts` (standalone worker process)
 *  - from `src/server/standalone.ts` (SERVICE_MODE=all or SERVICE_MODE=worker)
 *
 * Returns a `shutdown` function for graceful termination.
 */
import { WorkerRegistry } from "./registry";
import { createServer } from "./server";
import { createLogger } from "@/lib/logger";

import {
  orderCompensationQueue,
  subscriptionMonthlyCreditsQueue,
  subscriptionCompensationQueue,
  staleJobCleanupQueue,
  conversionAlertQueue,
  paymentReconciliationQueue,
  touchDeliveryQueue,
  supportSyncQueue,
  supportProcessQueue,
  supportSendQueue,
  googleAdsUploadQueue,
} from "./queues";

import {
  processOrderCompensationJob,
  registerOrderCompensationScheduler,
  processSubscriptionMonthlyCreditsJob,
  registerSubscriptionMonthlyCreditsScheduler,
  processSubscriptionCompensationJob,
  registerSubscriptionCompensationScheduler,
  processStaleJobCleanup,
  registerStaleJobCleanupScheduler,
  processConversionAlert,
  registerConversionAlertScheduler,
  processPaymentReconciliation,
  registerPaymentReconciliationScheduler,
  processTouchDeliveryJob,
  registerTouchDeliveryScheduler,
  processSupportSyncJob,
  registerSupportSyncScheduler,
  processSupportProcessJob,
  registerSupportProcessScheduler,
  processSupportSendJob,
  registerSupportSendScheduler,
  processGoogleAdsUploadJob,
  registerGoogleAdsUploadScheduler,
} from "./processors";

const log = createLogger("worker");

const DEFAULT_WORKER_PORT = 3001;

export interface WorkerHandle {
  registry: WorkerRegistry;
  shutdown: () => Promise<void>;
}

export async function startWorker(): Promise<WorkerHandle> {
  const port = parseInt(
    process.env.WORKER_PORT ?? String(DEFAULT_WORKER_PORT),
    10,
  );

  const registry = new WorkerRegistry();

  // --- Register workers -----------------------------------------------------

  registry.register(orderCompensationQueue, processOrderCompensationJob, {
    concurrency: 1,
    lockDuration: 300000,
  });

  registry.register(
    subscriptionMonthlyCreditsQueue,
    processSubscriptionMonthlyCreditsJob,
    { concurrency: 1, lockDuration: 300000 },
  );

  registry.register(
    subscriptionCompensationQueue,
    processSubscriptionCompensationJob,
    { concurrency: 1, lockDuration: 300000 },
  );

  registry.register(staleJobCleanupQueue, processStaleJobCleanup, {
    concurrency: 1,
    lockDuration: 300000,
  });

  registry.register(conversionAlertQueue, processConversionAlert, {
    concurrency: 1,
    lockDuration: 60000,
  });

  registry.register(
    paymentReconciliationQueue,
    processPaymentReconciliation,
    { concurrency: 1, lockDuration: 300000 },
  );

  registry.register(touchDeliveryQueue, processTouchDeliveryJob, {
    concurrency: 2,
    lockDuration: 300000,
  });

  registry.register(supportSyncQueue, processSupportSyncJob, {
    concurrency: 1,
    lockDuration: 120000,
  });

  registry.register(supportProcessQueue, processSupportProcessJob, {
    concurrency: 5,
    lockDuration: 300000,
  });

  registry.register(supportSendQueue, processSupportSendJob, {
    concurrency: 3,
    lockDuration: 60000,
  });

  registry.register(googleAdsUploadQueue, processGoogleAdsUploadJob, {
    concurrency: 1,
    lockDuration: 300000,
  });

  // --- Register schedulers ---------------------------------------------------

  registry.registerScheduler(registerOrderCompensationScheduler);
  registry.registerScheduler(registerSubscriptionMonthlyCreditsScheduler);
  registry.registerScheduler(registerSubscriptionCompensationScheduler);
  registry.registerScheduler(registerStaleJobCleanupScheduler);
  registry.registerScheduler(registerConversionAlertScheduler);
  registry.registerScheduler(registerPaymentReconciliationScheduler);
  registry.registerScheduler(registerTouchDeliveryScheduler);
  registry.registerScheduler(registerSupportSyncScheduler);
  registry.registerScheduler(registerSupportProcessScheduler);
  registry.registerScheduler(registerSupportSendScheduler);
  registry.registerScheduler(registerGoogleAdsUploadScheduler);

  // --- Start HTTP server + schedulers ----------------------------------------

  const server = await createServer(registry.getQueues());
  await registry.startAll();
  await server.listen({ port, host: "0.0.0.0" });

  log.info({ port }, `Worker ready - HTTP server listening on port ${port}`);
  log.info("Bull Board UI: /_worker/queues");
  log.info("Health check: /health");

  const shutdown = async () => {
    await registry.shutdown();
    await server.close();
    log.info("Worker HTTP server closed");
  };

  return { registry, shutdown };
}
