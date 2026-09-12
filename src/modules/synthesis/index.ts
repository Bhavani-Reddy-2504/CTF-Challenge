export { SynthesisModule } from './synthesis-module.js';
export { SYNTHESIS_ARTIFACTS } from './synthesis-artifacts.js';
export { SynthesisNotEstablishedError } from './synthesis-types.js';
export type {
  BoundarySynthesisContent,
  LineageSynthesisContent,
  MultiPerspectiveSynthesisContent,
  RelationalSynthesisContent,
  SpecificationSynthesisContent,
  SynthesisArtifact,
  SynthesisSessionState,
} from './synthesis-types.js';
export {
  SynthesisConsistencyError,
  KNOWN_VALID_EVIDENCE_IDS as KNOWN_SYNTHESIS_EVIDENCE_IDS,
  validateSynthesisArtifacts,
} from './synthesis-validator.js';
