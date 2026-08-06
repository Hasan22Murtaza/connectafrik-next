/**
 * One-shot TradeHub schema migration runner.
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"
 *   node scripts/apply-tradehub-categories.mjs
 *
 * Or set DATABASE_URL / SUPABASE_DB_URL in the environment, then run the same command.
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.error(
      "Missing DATABASE_URL (or SUPABASE_DB_URL). Set it to your Supabase Postgres connection string, then re-run."
    );
    process.exit(1);
  }

  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error('Missing dependency "pg". Run: npm install pg');
    process.exit(1);
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260806120000_tradehub_categories_subcategory.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("TradeHub migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
