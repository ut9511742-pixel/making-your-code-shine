# Donor profile and location approval

## What will change
- Make each available donor card open a shareable donor profile showing only safe details: blood group, availability, approximate area, distance, and eligibility.
- Let requesters select one of their own open blood requests and send that donor a separate location-sharing request.
- Add a Location Requests view for donors with requester and blood-need details, plus Approve and Reject actions.
- Show a donor's precise location on a map only to the requester, and only after that donor approves.
- Clearly mark imported demo records as unable to approve; never reveal their exact coordinates or contact details.

## Technical details
- Add an RLS-protected location-request table and authenticated database functions for donor search identifiers, safe profile details, request creation, donor decisions, inbox reads, and requester-only approved-location reads. Derive the acting user from `auth.uid()` and validate ownership in every write/read function.
- Add a `/donors/$donorId` route and extend the existing request desk with the donor approval inbox; keep current routes and pseudonymous search behavior intact.
- Load the approved-location map only in the browser and fetch exact coordinates only after authorization succeeds.
- Verify build, signed-in request/approval/rejection/approved-map behavior, and that rejected or pending requests cannot access location.
