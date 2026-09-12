export { InferenceModule } from './inference-module.js';
export { INFERENCE_ARTIFACTS } from './inference-artifacts.js';
export { InferenceNotEstablishedError } from './inference-types.js';
export type {
  BoundaryInferenceContent,
  CandidateHypothesis,
  ConvergenceInferenceContent,
  InferenceArtifact,
  InferenceSessionState,
  LineageInferenceContent,
  ReconciliationInferenceContent,
  SpecificationInferenceContent,
} from './inference-types.js';
export {
  InferenceConsistencyError,
  KNOWN_VALID_EVIDENCE_IDS as KNOWN_INFERENCE_EVIDENCE_IDS,
  validateInferenceArtifacts,
} from './inference-validator.js';
