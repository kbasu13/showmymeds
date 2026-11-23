ALTER TABLE public.medicines ADD COLUMN status text NOT NULL DEFAULT 'active';
ALTER TABLE public.medicines ADD COLUMN paused_from date;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_status_check CHECK (status IN ('active','paused','discontinued'));