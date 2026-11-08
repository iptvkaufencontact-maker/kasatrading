-- Add per-product VAT and immutable order-line VAT snapshots.
-- Existing products stay unconfigured; historical order totals remain unchanged.
BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tax_rate_bps_check' AND conrelid = 'products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT products_tax_rate_bps_check CHECK (tax_rate_bps IS NULL OR tax_rate_bps IN (550, 2000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_tax_rate_bps_check' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_tax_rate_bps_check CHECK (tax_rate_bps IS NULL OR tax_rate_bps IN (550, 2000));
  END IF;
END $$;

COMMIT;
