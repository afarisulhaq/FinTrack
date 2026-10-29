import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const outputRoot = process.argv[2];
if (!outputRoot) throw new Error("Expected the compiled seed output directory");

for (const sourcePath of [
  "prisma/seed.ts",
  "server/services/default-categories.ts",
  "src/lib/default-categories.ts",
]) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  const errors = result.diagnostics?.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors?.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => "\n",
    }));
  }
  const targetPath = path.join(outputRoot, sourcePath.replace(/\.ts$/, ".js"));
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, result.outputText);
}
