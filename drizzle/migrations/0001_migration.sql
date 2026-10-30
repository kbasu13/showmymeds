create policy "own files all" on storage.objects for all to authenticated
  using (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "caregiver read files" on storage.objects for select to authenticated
  using (bucket_id = 'prescriptions' and public.is_caregiver_of(((storage.foldername(name))[1])::uuid));