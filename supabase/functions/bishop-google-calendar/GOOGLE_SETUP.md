# Google Calendar setup for the Bishop's engagement diary

Everything in this document is a **manual step in the Google Cloud Console** and
must be done by someone with access to the Google account that owns the Bishop's
calendar. None of it can be scripted from this repo, and none of the resulting
values belong in git — they go into Supabase secrets.

## Why a refresh token and not a service account

A service account is the usual answer for server-to-server Google access, but it
can only reach a *personal* calendar if that calendar is explicitly shared with
the service account's address, and it cannot create events that show the Bishop
as the organiser. Domain-wide delegation solves that properly but requires Google
Workspace.

So this uses an installed-app OAuth flow: a human consents once, and the
resulting refresh token is stored as a secret. Refresh tokens do not expire on
their own, but they **are** revoked if the account password changes, if the
consent is withdrawn, or if the app stays in "Testing" publishing status for more
than seven days. That last one is the usual cause of a working integration
breaking a week later — see step 3.

## 1. Create the OAuth client

1. Open <https://console.cloud.google.com/> and create a project (or pick one).
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name, support email, developer contact: the church's
   - Scopes: add `https://www.googleapis.com/auth/calendar.events` and
     `https://www.googleapis.com/auth/calendar.readonly`
   - Test users: add the Google account that owns the Bishop's calendar
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app** (this is what allows the loopback
     redirect used in step 2 — a "Web application" client would need a hosted
     redirect URI)
   - Note the **Client ID** and **Client secret**

## 2. Get a refresh token

Sign in as the account that owns the calendar. Replace `CLIENT_ID` below.

Open this URL in a browser:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/calendar.events%20https://www.googleapis.com/auth/calendar.readonly&access_type=offline&prompt=consent
```

`access_type=offline` and `prompt=consent` are both required — without them
Google returns an access token only, with no refresh token, and the integration
works for exactly one hour.

Approve the consent screen. The browser lands on a `http://localhost/?code=...`
page that fails to load; that is expected. Copy the `code` value out of the
address bar, then exchange it:

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d client_id=CLIENT_ID \
  -d client_secret=CLIENT_SECRET \
  -d code=PASTE_THE_CODE_HERE \
  -d grant_type=authorization_code \
  -d redirect_uri=http://localhost
```

The response contains `refresh_token`. That is the value you need. The `code` is
single-use — if the exchange fails, start again from the consent URL.

## 3. Publish the consent screen

**APIs & Services → OAuth consent screen → Publish app.**

While the app is in "Testing", refresh tokens expire after **7 days**. Publishing
stops that. An unverified published app shows an "unverified" warning on the
consent screen, which is fine here — only the church's own account ever sees it.

## 4. Find the calendar ID

In Google Calendar: **Settings → click the calendar → Integrate calendar →
Calendar ID**. A personal calendar's ID is the account's email address; a
secondary calendar's looks like `abc123@group.calendar.google.com`.

Using a **secondary calendar** dedicated to engagements is worth the two minutes:
the FreeBusy check in `bishop-availability` reports the whole calendar as busy,
so pointing it at a personal calendar means dentist appointments make dates look
unavailable to visiting churches.

## 5. Set the secrets

```bash
supabase secrets set \
  GOOGLE_CALENDAR_CLIENT_ID="..." \
  GOOGLE_CALENDAR_SECRET="..." \
  GOOGLE_CALENDAR_REFRESH_TOKEN="..." \
  GOOGLE_CALENDAR_ID="..." \
  RESEND_API_KEY="..." \
  BISHOP_BOOKING_FROM_EMAIL="bishop@ccacbmore.com" \
  SITE_URL="https://ccacbmore.com"
```

### What each one does

| Secret | Used by | Effect if unset |
| --- | --- | --- |
| `GOOGLE_CALENDAR_CLIENT_ID` | availability, accept | Availability returns `available: null`; accept succeeds but books nothing |
| `GOOGLE_CALENDAR_SECRET` | availability, accept | same |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | availability, accept | same |
| `GOOGLE_CALENDAR_ID` | availability, accept | Falls back to `primary` — usually wrong, see step 4 |
| `RESEND_API_KEY` | submit, accept | No email is sent; requests still record correctly |
| `BISHOP_BOOKING_FROM_EMAIL` | submit, accept | same |
| `SITE_URL` | submit | Desk links in notification emails fall back to `https://ccacbmore.com` |
| `RATE_LIMIT_SALT` | submit | Falls back to the service role key. Setting it explicitly is better — rotating the service key would otherwise reset every stored IP hash |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform; do not set them by hand.

## 6. Verify

```bash
curl -s "https://<project-ref>.supabase.co/functions/v1/bishop-availability?date=2026-09-15" \
  -H "apikey: <anon key>"
```

- `{"available":true}` — calendar reachable, date open
- `{"available":null,"reason":"calendar_unavailable"}` — credentials missing or wrong
- `{"available":false,"reason":"blocked_weekday"}` — working correctly, that date is a Sunday

## Rotating a broken token

If accept starts returning *"Google rejected the stored refresh token"*, the
token was revoked. Repeat steps 2 and 5 — nothing else needs to change, and no
data is lost.
