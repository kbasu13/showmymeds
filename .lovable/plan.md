# Free Premium access + discount codes

## What you will get

### 1. Give Premium for free (admin only)
- A new **Admin** page, visible only to you (your account gets the admin role).
- Search a user by email, then press **Give Premium**. Choose how long: 1 month, 1 year, or lifetime.
- The list shows everyone who has Premium, with an option to **Remove** it.
- No payment is needed. The user sees Premium unlocked the next time they open the app.

### 2. Discount codes (75%, 50%, 25%, 10%)
- On the Admin page, press **Create code** and pick 75%, 50%, 25% or 10%.
- The app makes a random code, e.g. `SMM-7K2QX9`, which you can copy and share.
- Optional settings per code: how many times it can be used (e.g. 1 or 100) and an expiry date.
- Each code works on all three plans (monthly ₹99, yearly ₹990, lifetime ₹4990).
- You can switch off a code anytime and see how many times it was used.

### 3. Using a code (customer side)
- The Premium page gets a **Have a discount code?** box.
- After a valid code is entered, the prices show crossed out with the new price, e.g. ₹99 → ₹50 (50% off).
- Invalid, expired or used-up codes show a clear message.
- The code is checked again on our side when paying, so nobody can fake a discount.

## Important note
The real payment step is not connected yet. Codes will show the discounted price and be stored with the purchase once payments are set up. Until then, free Premium (part 1) works right away.

## Technical details
- Grant admin role to the requester's account in `user_roles`.
- New table `discount_codes` (code unique, percent check in 75/50/25/10, max_uses, used_count, expires_at, active), with GRANTs + RLS: admins manage; no direct reads for users.
- Security-definer RPC `check_discount(code)` returns percent only if valid; `redeem_discount` increments usage at payment time.
- Admin server functions (requireSupabaseAuth + has_role check) to look up a user by email and upsert/delete `premium_users` with `expires_at`.
- New route `_authenticated/admin.tsx`, link in profile menu only for admins; code input added to the Premium page; price math in `src/lib/plans.ts` with tests.
