/**
 * Validate SQL against the real PostgreSQL grammar (libpg_query).
 *
 * SYNTAX ONLY. It cannot tell you that a referenced table exists, that a policy
 * filters the way it claims, or that a trigger fires. That needs a live
 * database — see supabase/tests/rls.test.sql and docs/STAGING.md §6.
 *
 *   npm run db:validate
 */
import { parse } from "pgsql-parser";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2] ?? "supabase/migrations";
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

let failed = 0;
for (const f of files) {
  const sql = await readFile(join(dir, f), "utf8");
  try {
    const stmts = await parse(sql);
    console.log(`PASS  ${f.padEnd(40)} ${Array.isArray(stmts) ? stmts.length : "?"} statements`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${f}`);
    console.error(`      ${e.message}`);
    if (e.cursorPosition) {
      const pos = Number(e.cursorPosition);
      const upto = sql.slice(0, pos);
      const line = upto.split("\n").length;
      console.error(`      at line ${line}: ${sql.slice(Math.max(0, pos - 90), pos + 90).replace(/\n/g, " ")}`);
    }
  }
}
console.log(failed ? `\n${failed} file(s) failed` : `\nAll ${files.length} migration files parse cleanly`);
process.exit(failed ? 1 : 0);
