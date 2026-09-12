import { IChallengeModule, ModuleId, VALID_MODULE_IDS } from './module-contract.js';

export class ModuleRegistryError extends Error {
  constructor(message: string) {
    super(`ModuleRegistry Error: ${message}`);
    this.name = 'ModuleRegistryError';
  }
}

/**
 * ModuleRegistry provides a strictly controlled, thread-safe, lockable in-memory
 * repository of challenge modules.
 * Prevents dynamic loading, arbitrary string lookups, and post-bootstrap mutation.
 */
export class ModuleRegistry {
  private readonly modules: Map<ModuleId, IChallengeModule> = new Map();
  private locked = false;

  /**
   * Registers a module. Rejects duplicates or invalid IDs.
   * Throws if registry is locked.
   */
  public register(module: IChallengeModule): void {
    if (this.locked) {
      throw new ModuleRegistryError('ModuleRegistry is locked. Module registration is forbidden after bootstrap.');
    }

    if (!module || typeof module !== 'object') {
      throw new ModuleRegistryError('Invalid module provided: must be an object implementing IChallengeModule.');
    }

    if (!VALID_MODULE_IDS.has(module.id)) {
      throw new ModuleRegistryError(`Module ID '${String(module.id)}' is not an approved challenge module ID.`);
    }

    if (this.modules.has(module.id)) {
      throw new ModuleRegistryError(`Duplicate registration: Module '${module.id}' is already registered.`);
    }

    this.modules.set(module.id, module);
  }

  /**
   * Locks the registry permanently. After this call, register() will fail.
   */
  public lock(): void {
    this.locked = true;
  }

  /**
   * Returns whether the registry has been locked.
   */
  public isLocked(): boolean {
    return this.locked;
  }

  /**
   * Looks up a registered module by its typed ModuleId.
   */
  public get(id: ModuleId): IChallengeModule | undefined {
    return this.modules.get(id);
  }

  /**
   * Checks if a module is registered.
   */
  public has(id: ModuleId): boolean {
    return this.modules.has(id);
  }

  /**
   * Returns an immutable array of all registered modules.
   */
  public getAll(): readonly IChallengeModule[] {
    return Object.freeze(Array.from(this.modules.values()));
  }

  /**
   * Clears all modules (for testing/cleanup only).
   */
  public resetForTesting(): void {
    this.modules.clear();
    this.locked = false;
  }
}
