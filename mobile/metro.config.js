const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const convexRoot = path.resolve(projectRoot, "..", "convex");

const config = getDefaultConfig(__dirname);

// Watch repo-root convex folder so _generated updates are picked up
config.watchFolders = [convexRoot, ...(config.watchFolders || [])];

// Resolve convex/_generated/* to repo-root convex folder (Metro doesn't use tsconfig paths).

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "convex/_generated/api" || moduleName === "convex/_generated/server") {
    const subpath = moduleName.replace("convex/_generated/", "");
    const filePath = path.join(convexRoot, "_generated", `${subpath}.js`);
    return {
      filePath,
      type: "sourceFile",
    };
  }
  // dataModel is types-only (.d.ts); use stub so Metro can resolve the module
  if (moduleName === "convex/_generated/dataModel") {
    return {
      filePath: path.join(projectRoot, "convex-stubs", "dataModel.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
