ALTER TABLE public.medicines
  ADD CONSTRAINT medicines_stock_non_negative CHECK (stock >= 0);