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

- Owner account management uses authenticated server functions that verify active status and the database admin role before loading the privileged client; never expose the account directory through browser-admin queries.
- Suspension uses Auth bans plus restrictive database/storage policies against live banned status, so existing tokens cannot retain data access.
- Account contact presentation uses libphonenumber-js to format explicit international numbers without guessing the country of national-only numbers.
- Referral attribution uses per-share opaque links and database claims restricted to new accounts; mobile-derived codes are hashed with the sender ID to avoid publishing mobile numbers.
- Caregiver invitation expiry is enforced in database triggers and acceptance functions; named-link reads expose only linked parties' display names.
- Family and referral sharing reuse browser-safe validation schemas and field errors before persistence; server validation remains enforced without exposing serialized errors.
- Dose push reminders run from a 5-minute managed schedule; push_sent dedupes each dose and expired device subscriptions are deleted on 404/410.
