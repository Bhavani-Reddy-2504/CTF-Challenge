import { bootstrapApplication } from '../bootstrap.js';
import { loadRuntimeConfig } from '../config/runtime-config.js';

/**
 * Production server entrypoint.
 * Validates configuration, bootstraps the challenge engine and dependencies,
 * starts the HTTPS server + HTTP->HTTPS redirect server, and registers
 * graceful shutdown handlers.
 */
export async function startServer(): Promise<void> {
  try {
    const config = loadRuntimeConfig();
    const app = await bootstrapApplication(config);

    // Start HTTPS server and (if configured) HTTP->HTTPS redirect server in parallel
    const startTasks: Promise<void>[] = [app.server.start()];
    if (app.redirectServer) {
      startTasks.push(app.redirectServer.start());
    }
    await Promise.all(startTasks);

    const shutdown = async (signal: string) => {
      app.logger.info(`Received ${signal}. Initiating graceful shutdown...`);
      try {
        await app.shutdown();
        process.exit(0);
      } catch (err) {
        process.stderr.write(`Error during shutdown: ${String(err)}\n`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => {
      shutdown('SIGINT').catch(() => process.exit(1));
    });

    process.on('SIGTERM', () => {
      shutdown('SIGTERM').catch(() => process.exit(1));
    });
  } catch (err) {
    process.stderr.write(`Fatal startup failure: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// Directly invoked
if (process.argv[1] && (process.argv[1].endsWith('start.ts') || process.argv[1].endsWith('start.js'))) {
  startServer().catch((err) => {
    process.stderr.write(`Unhandled exception: ${String(err)}\n`);
    process.exit(1);
  });
}
