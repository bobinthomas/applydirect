// Writes seed/seed.generated.sql: seed.sql with seed/profile.md inlined as the
// resume, so nobody has to paste markdown into a SQL string by hand.
import { readFileSync, writeFileSync } from "node:fs";

const profile = readFileSync("seed/profile.md", "utf8").replaceAll("'", "''");
const sql = readFileSync("seed/seed.sql", "utf8").replace("REPLACE_WITH_seed/profile.md", () => profile);
writeFileSync("seed/seed.generated.sql", sql);
console.log("wrote seed/seed.generated.sql");
