# Church Connect Hub

I want help creating an app that can double as a website, but also streamline the processes in our church. it needs to help manage:

1. The events - I want some to be able to submit a flyer and the event details for approval before an admin can approve it. Once the event is approved, a notification should fire out to all members on the app. The members should then be able to mark if they're coming or not. we should also be able to share these events publicly so non-members/visitors can mark if they'd like to come (Like a guest registrant - one who doesn't need to login)

2. Evangelism - when we go out and witness to the community, we track their details in Google Sheets. I'd like to be able to allow members to gather their details in the app: first and last name, phone number, address, and where we met, as well as open notes. We then want follow-up support. Whoever inserts that persons details they should get a reminder to call that person throughout the week. Reminders are auto-set for Mondays and Thursdays. Each person should get three touches before there are no more automatic reminders set. The person they found should also have a profile that can be opened where we assess if they visited, got baptized, got filled with the Holy Ghost, have a prayer request, mark if we shared the gospel with them yet and the notes we wrote about them should be listed here too. All their profile information should be editable by the person who added them, and an admin.

3. Giving should be linked to the paypal link: https://www.paypal.me/christchurchap

4. Here's a rough draft of what the site looks like: https://www.aboutchad.com/ccac/#welcome I like this and would hope the app could have a similar look and feel and a downloadable app link from the Apple Store and Android Play Store.

5. I want to have shared bible plans that I can share with a person of my choosing, where we connect on a specific topic, I have verses we read, and they can expound upon, and even quick quiz questions to run through, where they can be graded and assess their understanding of the content. As an example we should have a section around core doctrine: what we believe, repentance, baptism, the Holy Ghost, purpose, Patterns of Prayer, Fellowship & Separation

6. Leadership - There should be a section to discuss and share plans between Sr. and Secondary leadership—upcoming events, files, assessment reminders for accountability sake etc.

---

## Stack

TanStack Start (React 19) + Vite, Tailwind 4, shadcn/ui, and Supabase for auth,
data, and storage. Two Supabase edge functions: `program-ai` (Claude API — plan
drafting, quiz generation, short-answer grading) and `geocode-address` (Google
Geocoding for the evangelism map). The full KJV text ships as static JSON under
`public/bible/`, so passages render with no API call.

The project was originally built with Lovable; it is now developed locally and
no longer depends on any Lovable service.

## Development

Requires Node.js and npm.

```sh
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

The dev server runs on **port 8080**. Useful scripts: `npm run build`,
`npm run lint`, `npm run format`.

### Secrets

Client-side values go in `.env` (see `.env.example`) — `.env` is gitignored and
must stay that way; the Supabase publishable key is safe to ship in the bundle,
the Google Maps browser key must be restricted by HTTP referrer.

Server-side keys are Supabase function secrets, never in `.env`:

```sh
supabase secrets set ANTHROPIC_API_KEY=...      # program-ai
supabase secrets set GOOGLE_MAPS_SERVER_KEY=... # geocode-address
```

Both edge functions require a signed-in caller and are declared `verify_jwt`
in `supabase/config.toml`.
