// @lexdiff/core — domain types, parser, and diff engine
export * from "./types.js";
export * from "./schemas.js";
export { Eli } from "./eli.js";
export { UnitPath } from "./unitPath.js";
export { TextNormalizer } from "./textNormalizer.js";
export { EliClient, EliClientError } from "./eliClient.js";
export type { EliClientOptions } from "./eliClient.js";
export { ActParser } from "./actParser.js";
export { SimilarityScorer } from "./similarityScorer.js";
export { EventHasher } from "./eventHasher.js";
export { DiffEngine, SIMILARITY_THRESHOLD } from "./diffEngine.js";
export type { DiffOptions } from "./diffEngine.js";
export { apply } from "./apply.js";
export type {
  ActRepository,
  UnitRepository,
  ChangeEventRepository,
  SubscriptionRepository,
  JobCursorRepository,
  NotificationLogRepository,
} from "./repositories.js";
