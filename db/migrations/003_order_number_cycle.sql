DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_order_number_key;
  END IF;
END $$;

ALTER TABLE orders ALTER COLUMN order_number DROP DEFAULT;

DROP SEQUENCE IF EXISTS orders_order_number_seq;

ALTER TABLE orders
  ALTER COLUMN order_number TYPE INTEGER USING order_number::integer;

ALTER TABLE orders
  ALTER COLUMN order_number SET NOT NULL;
