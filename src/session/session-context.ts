import { ForbiddenError } from '../errors/app-error.js';

export type ModuleNamespace =
  | 'core'
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

export const VALID_MODULE_NAMESPACES: ReadonlySet<ModuleNamespace> = new Set<ModuleNamespace>([
  'core',
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

export interface CoreContextState {
  readonly initializedAt: string;
  readonly lastActiveAt: string;
  readonly progressionTier: number;
  readonly completedMilestones: readonly string[];
}

export class StateOwnershipError extends ForbiddenError {
  constructor(message: string) {
    super(message);
    this.name = 'StateOwnershipError';
  }
}

/**
 * ChallengeSessionContext provides isolated, module-namespaced state storage.
 * Prevents modules from overwriting or corrupting another module's state.
 */
export class ChallengeSessionContext {
  private readonly namespaces: Map<ModuleNamespace, Record<string, unknown>> = new Map();

  constructor() {
    // Initialize default core context
    this.namespaces.set('core', {
      initializedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      progressionTier: 0,
      completedMilestones: [],
    });
  }

  /**
   * Retrieves read-only state for a given module namespace.
   */
  public getNamespaceState<T = Record<string, unknown>>(namespace: ModuleNamespace): Readonly<T> | undefined {
    if (!VALID_MODULE_NAMESPACES.has(namespace)) {
      throw new Error(`Invalid namespace '${namespace}'.`);
    }
    const state = this.namespaces.get(namespace);
    if (!state) {
      return undefined;
    }
    // Return a shallow frozen clone to prevent accidental in-place mutations
    return Object.freeze({ ...state }) as Readonly<T>;
  }

  /**
   * Sets state for a given namespace. Enforces strict module ownership.
   * Only the designated module (or 'core' / 'system') can write to its corresponding namespace.
   */
  public setNamespaceState<T extends object>(
    namespace: ModuleNamespace,
    state: T,
    callerModuleId: string
  ): void {
    if (!VALID_MODULE_NAMESPACES.has(namespace)) {
      throw new Error(`Invalid namespace '${namespace}'.`);
    }

    // Check ownership
    const isSystemOrCore = callerModuleId === 'core' || callerModuleId === 'system';
    const isOwner = callerModuleId === namespace;

    if (!isSystemOrCore && !isOwner) {
      throw new StateOwnershipError(
        `State Ownership Violation: Module '${callerModuleId}' is not authorized to write to namespace '${namespace}'.`
      );
    }

    // Deep freeze or defensive copy
    const copy = { ...state };
    this.namespaces.set(namespace, copy as Record<string, unknown>);
  }

  /**
   * Updates fields within a namespace.
   */
  public updateNamespaceState(
    namespace: ModuleNamespace,
    partialState: Record<string, unknown>,
    callerModuleId: string
  ): void {
    const existing = this.namespaces.get(namespace) ?? {};
    this.setNamespaceState(namespace, { ...existing, ...partialState }, callerModuleId);
  }

  /**
   * Returns a list of all active namespaces currently containing state.
   */
  public getActiveNamespaces(): readonly ModuleNamespace[] {
    return Array.from(this.namespaces.keys());
  }
}
