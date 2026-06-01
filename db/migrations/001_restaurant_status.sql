DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'status'
  ) THEN
    ALTER TABLE restaurants
      ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'blocked'));
  END IF;
END $$;
