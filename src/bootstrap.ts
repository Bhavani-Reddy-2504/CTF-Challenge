import { AppConfig, ConfigInput, validateAndBuildConfig } from './config/config.js';
import { ChallengeEngine } from './engine/challenge-engine.js';
import { ModuleRegistry } from './engine/module-registry.js';
import { Logger } from './logging/logger.js';
import { HttpRedirectServer } from './server/http-redirect-server.js';
import { HttpServer } from './server/http-server.js';
import { loadOrGenerateTlsCert } from './server/tls-utils.js';
import { SessionStore } from './session/session-store.js';

import { AuditModule } from './modules/audit/audit-module.js';
import { ConfigModule } from './modules/config/config-module.js';
import { ConstraintModule } from './modules/constraint/constraint-module.js';
import { GraphModule } from './modules/graph/graph-module.js';
import { IdentityModule } from './modules/identity/identity-module.js';
import { InferenceModule } from './modules/inference/inference-module.js';
import { MetadataModule } from './modules/metadata/metadata-module.js';
import { ResolutionModule } from './modules/resolution/resolution-module.js';
import { EvaluationModule } from './modules/evaluation/evaluation-module.js';
import { SynthesisModule } from './modules/synthesis/synthesis-module.js';
import { TransitionModule } from './modules/transition/transition-module.js';
import { TrustModule } from './modules/trust/trust-module.js';

export interface ApplicationInstance {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly registry: ModuleRegistry;
  readonly sessionStore: SessionStore;
  readonly engine: ChallengeEngine;
  readonly server: HttpServer;
  readonly redirectServer: HttpRedirectServer | undefined;
  shutdown(): Promise<void>;
}

/**
 * Bootstraps the application components in strict architectural order.
 */
export async function bootstrapApplication(configOverrides: ConfigInput = {}): Promise<ApplicationInstance> {
  // 1. Build and validate strict configuration
  const config = validateAndBuildConfig(configOverrides);

  // 2. Initialize logging
  const logger = new Logger(config.logLevel);

  logger.info('Starting StrataCore Foundation Application bootstrap...', undefined, {
    env: config.environment,
    port: config.port,
  });

  // 3. Initialize in-memory session store
  const sessionStore = new SessionStore(config, logger);

  // 4. Initialize module registry and challenge engine
  const registry = new ModuleRegistry();
  const engine = new ChallengeEngine(registry, logger);

  // Register simulated modules
  const metadataModule = new MetadataModule(engine.getRouteRegistry());
  const auditModule = new AuditModule(engine.getRouteRegistry());
  const configModule = new ConfigModule(engine.getRouteRegistry());
  const identityModule = new IdentityModule(engine.getRouteRegistry());
  const trustModule = new TrustModule(engine.getRouteRegistry());
  const transitionModule = new TransitionModule(engine.getRouteRegistry());
  const constraintModule = new ConstraintModule(engine.getRouteRegistry());
  const inferenceModule = new InferenceModule(engine.getRouteRegistry());
  const graphModule = new GraphModule(engine.getRouteRegistry());
  const synthesisModule = new SynthesisModule(engine.getRouteRegistry());
  const resolutionModule = new ResolutionModule(engine.getRouteRegistry());
  const evaluationModule = new EvaluationModule(engine.getRouteRegistry());
  registry.register(metadataModule);
  registry.register(auditModule);
  registry.register(configModule);
  registry.register(identityModule);
  registry.register(trustModule);
  registry.register(transitionModule);
  registry.register(constraintModule);
  registry.register(inferenceModule);
  registry.register(graphModule);
  registry.register(synthesisModule);
  registry.register(resolutionModule);
  registry.register(evaluationModule);

  // 5. Initialize the engine and lock the module and route registries
  await engine.initialize();

  // 6. Load or generate TLS credentials (skipped in test — tests use plain HTTP)
  let tlsCredentials: Awaited<ReturnType<typeof loadOrGenerateTlsCert>> | undefined;
  if (config.environment !== 'test') {
    logger.info('Loading TLS credentials...', undefined);
    tlsCredentials = await loadOrGenerateTlsCert(config.environment);
    logger.info(
      tlsCredentials.isSelfSigned
        ? 'Self-signed TLS certificate generated for development.'
        : 'TLS certificate loaded from disk.',
      undefined
    );
  }

  // 7. Initialize HTTPS server (or plain HTTP in test)
  const server = new HttpServer({
    config,
    sessionStore,
    engine,
    tlsCredentials,
    logger,
  });

  // 8. (Optional) Initialize HTTP -> HTTPS redirect server (not used in test)
  let redirectServer: HttpRedirectServer | undefined;
  if (config.environment !== 'test' && config.httpRedirectPort > 0) {
    redirectServer = new HttpRedirectServer({
      httpPort: config.httpRedirectPort,
      httpsPort: config.port,
      host: config.host,
      logger,
    });
  }

  const instance: ApplicationInstance = {
    config,
    logger,
    registry,
    sessionStore,
    engine,
    server,
    redirectServer,
    async shutdown(): Promise<void> {
      logger.info('Initiating graceful application shutdown...');
      await server.stop();
      if (redirectServer) {
        await redirectServer.stop();
      }
      await engine.shutdown();
      sessionStore.shutdown();
      logger.info('Graceful shutdown completed.');
    },
  };

  return instance;
}
