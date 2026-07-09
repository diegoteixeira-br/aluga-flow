DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owners can upload signed contracts') THEN
    CREATE POLICY "Owners can upload signed contracts" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'signed-contracts' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owners can update signed contracts') THEN
    CREATE POLICY "Owners can update signed contracts" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'signed-contracts' AND (storage.foldername(name))[1] = (auth.uid())::text)
      WITH CHECK (bucket_id = 'signed-contracts' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
END $$;