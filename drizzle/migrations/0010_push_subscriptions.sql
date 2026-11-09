CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  tz text NOT NULL DEFAULT 'Asia/Kolkata',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs select" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own subs update" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.push_sent (
  medicine_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (medicine_id, scheduled_date, scheduled_time)
);
GRANT ALL ON public.push_sent TO service_role;
ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;