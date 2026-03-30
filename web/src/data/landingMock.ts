/**
 * @deprecated Import from `@/data/mockAccount` instead.
 * Re-exports for existing landing components.
 */
export type {
  MockBuild as LandingBuildPreview,
  MockElementNode as LandingNodePreview,
  MockBuildTask as LandingTaskPreview,
} from "./mockAccount";

export {
  MOCK_ACCOUNT,
  LANDING_BUILDS,
  LANDING_NODES,
  LANDING_BUILD_TASKS,
  mockBuildTaskProgressPercent,
} from "./mockAccount";
