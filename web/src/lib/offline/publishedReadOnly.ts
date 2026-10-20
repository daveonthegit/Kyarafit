const PERSONAL_MODULES = new Set([
  "builds",
  "conventions",
  "cosplayNodes",
  "buildTasks",
  "workflow",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
  "seed",
  "publications",
]);

export const PUBLISHED_READ_ONLY_MESSAGE =
  "Web shows published copies only. Edit personal data in the mobile app, then publish it again.";

export function assertWebMutationAllowed(name: string): void {
  if (PERSONAL_MODULES.has(name.split(":")[0]) && name !== "builds:setGroupId") {
    throw new Error(PUBLISHED_READ_ONLY_MESSAGE);
  }
}
