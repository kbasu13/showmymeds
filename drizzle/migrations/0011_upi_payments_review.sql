CREATE SEQUENCE IF NOT EXISTS public.invoice_seq;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  txn_no text NOT NULL UNIQUE DEFAULT ('SMM-' || upper(encode(extensions.gen_random_bytes(5), 'hex'))),
  plan text NOT NULL,
  discount_code text,
  discount_percent integer NOT NULL DEFAULT 0,
  base_amount numeric(10,2) NOT NULL,
  gst_percent integer NOT NULL DEFAULT 18,
  gst_amount numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  utr text NOT NULL,
  bill_name text,
  user_gstin text,
  status text NOT NULL DEFAULT 'pending',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  invoice_no text UNIQUE,
  premium_until timestamptz,
  admin_note text,
  support_note text,
  support_shared_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active accounts only" ON public.payments AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_active()) WITH CHECK (public.is_account_active());
CREATE POLICY "own or admin payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX payments_utr_live ON public.payments (upper(utr)) WHERE status <> 'rejected';

-- Users can no longer switch Premium on themselves.
REVOKE EXECUTE ON FUNCTION public.activate_premium_paid(text,text) FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION public.submit_payment(_plan text, _code text, _utr text, _bill_name text, _gstin text)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare price numeric; pct int := 0; base numeric; gst numeric; r public.payments; u text := upper(regexp_replace(coalesce(_utr,''), '\s', '', 'g'));
  g text := nullif(upper(trim(coalesce(_gstin,''))), '');
begin
  if auth.uid() is null then raise exception 'Please sign in again.'; end if;
  if not public.is_account_active() then raise exception 'Account access is suspended.'; end if;
  price := case _plan when 'monthly' then 99 when 'yearly' then 990 when 'lifetime' then 4990 else null end;
  if price is null then raise exception 'Unknown plan'; end if;
  if u !~ '^[A-Z0-9]{8,30}$' then raise exception 'Enter the UPI transaction ID (UTR) shown in your UPI app.'; end if;
  if g is not null and g !~ '^[0-9]{2}[A-Z0-9]{13}$' then raise exception 'GSTIN should be 15 characters, like 19ABCDE1234F1Z5.'; end if;
  if exists (select 1 from payments where upper(utr) = u and status <> 'rejected') then raise exception 'This transaction ID was already submitted.'; end if;
  if exists (select 1 from payments where user_id = auth.uid() and status = 'pending') then raise exception 'You already have a payment waiting for approval.'; end if;
  if _code is not null and length(trim(_code)) > 0 then pct := public.redeem_discount(_code, _plan); end if;
  base := round(price * (100 - pct) / 100.0);
  gst := round(base * 18 / 100.0, 2);
  insert into payments(user_id, plan, discount_code, discount_percent, base_amount, gst_amount, total, utr, bill_name, user_gstin)
    values (auth.uid(), _plan, nullif(upper(trim(coalesce(_code,''))), ''), pct, base, gst, base + gst, u, nullif(trim(coalesce(_bill_name,'')), ''), g)
    returning * into r;
  return r;
end $$;
REVOKE EXECUTE ON FUNCTION public.submit_payment(text,text,text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_payment(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.share_payment_with_admin(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_account_active() then raise exception 'Account access is suspended.'; end if;
  if length(trim(coalesce(_note,''))) = 0 then raise exception 'Please describe the problem.'; end if;
  update payments set support_note = left(trim(_note), 1000), support_shared_at = now() where id = _id and user_id = auth.uid();
  if not found then raise exception 'Payment not found'; end if;
end $$;
REVOKE EXECUTE ON FUNCTION public.share_payment_with_admin(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.share_payment_with_admin(uuid,text) TO authenticated;

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
  insert into premium_users(user_id, expires_at) values (p.user_id, exp)
    on conflict (user_id) do update set expires_at = excluded.expires_at, granted_at = now();
  update payments set status = 'approved', reviewed_at = now(), premium_until = exp,
    admin_note = nullif(trim(coalesce(_note,'')), ''),
    invoice_no = 'SMM/' || to_char(now(), 'YYYYMM') || '/' || lpad(nextval('public.invoice_seq')::text, 4, '0')
    where id = _id;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_review_payment(uuid,boolean,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_payments()
RETURNS TABLE(id uuid, user_id uuid, email text, txn_no text, plan text, total numeric, utr text, status text, created_at timestamptz, support_note text, support_shared_at timestamptz, invoice_no text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_account_active() or not public.has_role(auth.uid(), 'admin') then raise exception 'Only the app owner can do this.'; end if;
  return query select p.id, p.user_id, u.email::text, p.txn_no, p.plan, p.total, p.utr, p.status, p.created_at, p.support_note, p.support_shared_at, p.invoice_no
    from payments p left join auth.users u on u.id = p.user_id order by (p.status = 'pending') desc, p.support_shared_at desc nulls last, p.created_at desc limit 200;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_payments() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_payments() TO authenticated;