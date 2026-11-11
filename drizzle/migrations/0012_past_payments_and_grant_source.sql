ALTER TABLE public.premium_users ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin_grant';
UPDATE public.premium_users pu SET source = 'payment' WHERE EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = pu.user_id AND p.status = 'approved');
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS recorded_by_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_review_payment(_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.payments; cur timestamptz; base timestamptz; exp timestamptz;
begin
  if not public.is_account_active() or not public.has_role(auth.uid(), 'admin') then raise exception 'Only the app owner can do this.'; end if;
  select * into p from payments where id = _id for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status <> 'pending' then raise exception 'This payment was already reviewed.'; end if;
  if not _approve then
    update payments set status = 'rejected', admin_note = nullif(trim(coalesce(_note,'')), ''), reviewed_at = now() where id = _id;
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

CREATE OR REPLACE FUNCTION public.admin_grant_premium(_email text, _expires timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid;
begin
  if not public.is_account_active() or not public.has_role(auth.uid(),'admin') then raise exception 'admins only'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(_email));
  if uid is null then raise exception 'No user with that email.'; end if;
  insert into premium_users(user_id, expires_at, source) values (uid, _expires, 'admin_grant')
    on conflict (user_id) do update set expires_at = excluded.expires_at, granted_at = now(), source = 'admin_grant';
end $$;

DROP FUNCTION IF EXISTS public.admin_list_premium();
CREATE FUNCTION public.admin_list_premium()
RETURNS TABLE(user_id uuid, email text, display_name text, granted_at timestamptz, expires_at timestamptz, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_account_active() or not public.has_role(auth.uid(),'admin') then raise exception 'admins only'; end if;
  return query select p.user_id, u.email::text, pr.display_name, p.granted_at, p.expires_at, p.source
    from premium_users p join auth.users u on u.id = p.user_id left join profiles pr on pr.id = p.user_id
    order by p.granted_at desc;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_premium() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_premium() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_past_payment(_email text, _plan text, _utr text, _paid_on date, _discount integer, _bill_name text, _gstin text)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid; price numeric; pct int := coalesce(_discount, 0); base numeric; gst numeric; r public.payments;
  u text := upper(regexp_replace(coalesce(_utr,''), '\s', '', 'g')); g text := nullif(upper(trim(coalesce(_gstin,''))), '');
  paid timestamptz := coalesce(_paid_on::timestamptz, now()); cur timestamptz; startd timestamptz; exp timestamptz;
begin
  if not public.is_account_active() or not public.has_role(auth.uid(), 'admin') then raise exception 'Only the app owner can do this.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(coalesce(_email,'')));
  if uid is null then raise exception 'No user with that email.'; end if;
  price := case _plan when 'monthly' then 99 when 'yearly' then 990 when 'lifetime' then 4990 else null end;
  if price is null then raise exception 'Unknown plan'; end if;
  if pct not in (0,10,25,50,75) then raise exception 'Discount must be 0, 10, 25, 50 or 75%%.'; end if;
  if u !~ '^[A-Z0-9]{8,30}$' then raise exception 'Enter the UPI transaction ID (UTR), 8–30 letters or digits.'; end if;
  if g is not null and g !~ '^[0-9]{2}[A-Z0-9]{13}$' then raise exception 'GSTIN should be 15 characters.'; end if;
  if paid > now() + interval '1 day' then raise exception 'Payment date cannot be in the future.'; end if;
  if exists (select 1 from payments where upper(utr) = u and status <> 'rejected') then raise exception 'This transaction ID is already recorded.'; end if;
  base := round(price * (100 - pct) / 100.0);
  gst := round(base * 18 / 100.0, 2);
  select expires_at into cur from premium_users where user_id = uid;
  startd := greatest(coalesce(cur, paid), paid);
  if exists (select 1 from premium_users where user_id = uid and expires_at is null) then exp := null;
  else exp := case _plan when 'monthly' then startd + interval '1 month' when 'yearly' then startd + interval '1 year' else null end; end if;
  if exp is null or exp > now() then
    insert into premium_users(user_id, expires_at, source) values (uid, exp, 'payment')
      on conflict (user_id) do update set expires_at = excluded.expires_at, granted_at = now(), source = 'payment';
  end if;
  insert into payments(user_id, plan, discount_percent, base_amount, gst_amount, total, utr, bill_name, user_gstin, status,
      terms_accepted_at, created_at, reviewed_at, premium_until, admin_note, recorded_by_admin, invoice_no)
    values (uid, _plan, pct, base, gst, base + gst, u, nullif(trim(coalesce(_bill_name,'')), ''), g, 'approved',
      paid, paid, now(), exp, 'Past payment recorded by admin', true,
      'SMM/' || to_char(now(), 'YYYYMM') || '/' || lpad(nextval('public.invoice_seq')::text, 4, '0'))
    returning * into r;
  return r;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_record_past_payment(text,text,text,date,integer,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_record_past_payment(text,text,text,date,integer,text,text) TO authenticated;