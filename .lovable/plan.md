# Evangelism Admin Master View

## What you'll get

A new **Admin** tab on the Evangelism page (only visible to admins/leaders) that becomes the executive control center for outreach, plus the ability for owners and admins to **delete contacts** from anywhere.

### Admin tab — three sub-views

1. **Map view** (default)
   - Interactive Google Map with clustered pins for every contact that has a known location
   - Each cluster shows a circle with the count of souls in that area
   - Click a cluster → zoom in; click a single pin → mini-card with name, date, status, "Open contact" link
   - Beneath the map: **"Top outreach locations"** panel — ranked list of `where_met` values (and city if available) by count, with a "Last 12 months" toggle and an "All time" toggle
   - Stat strip: Total contacts • Gospel shared • Baptized • Holy Ghost • Visited

2. **All contacts table**
   - Every contact across every user (admins/leaders only)
   - Columns: Name • Added by • Where met • Phone • Journey badges (Gospel/Baptized/HG/Visited) • Follow-ups (e.g. "2/3 done") • Added on
   - Sort by: Name A–Z, Most recent, Oldest
   - Filters: month/year added, `where_met` location, added-by user, journey status (gospel shared, baptized, etc.)
   - Search across name/phone/where-met
   - Row click → existing contact detail page
   - Per-row delete (with confirmation)

3. **Follow-up tracker**
   - Per-contact follow-up touch summary: how many of the 3 scheduled touches are complete, who's assigned, due dates, overdue flag
   - Filter to "Has overdue touches" and "Awaiting first touch"

### Delete contacts (everywhere)
- Owner of a contact, or any admin, can delete from:
  - The contact detail page (header action with confirm dialog)
  - The admin all-contacts table (row action with confirm dialog)
- Cascades follow-ups for that contact in the same operation
- RLS already permits this; no DB policy change needed

### Spreadsheet import (when you're ready)
- Once this ships, send me the spreadsheet and I'll add a one-time admin importer that maps columns → `evangelism_contacts` and geocodes addresses on insert

## Technical details

### Database migration
- Add `latitude numeric`, `longitude numeric`, `city text`, `region text`, `country text`, `geocoded_at timestamptz` to `evangelism_contacts`
- Add a `before insert/update` trigger that **clears** geocoding fields whenever `address` or `where_met` changes so the app re-geocodes
- Add `ON DELETE CASCADE` from `contact_follow_ups.contact_id` so deleting a contact removes its scheduled touches cleanly
- No new RLS policies required — admins/leaders already SELECT all contacts; owners and admins already DELETE

### Maps + geocoding
- Use the **Google Maps Platform** connector (I'll prompt you to connect it)
  - Browser key for the Maps JavaScript API (map rendering + marker clustering via `@googlemaps/markerclusterer`)
  - Geocoding API via the connector gateway, called from a `createServerFn` (`geocodeContact`) so the key stays server-side
- On contact create/update, the client fires `geocodeContact({ id })` which fills lat/lng/city from `address` (falls back to `where_met`)
- A second server fn `backfillGeocodes()` is wired to an admin button to geocode existing rows in batches

### Routing
- New route: `src/routes/dashboard.evangelism.admin.tsx` (admin/leader-gated; redirects members back to the index)
- Existing tabs (This Month / All Contacts) on `dashboard.evangelism.index.tsx` get a third tab **"Admin"** that links to the admin route (only shown to admins/leaders)

### Components
- `EvangelismMap.tsx` — wraps `google.maps.Map` + `MarkerClusterer`, lazy-loaded
- `TopLocationsPanel.tsx` — derives rankings client-side from the same dataset
- `AllContactsTable.tsx` — sortable/filterable table over `evangelism_contacts` joined with `profiles` (added_by name) and `contact_follow_ups` (touch counts)
- `DeleteContactDialog.tsx` — shared confirm dialog used by detail page + admin table

### Order of operations
1. Migration (lat/lng/city columns + cascade + trigger)
2. Connect Google Maps (prompt you)
3. `geocodeContact` + `backfillGeocodes` server fns
4. Admin route + three sub-views
5. Delete dialog wired into detail page + admin table
6. Hand back to you — then spreadsheet import as a follow-up

## Open questions

- **Map provider:** Google Maps is the default (best geocoding, free tier covers your volume). OK to use it? If you'd rather avoid Google entirely, Mapbox is the alternative — say the word.
- **Who counts as "admin master view" eligible:** admins only, or **admins + leaders** (matches the existing SELECT-all RLS policy)? I'll default to **admins + leaders** unless you say otherwise.
