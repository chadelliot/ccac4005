#!/usr/bin/env node
/**
 * Copy application data from the old Lovable Supabase project into the new one.
 *
 *   node scripts/migrate-supabase-data.mjs --dry-run
 *   node scripts/migrate-supabase-data.mjs
 *
 * Reads four values from the environment. Set them in your shell for the run —
 * do not put the service role keys in .env, and do not paste them into chat.
 * A service role key bypasses RLS entirely; it is the master key to the data.
 *
 *   OLD_SUPABASE_URL              https://<old-ref>.supabase.co
 *   OLD_SERVICE_ROLE_KEY          from the OLD project: Settings -> API
 *   NEW_SUPABASE_URL              https://<new-ref>.supabase.co
 *   NEW_SERVICE_ROLE_KEY          from the NEW project: Settings -> API
 *
 * WHAT THIS DOES NOT DO
 *
 * It does not copy auth.users. Password hashes are not exposed over the REST
 * API at any privilege level, so accounts cannot be moved this way — members
 * would sign up again or use a password reset. Preserving logins requires a
 * database-level dump and restore (pg_dump/psql) with both projects' database
 * passwords. See the note at the bottom of this file.
 *
 * It also does not copy Storage objects (the `event-flyers` bucket). Those are
 * files, not rows; see the note below.
 */

const DRY = process.argv.includes("--dry-run");

const OLD_URL = need("OLD_SUPABASE_URL");
const OLD_KEY = need("OLD_SERVICE_ROLE_KEY");
const NEW_URL = need("NEW_SUPABASE_URL");
const NEW_KEY = need("NEW_SERVICE_ROLE_KEY");

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See the header of this file.`);
    process.exit(1);
  }
  return v.replace(/\/$/, "");
}

/**
 * Order matters: a child row cannot be inserted before the row it references.
 * This is a topological ordering of the foreign keys, parents first.
 */
const TABLES = [
  // No dependencies beyond auth.users, which must already exist.
  "profiles",
  "user_roles",
  "groups",
  "reading_programs",
  "quizzes",
  "events",
  "evangelism_contacts",
  "notifications",
  "certificates",
  // Children.
  "group_members",
  "group_messages",
  "event_rsvps",
  "event_guest_rsvps",
  "witnesses",
  "contact_follow_ups",
  "reading_program_days",
  "reading_program_progress",
  "program_lessons",
  "program_enrollments",
  "lesson_progress",
  "quiz_questions",
  "quiz_attempts",
];

const PAGE = 500;

async function rest(base, key, path, init = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function readAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await rest(OLD_URL, OLD_KEY, `${table}?select=*`, {
      headers: { Range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) {
      const body = await res.text();
      // 404 means the table does not exist on the old side — fine, skip it.
      if (res.status === 404) return null;
      throw new Error(`read ${table}: ${res.status} ${body.slice(0, 200)}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function writeAll(table, rows) {
  let written = 0;
  for (let i = 0; i < rows.length; i += PAGE) {
    const chunk = rows.slice(i, i + PAGE);
    const res = await rest(NEW_URL, NEW_KEY, table, {
      method: "POST",
      // Re-running the script must not duplicate rows or fail on rows that
      // already made it across in an earlier partial run.
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`write ${table}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    written += chunk.length;
  }
  return written;
}

const summary = [];
let failed = false;

for (const table of TABLES) {
  process.stdout.write(`  ${table.padEnd(26)}`);
  try {
    const rows = await readAll(table);
    if (rows === null) {
      console.log("skipped (not on the old project)");
      summary.push([table, "-", "skipped"]);
      continue;
    }
    if (rows.length === 0) {
      console.log("0 rows");
      summary.push([table, 0, "empty"]);
      continue;
    }
    if (DRY) {
      console.log(`${rows.length} rows (dry run — nothing written)`);
      summary.push([table, rows.length, "would copy"]);
      continue;
    }
    const n = await writeAll(table, rows);
    console.log(`${n} rows copied`);
    summary.push([table, n, "copied"]);
  } catch (err) {
    failed = true;
    console.log(`FAILED — ${err.message}`);
    summary.push([table, "-", `failed: ${err.message.slice(0, 80)}`]);
  }
}

console.log("\n  " + "-".repeat(60));
const total = summary.reduce((a, [, n]) => a + (typeof n === "number" ? n : 0), 0);
console.log(`  ${total} rows ${DRY ? "would be copied" : "copied"} across ${summary.length} tables`);
if (failed) {
  console.log("  Some tables failed. The script is idempotent — fix the cause and re-run.");
  process.exit(1);
}

/*
 * THE TWO THINGS THIS CANNOT MOVE
 *
 * 1. Accounts (auth.users)
 *    profiles.id and user_roles.user_id are foreign keys onto auth.users, so
 *    those two tables will fail until the accounts exist on the new project.
 *    Options, in increasing order of effort:
 *      a. Members sign up again. Simplest; they lose nothing but their password.
 *      b. Invite them: supabase.auth.admin.inviteUserByEmail per address.
 *      c. Preserve logins properly with a database-level move:
 *           pg_dump --data-only --schema auth   <old connection string> > auth.sql
 *           psql <new connection string> < auth.sql
 *         This needs the database password for both projects (Settings ->
 *         Database) and a local psql, which is not installed on this machine.
 *
 * 2. Storage objects (the `event-flyers` bucket)
 *    events.flyer_url points at the old project's storage. After this script
 *    runs, those URLs still reference the old host. To move them: create the
 *    bucket on the new project, download each object from the old one, upload
 *    it, and rewrite events.flyer_url. Worth doing only if there are flyers
 *    worth keeping — the new project currently has no buckets at all.
 */
