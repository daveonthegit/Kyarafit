import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("typechecks the deployed functions without the dev-only convex-test dependency", () => {
  const config = ts.getParsedCommandLineOfConfigFile(
    fileURLToPath(new URL("./tsconfig.json", import.meta.url)),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    }
  );
  if (!config) throw new Error("Cannot load deployment TypeScript configuration");
  const host = ts.createCompilerHost(config.options);
  host.resolveModuleNames = (names, containingFile) =>
    names.map((name) =>
      name === "convex-test"
        ? undefined
        : ts.resolveModuleName(name, containingFile, config.options, host).resolvedModule
    );
  const program = ts.createProgram(config.fileNames, config.options, host);
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
  expect(
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
  ).toEqual([]);
}, 30_000);
