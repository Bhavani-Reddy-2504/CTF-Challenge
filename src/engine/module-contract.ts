export type ModuleId =
  | 'metadata'
  | 'config'
  | 'audit'
  | 'identity'
  | 'trust'
  | 'transition'
  | 'constraint'
  | 'inference'
  | 'graph'
  | 'synthesis'
  | 'resolution'
  | 'evaluation'
  | 'sts'
  | 'policy'
  | 'controlplane'
  | 'vault';

export const VALID_MODULE_IDS: ReadonlySet<ModuleId> = new Set<ModuleId>([
  'metadata',
  'config',
  'audit',
  'identity',
  'trust',
  'transition',
  'constraint',
  'inference',
  'graph',
  'synthesis',
  'resolution',
  'evaluation',
  'sts',
  'policy',
  'controlplane',
  'vault',
]);

/**
 * Interface contract for all in-process simulated challenge domain modules.
 * Strictly defines initialization, dependencies, and lifecycle.
 */
export interface IChallengeModule {
  /**
   * Unique, static, immutable module identifier.
   */
  readonly id: ModuleId;

  /**
   * Semantic version string of the module.
   */
  readonly version: string;

  /**
   * Explicit list of other ModuleIds that this module depends upon.
   * The ChallengeEngine will inject only these approved dependencies.
   */
  readonly requiredDependencies: readonly ModuleId[];

  /**
   * Lifecycle hook executed during application bootstrap.
   * Receives only the explicitly declared dependencies.
   */
  initialize(dependencies: ReadonlyMap<ModuleId, IChallengeModule>): Promise<void> | void;

  /**
   * Optional lifecycle hook executed during graceful application shutdown.
   */
  shutdown?(): Promise<void> | void;
}
