import { bootstrapApplication } from './bootstrap.js';

async function main(): Promise<void> {
  try {
    const app = await bootstrapApplication();

    // Start HTTPS server + HTTP->HTTPS redirect server in parallel
    const startTasks: Promise<void>[] = [app.server.start()];
    if (app.redirectServer) {
      startTasks.push(app.redirectServer.start());
    }
    await Promise.all(startTasks);

    const handleSignal = async (signal: string) => {
      process.stdout.write(`\nReceived ${signal}. Shutting down...\n`);
      await app.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
  } catch (err) {
    process.stderr.write(`Fatal bootstrap failure: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// Only execute main when directly invoked
if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
  main().catch((err) => {
    process.stderr.write(`Unhandled exception: ${String(err)}\n`);
    process.exit(1);
  });
}

export * from './config/index.js';
export * from './errors/index.js';
export * from './logging/index.js';
export * from './security/index.js';
export * from './session/index.js';
export * from './context/index.js';
export * from './engine/index.js';
export * from './router/index.js';
export * from './evidence/index.js';
export * from './modules/index.js';
export * from './server/index.js';
export * from './bootstrap.js';
