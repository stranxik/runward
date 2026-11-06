// The tests' stand-in for tsx, for the laboratory's legs only (test/support/run-lab.js): a resolve hook
// that reads a relative `./x.js` specifier as `./x.ts` when only the TypeScript file exists, as tsc and tsx
// do. With Node.js's own type transform (`--experimental-transform-types`), the shipped example's tests
// then run with no dependency but zod, which the laboratory links from runward's own node_modules: the
// unit tests install nothing and reach no network. The real container runs use tsx from the lockfile.
import { register } from "node:module";

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
`));
