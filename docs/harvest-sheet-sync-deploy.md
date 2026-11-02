# Deploying retroactive Evangelism → HARVEST LIST synchronization

The CCAC site remains the source of truth. The Google Sheet is a mirrored copy. **Do not deploy only the GitHub Pages site**: three pieces need coordinated publication.

## Before deployment

1. Make a backup copy of the existing **HARVEST LIST 2026** Google Sheet.
2. Verify the currently deployed Apps Script secret is saved privately. Never put the secret or Apps Script deployment URL in GitHub.
3. Confirm the existing Google Sheet web app still has the same deployment URL and the Supabase project already has `HARVEST_SHEET_WEBHOOK` and `HARVEST_SHEET_SECRET`.

## Step 1 — Publish the Google Apps Script FIRST

1. Open HARVEST LIST 2026 > **Extensions > Apps Script**.
2. Replace the existing script with the full contents of [harvest-sheet-sync.gs](./harvest-sheet-sync.gs).
3. **Keep the existing real `SHARED_SECRET` value**, replacing the `CHANGE_ME_TO_A_LONG_RANDOM_STRING` placeholder in the repository copy. Do not change the secret to the placeholder.
4. Save. Select **Deploy > Manage deployments > Edit** on the existing web app and choose **New version > Deploy**. Preserve the existing deployment URL.
5. Retain **Execute as: Me** and the existing intended web-app access setting. A strong shared secret is still required.
6. Smoke-test the legacy append action before deploying the new edge function. The new script remains compatible with old append payloads.

The new script adds a hidden `CCAC Contact ID` column when a contact is first synced or corrected. It does not overwrite the Notes or Gender columns.

## Step 2 — Publish the existing Supabase Edge Function

The CCAC Supabase project reference in `supabase/config.toml` is `epjkfkvisvcgytjjuqaq`.

From a checkout of the updated repository:

```bash
supabase login
supabase functions deploy harvest-sheet-append --project-ref epjkfkvisvcgytjjuqaq
```

Deploy only this function, not every function. No new Supabase secrets are required if the existing webhook integration is operating. Its JWT verification remains enabled.

The function now supports authenticated update requests; it fetches the authoritative replacement fields from the caller's RLS-protected database view.

## Step 3 — Release the website

After steps 1 and 2, merge the reviewed feature PR into `main`. The existing GitHub Pages workflow automatically rebuilds and publishes ccacbmore.com when `main` is pushed.

## Acceptance tests

1. Create a test contact on the website; verify one row is added to the correct month tab.
2. Edit that person's location and save. Verify **the same row** updates, without a new row.
3. Change the outreach date within the same month, then into a different month. Verify the row moves, carries its notes and other sheet fields, and is cleared from the original month.
4. Test an existing 2026 contact such as Tommy. His original record is on September 2026 row 13, with Dumbarton Ave Evangelism recorded. On first edit, the script links a legacy row by a unique name + original outreach date + phone or location (or, where the date was corrected earlier, a unique name + phone). If multiple matches exist, the system refuses to guess and displays an error.
5. Verify the new hidden contact ID is present, and make a second edit to test future ID-based matching.
6. Verify edits to a different contact never alter Tommy's record.

**Operational limitation:** The website sends the sheet update after saving the Supabase contact. If the Google webhook is unavailable, the site save succeeds but the sheet sync reports an error. This is near-real-time best-effort delivery, **not** a durable queued retry system.

## Rollback

- In Apps Script, switch the existing deployment back to its prior version.
- Redeploy the prior Edge Function code using the Supabase CLI.
- Revert the website PR in GitHub if necessary.
- Use the Google Sheet backup for any manual row-level recovery; avoid restoring wholesale if legitimate new outreach was recorded after the backup.
