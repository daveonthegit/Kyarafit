const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const convexRoot = path.resolve(projectRoot, "..", "convex");
const designSystemRoot = path.resolve(projectRoot, "..", "design-system");

const config = getDefaultConfig(__dirname);

config.watchFolders = [convexRoot, designSystemRoot, ...(config.watchFolders || [])];

config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(projectRoot, "..", "node_modules"),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    return context.resolveRequest(
      context,
      path.join(projectRoot, "src", moduleName.slice(2)),
      platform
    );
  }
  if (moduleName === "convex/_generated/api" || moduleName === "convex/_generated/server") {
    const subpath = moduleName.replace("convex/_generated/", "");
    const filePath = path.join(convexRoot, "_generated", `${subpath}.js`);
    return {
      filePath,
      type: "sourceFile",
    };
  }
  if (moduleName === "convex/_generated/dataModel") {
    return {
      filePath: path.join(projectRoot, "convex-stubs", "dataModel.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
