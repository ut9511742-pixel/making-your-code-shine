<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- BloodConnect uses one shared `src/components/bloodconnect.tsx` experience across its five public routes so auth and navigation remain consistent.
- Imported donor records stay in the private `bloodconnect_private` schema and reach clients only through the pseudonymous search function, preventing raw identity and phone exposure.
- Interactive maps load only in the browser and show request locations and coverage, never individual donor pins, to avoid server-render breakage and protect donors.
- Donor location sharing requires explicit donor approval; expose exact profile coordinates only through an authenticated, requester-scoped approval check.
