# Build BloodConnect as five pages

## What will change

- Turn the current donor-search homepage into a focused **Home** page with network status, clear next actions, and member access.
- Add a dedicated **Find Donors** page using the existing secure donor search and privacy rules.
- Keep and refine **New Request** and **My Requests** as standalone pages.
- Add a **Profile** page where signed-in members can view and update their donor details, availability, location, phone, blood group, and last donation date.
- Update the shared navigation so all five pages are easy to reach on desktop and mobile.

## Technical details

- Keep the shared BloodConnect experience in `src/components/bloodconnect.tsx` so authentication and navigation remain consistent.
- Add `/donors` and `/profile` route files and update `/` to render the new Home page.
- Reuse the current Lovable Cloud tables and row-level privacy rules; no database migration is needed.
- Validate profile fields before saving, including required names/location, valid blood groups, coordinates, phone length, and donation date.
- Give every route unique title, description, Open Graph metadata, and Twitter card metadata.
- Verify all five pages at desktop and mobile sizes, including navigation and signed-out states.
