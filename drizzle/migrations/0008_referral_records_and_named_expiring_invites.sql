CREATE TABLE public.referral_senders (
 user_id uuid PRIMARY KEY, code text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_senders TO authenticated;
GRANT ALL ON public.referral_senders TO service_role;
ALTER TABLE public.referral_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sender code" ON public.referral_senders FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_account_active());
CREATE TABLE public.referral_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL, code text NOT NULL,
 token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
 recipient_name text NOT NULL DEFAULT '', method text NOT NULL CHECK (method IN ('whatsapp','sms','email','share','copy')),
 message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_shares TO authenticated;
GRANT ALL ON public.referral_shares TO service_role;
ALTER TABLE public.referral_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin referral shares" ON public.referral_shares FOR SELECT TO authenticated USING (public.is_account_active() AND (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE TABLE public.referral_acceptances (
 user_id uuid PRIMARY KEY, share_id uuid NOT NULL REFERENCES public.referral_shares(id), accepted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_acceptances TO authenticated;
GRANT ALL ON public.referral_acceptances TO service_role;
ALTER TABLE public.referral_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin referral acceptance" ON public.referral_acceptances FOR SELECT TO authenticated USING (public.is_account_active() AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')));
ALTER TABLE public.caregiver_links ADD COLUMN recipient_name text NOT NULL DEFAULT '';
ALTER TABLE public.caregiver_links ADD COLUMN share_method text;
ALTER TABLE public.caregiver_links ADD COLUMN invite_message text;
ALTER TABLE public.caregiver_links ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 days');
ALTER TABLE public.caregiver_links ADD COLUMN accepted_at timestamptz;
UPDATE public.caregiver_links SET expires_at = created_at + interval '15 days';
CREATE OR REPLACE FUNCTION public.create_referral_share(_phone text, _recipient text, _method text, _message text)
RETURNS public.referral_shares LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text; r public.referral_shares;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'Sign in with an active account.'; END IF;
 IF _method NOT IN ('whatsapp','sms','email','share','copy') OR length(_message) > 3000 OR length(_recipient) > 120 THEN RAISE EXCEPTION 'Invalid invitation details.'; END IF;
 SELECT code INTO c FROM public.referral_senders WHERE user_id = auth.uid();
 IF c IS NULL THEN
  IF _phone !~ '^\+[1-9][0-9]{6,14}$' THEN RAISE EXCEPTION 'Add your mobile number with its country code.'; END IF;
  c := 'SMM-' || upper(substr(encode(extensions.digest(_phone || ':' || auth.uid()::text, 'sha256'), 'hex'), 1, 16));
  INSERT INTO public.referral_senders(user_id, code) VALUES (auth.uid(), c) ON CONFLICT (user_id) DO NOTHING;
  SELECT code INTO c FROM public.referral_senders WHERE user_id = auth.uid();
 END IF;
 INSERT INTO public.referral_shares(sender_id, code, recipient_name, method, message) VALUES (auth.uid(), c, trim(_recipient), _method, _message) RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.create_referral_share(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_referral_share(text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.claim_referral(_token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referral_shares; joined timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'Sign in with an active account.'; END IF;
 SELECT * INTO r FROM public.referral_shares WHERE token = _token;
 IF NOT FOUND THEN RAISE EXCEPTION 'This referral link is invalid.'; END IF;
 IF r.sender_id = auth.uid() THEN RAISE EXCEPTION 'You cannot use your own referral.'; END IF;
 SELECT created_at INTO joined FROM auth.users WHERE id = auth.uid();
 IF joined < r.created_at THEN RETURN false; END IF;
 INSERT INTO public.referral_acceptances(user_id, share_id) VALUES (auth.uid(), r.id) ON CONFLICT (user_id) DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.accept_invite(_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.caregiver_links;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_account_active() THEN RAISE EXCEPTION 'Sign in with an active account.'; END IF;
 SELECT * INTO l FROM public.caregiver_links WHERE invite_token = _token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite'; END IF;
 IF l.patient_id = auth.uid() THEN RAISE EXCEPTION 'Cannot accept your own invite'; END IF;
 IF l.status = 'accepted' THEN
  IF l.caregiver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invite already used'; END IF;
  RETURN l.patient_id;
 END IF;
 IF now() >= l.expires_at THEN RAISE EXCEPTION 'This invite expired after 15 days. Please ask for a new invite.'; END IF;
 UPDATE public.caregiver_links SET caregiver_id = auth.uid(), status = 'accepted', accepted_at = now() WHERE id = l.id;
 RETURN l.patient_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.list_named_caregiver_links()
RETURNS TABLE(id uuid, patient_id uuid, caregiver_id uuid, status text, recipient_name text, share_method text, created_at timestamptz, expires_at timestamptz, caregiver_name text, patient_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT l.id, l.patient_id, l.caregiver_id, l.status, l.recipient_name, l.share_method, l.created_at, l.expires_at,
 coalesce(c.display_name, 'Caregiver'), coalesce(p.display_name, 'Family member')
 FROM public.caregiver_links l LEFT JOIN public.profiles c ON c.id = l.caregiver_id LEFT JOIN public.profiles p ON p.id = l.patient_id
 WHERE public.is_account_active() AND (l.patient_id = auth.uid() OR l.caregiver_id = auth.uid()) ORDER BY l.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_named_caregiver_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_named_caregiver_links() TO authenticated;
CREATE OR REPLACE FUNCTION public.enforce_caregiver_invite_expiry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN NEW.created_at := now(); NEW.expires_at := NEW.created_at + interval '15 days';
 ELSE NEW.created_at := OLD.created_at; NEW.expires_at := OLD.expires_at;
 END IF;
 IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') AND now() >= NEW.expires_at THEN RAISE EXCEPTION 'This invite expired after 15 days.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER caregiver_invite_expiry BEFORE INSERT OR UPDATE ON public.caregiver_links FOR EACH ROW EXECUTE FUNCTION public.enforce_caregiver_invite_expiry();