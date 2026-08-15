# Christ Cathedral Apostolic Church

**A thriving ministry in the heart of Baltimore, where lives are transformed by the power of Jesus Christ.**

Welcome. This repository holds the website and member app for Christ Cathedral
Apostolic Church — *The Life Center* — at 4005 Old York Road, Baltimore,
Maryland. Sunday worship begins at **2:27 PM**, and everyone is welcome.

🌐 **[ccacbmore.com](https://ccacbmore.com)** · 📺 [Watch live](https://ccacbmore.com/live) · 📍 [Plan a visit](https://ccacbmore.com/plan-visit) · ❤️ [Give](https://www.paypal.me/christchurchap)

Find us on [Facebook](https://facebook.com/CCACMD) and
[Instagram](https://instagram.com/ccacbaltimore).

---

## About this project

One codebase serves two audiences.

**For visitors and the wider community**, it is a public website: who we are,
what we believe, when we gather, how to find us, our leadership, and our
services streamed live. Anyone can RSVP to a public event without making an
account, and churches can invite Bishop Dr. Justin O. Marcus to speak through a
booking form that checks his calendar before anyone picks up the phone.

**For our members**, it is a portal that carries the work of the ministry:

- **Events** — members submit an event with its flyer and details, an
  administrator approves it, and the whole congregation is notified. Members
  and guests alike can say whether they are coming. Events posted to our
  Facebook page appear here automatically.
- **Evangelism** — the details of people we meet while witnessing, held
  carefully and privately, with optional follow-up reminders so nobody is
  forgotten after the first conversation.
- **Bible study plans** — shared reading plans on the doctrine we hold, with
  passages, discussion and short quizzes to help understanding settle.
- **Leadership** — a place for senior and secondary leadership to plan
  together, share files and keep one another accountable.
- **The Bishop's Desk** — where invitations to the Bishop are reviewed,
  scheduled and answered.

The site is also packaged with Capacitor so it can ship as a downloadable app
on Android and iOS from the same code.

### A note on privacy

Some of what this app records is genuinely sensitive — the names, phone numbers
and addresses of people our members have met and prayed with, who are usually
not users of this site at all. **The code here is public; the data is not.**
Every table carrying personal information is protected by row-level security in
the database itself, not merely hidden in the interface, and outreach records
are restricted to church leadership. Our
[privacy policy](https://ccacbmore.com/privacy-policy) describes exactly what
is collected and who can see it.

---

## For developers

Built with [TanStack Start](https://tanstack.com/start) (React 19) and Vite,
[Tailwind CSS 4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com),
and [Supabase](https://supabase.com) for authentication, data and storage.

The complete KJV text ships as static JSON under `public/bible/`, so passages
render without an API call. The public site is prerendered and deployed to
GitHub Pages by the workflow in `.github/workflows/deploy.yml`.

### Edge functions

| Function | Purpose |
| --- | --- |
| `program-ai` | Claude API — plan drafting, quiz generation, short-answer grading |
| `geocode-address` | Google Geocoding for the evangelism map |
| `facebook-live-status` | Whether a service is streaming, and the latest replay |
| `facebook-recent-posts` | Recent Page posts for the homepage |
| `facebook-events` | Upcoming Page events, merged into the events page |
| `instagram-recent-posts` | Recent Instagram posts for the homepage row |
| `bishop-availability` | Public availability check against the Bishop's calendar |
| `bishop-booking-submit` | Public invitation submissions |
| `bishop-booking-accept` | Desk-only accept, writing to Google Calendar |

`program-ai`, `geocode-address` and `bishop-booking-accept` require a signed-in
caller and are declared `verify_jwt` in `supabase/config.toml`. The rest are
public and read-only; none of them return anything that is not already public
on the church's own social pages.

### Running locally

Requires Node.js and npm.

```sh
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

The dev server runs on **port 8080**. Other scripts: `npm run build`,
`npm run build:mobile` (the static site target used by CI), `npm run lint`,
`npm run format`.

### Secrets

Client-side values live in `.env`, which is gitignored and must stay that way.
The Supabase publishable key is safe to ship in the bundle — it is protected by
row-level security — but the Google Maps browser key is billable and must be
restricted by HTTP referrer.

Server-side keys are Supabase function secrets and never appear in `.env`:

```sh
supabase secrets set ANTHROPIC_API_KEY=...            # program-ai
supabase secrets set GOOGLE_MAPS_SERVER_KEY=...       # geocode-address
supabase secrets set FACEBOOK_PAGE_ACCESS_TOKEN=...   # the Facebook and Instagram functions
supabase secrets set GOOGLE_CALENDAR_CLIENT_ID=...    # the Bishop's calendar
supabase secrets set GOOGLE_CALENDAR_SECRET=...
supabase secrets set GOOGLE_CALENDAR_REFRESH_TOKEN=...
supabase secrets set GOOGLE_CALENDAR_ID=...
supabase secrets set RESEND_API_KEY=...               # transactional email
supabase secrets set BISHOP_BOOKING_FROM_EMAIL=...
supabase secrets set SITE_URL=https://ccacbmore.com
supabase secrets set RATE_LIMIT_SALT=...              # salts stored IP hashes
```

See `supabase/functions/bishop-google-calendar/GOOGLE_SETUP.md` for the Google
Cloud steps behind the calendar integration.

---

*"Whether you are new to church, returning to your faith, or looking for a place
to grow deeper in God, Christ Cathedral is a place where you can belong, be
loved, and be transformed."*
