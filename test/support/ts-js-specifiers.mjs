// The tests' stand-in for tsx, for the laboratory's legs only (test/support/run-lab.js): a resolve hook
// that reads a relative `./x.js` specifier as `./x.ts` when only the TypeScript file exists, as tsc and tsx
// do, and a load hook that transpiles each `.ts` file with the TypeScript compiler of runward's own
// node_modules, one file at a time (`transpileModule`, no type check), as tsx does. The shipped example's
// tests then run with no dependency but zod, which the laboratory links from runward's own node_modules:
// the unit tests install nothing and reach no network. The real container runs use tsx from the lockfile.
//
// It used Node.js's own type transform (`--experimental-transform-types`) until Node.js 26 removed the
// flag: `node: bad option`, exit 9, and every mutation leg of the laboratory exited non-zero on the CI's
// Node.js 26 job. Type stripping alone does not do: the example writes parameter properties
// (`constructor(private readonly deps: …)`), which stripping refuses.
import { createRequire, register } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const TYPESCRIPT = pathToFileURL(require.resolve("typescript")).href;
// In node_modules/.cache, where tools keep their caches, by the compiler's version: never in the tree a
// run judges, and never left in the system's temporary directory.
const CACHE = join(dirname(dirname(require.resolve("typescript/package.json"))), ".cache",
  `runward-lab-ts-${require("typescript/package.json").version}`);

register("data:text/javascript," + encodeURIComponent(`
  import { existsSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); } catch (e) {
      if (e?.code !== "ERR_MODULE_NOT_FOUND" || !/^\\.{1,2}\\//.test(specifier) || !specifier.endsWith(".js")) throw e;
      const ts = new URL(specifier.replace(/\\.js$/, ".ts"), context.parentURL);
      if (!existsSync(fileURLToPath(ts))) throw e;
      return next(ts.href, context);
    }
  }
  export async function load(url, context, next) {
    if (!url.startsWith("file:") || !url.endsWith(".ts")) return next(url, context);
    const { readFile, writeFile, mkdir, rename } = await import("node:fs/promises");
    const { createHash } = await import("node:crypto");
    const file = fileURLToPath(url);
    const text = await readFile(file, "utf8");
    // Each mutant runs every test file in its own process: the output is kept by the hash of the source,
    // so only the mutated file is transpiled again.
    const cached = ${JSON.stringify(CACHE)} + "/" + createHash("sha256").update(text).digest("hex") + ".js";
    try { return { format: "module", source: await readFile(cached, "utf8"), shortCircuit: true }; } catch {}
    const { default: ts } = await import(${JSON.stringify(TYPESCRIPT)});
    const { outputText } = ts.transpileModule(text, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, sourceMap: false },
    });
    await mkdir(${JSON.stringify(CACHE)}, { recursive: true });
    const tmp = cached + "." + process.pid + ".tmp";
    await writeFile(tmp, outputText);
    await rename(tmp, cached);
    return { format: "module", source: outputText, shortCircuit: true };
  }
`));
