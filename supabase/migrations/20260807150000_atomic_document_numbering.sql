-- Fixes a race condition in invoice numbering: the app used to read
-- settings.numbering's prefix/next number, insert the invoice, then write
-- next+1 back in a separate round trip. Two staff saving at the same
-- moment could read the same "next" value and both try to insert the same
-- number, with the second failing on the invoices.number unique
-- constraint. This function does the read-and-increment as a single
-- locked, atomic step so concurrent callers are serialized instead of
-- racing.
CREATE OR REPLACE FUNCTION public.next_document_number(p_prefix_key TEXT, p_next_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next TEXT;
BEGIN
  SELECT setting_value ->> p_prefix_key, setting_value ->> p_next_key
    INTO v_prefix, v_next
  FROM public.app_settings
  WHERE setting_key = 'settings.numbering'
  FOR UPDATE;

  IF v_next IS NULL OR v_prefix IS NULL THEN
    RETURN NULL; -- no custom numbering configured; caller falls back to the DB default
  END IF;

  UPDATE public.app_settings
  SET setting_value = jsonb_set(setting_value, ARRAY[p_next_key], to_jsonb((v_next::NUMERIC + 1)::TEXT))
  WHERE setting_key = 'settings.numbering';

  RETURN v_prefix || v_next;
END;
$$;

-- No SECURITY DEFINER: runs as the calling user, so the existing
-- "Staff can update app settings" RLS policy on app_settings still applies.
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT, TEXT) TO authenticated;
