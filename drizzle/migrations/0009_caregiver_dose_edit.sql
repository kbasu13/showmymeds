CREATE OR REPLACE FUNCTION public.take_dose(_medicine uuid, _date date, _time text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _owner uuid;
BEGIN
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT user_id INTO _owner FROM medicines WHERE id = _medicine;
  IF _owner IS NULL OR NOT (_owner = auth.uid() OR public.is_caregiver_of(_owner)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO dose_logs(user_id, medicine_id, scheduled_date, scheduled_time) VALUES (_owner, _medicine, _date, _time);
  UPDATE medicines SET stock = greatest(stock - dose_qty, 0) WHERE id = _medicine;
END $$;

CREATE OR REPLACE FUNCTION public.untake_dose(_medicine uuid, _date date, _time text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _owner uuid; _deleted boolean;
BEGIN
  IF NOT public.is_account_active() THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT user_id INTO _owner FROM medicines WHERE id = _medicine;
  IF _owner IS NULL OR NOT (_owner = auth.uid() OR public.is_caregiver_of(_owner)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM dose_logs WHERE user_id = _owner AND medicine_id = _medicine AND scheduled_date = _date AND scheduled_time = _time RETURNING true INTO _deleted;
  IF _deleted THEN UPDATE medicines SET stock = stock + dose_qty WHERE id = _medicine; END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.take_dose(uuid, date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.untake_dose(uuid, date, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.take_dose(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.untake_dose(uuid, date, text) TO authenticated;