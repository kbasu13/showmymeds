UPDATE public.premium_users pu SET source = 'self_activated'
WHERE pu.source = 'admin_grant'
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = pu.user_id)
  AND (pu.expires_at = pu.granted_at + interval '1 month' OR pu.expires_at = pu.granted_at + interval '1 year'
       OR EXISTS (SELECT 1 FROM public.discount_redemptions r WHERE r.user_id = pu.user_id));

CREATE OR REPLACE FUNCTION public.admin_review_payment(_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.payments; cur timestamptz; base timestamptz; exp timestamptz; cid uuid; rid uuid;
begin
  if not public.is_account_active() or not public.has_role(auth.uid(), 'admin') then raise exception 'Only the app owner can do this.'; end if;
  select * into p from payments where id = _id for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status <> 'pending' then raise exception 'This payment was already reviewed.'; end if;
  if not _approve then
    update payments set status = 'rejected', admin_note = nullif(trim(coalesce(_note,'')), ''), reviewed_at = now() where id = _id;
    if p.discount_code is not null then
      select id into cid from discount_codes where code = p.discount_code for update;
      if cid is not null then
        select id into rid from discount_redemptions where code_id = cid and user_id = p.user_id order by redeemed_at desc limit 1;
        if rid is not null then
          delete from discount_redemptions where id = rid;
          update discount_codes set used_count = greatest(used_count - 1, 0) where id = cid;
        end if;
      end if;
    end if;
    return;
  end if;
  select expires_at into cur from premium_users where user_id = p.user_id;
  base := greatest(coalesce(cur, now()), now());
  exp := case p.plan when 'monthly' then base + interval '1 month' when 'yearly' then base + interval '1 year' else null end;
  insert into premium_users(user_id, expires_at, source) values (p.user_id, exp, 'payment')
    on conflict (user_id) do update set expires_at = excluded.expires_at, granted_at = now(), source = 'payment';
  update payments set status = 'approved', reviewed_at = now(), premium_until = exp,
    admin_note = nullif(trim(coalesce(_note,'')), ''),
    invoice_no = 'SMM/' || to_char(now(), 'YYYYMM') || '/' || lpad(nextval('public.invoice_seq')::text, 4, '0')
    where id = _id;
end $$;