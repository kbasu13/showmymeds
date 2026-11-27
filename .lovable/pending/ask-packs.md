Ask reply packs (ask50 ₹49, ask100 ₹89) — DB step not applied because Cloud was paused (out of Cloud credits).
To do: migration adding ask_topups(user_id, payment_id, replies, used) + consume_ask_topup(uuid) (service_role) ; submit_payment accepts ask50/ask100 (Premium only, no codes); admin_review_payment inserts ask_topups for pack plans instead of extending Premium.
Then: api/ask.ts consumes a pack reply when monthly count >= limit; ask.tsx shows pack replies left + "Buy more" link; premium.tsx pack cards.
Done so far: ASK_PACKS/isAskPack/planLabel in src/lib/plans.ts, askAllowanceState(used, packLeft) in src/lib/ask-usage.ts.
