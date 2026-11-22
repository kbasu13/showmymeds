ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS repeat_every smallint NOT NULL DEFAULT 1 CHECK (repeat_every BETWEEN 1 AND 30);
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS week_days smallint[];
CREATE TABLE public.ask_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  credits numeric(12,5) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ask_usage TO authenticated;
GRANT ALL ON public.ask_usage TO service_role;
ALTER TABLE public.ask_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ask usage" ON public.ask_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin ask usage" ON public.ask_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ask_usage_user_month ON public.ask_usage (user_id, created_at);