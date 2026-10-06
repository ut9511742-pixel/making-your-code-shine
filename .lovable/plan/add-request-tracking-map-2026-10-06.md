# Add request tracking map

## Outcome
Add an interactive map to **My requests** so members can see outgoing requests and nearby requests they can respond to, alongside the existing list.

## Scope
- Show request locations and their notification-radius coverage on the existing outgoing/incoming tabs.
- Use the request coordinates already available; keep donor search results pseudonymous and do not add donor-specific pins or coordinates.
- Include map attribution and a clear no-location state; keep the existing request list and workflows intact.

## Technical approach
- Use Leaflet with OpenStreetMap tiles and add the small map dependencies.
- Load the map only in the browser to avoid server-rendering issues.
- Keep the tracking map in a focused component and reuse the project's semantic design tokens for surrounding UI.
