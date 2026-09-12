export type SimNamespace =
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

export const APPROVED_SIM_NAMESPACES: ReadonlySet<SimNamespace> = new Set<SimNamespace>([
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

export const ROUTE_LIMITS = Object.freeze({
  MAX_URI_LENGTH: 256,
  MAX_NAMESPACE_LENGTH: 32,
  MAX_SEGMENTS: 8,
  MAX_SEGMENT_LENGTH: 64,
});

/**
 * Immutable representation of a validated, canonical sim:// route.
 */
export class SimRoute {
  public readonly namespace: SimNamespace;
  public readonly segments: readonly string[];
  public readonly canonical: string;

  constructor(namespace: SimNamespace, segments: readonly string[]) {
    this.namespace = namespace;
    this.segments = Object.freeze([...segments]);
    this.canonical = `sim://${namespace}/${segments.join('/')}`;
    Object.freeze(this);
  }

  /**
   * Returns the canonical string representation of this route.
   */
  public toString(): string {
    return this.canonical;
  }
}
