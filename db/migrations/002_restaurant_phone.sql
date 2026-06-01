DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'phone'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN phone VARCHAR(30);
  END IF;
END $$;
