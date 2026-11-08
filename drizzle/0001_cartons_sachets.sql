-- Kasa Trading — passage au conditionnement carton / sachet.
-- À exécuter UNE fois sur une installation créée avant cette évolution (idempotent, sans perte de données).
-- Les anciennes lignes de commande (quantité libre) sont converties : total conservé à l'identique,
-- quantité arrondie en sachets, prix unitaire repris comme prix du sachet.
DO $$
BEGIN
  -- Produits -----------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price') THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS default_sachet_price numeric(12,2);
    UPDATE products SET default_sachet_price = price WHERE default_sachet_price IS NULL;
    ALTER TABLE products DROP COLUMN price;
  END IF;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS default_sachet_price numeric(12,2);
  UPDATE products SET default_sachet_price = 0 WHERE default_sachet_price IS NULL;
  ALTER TABLE products ALTER COLUMN default_sachet_price SET NOT NULL;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS sachets_per_carton integer NOT NULL DEFAULT 10;
  ALTER TABLE products ALTER COLUMN unit SET DEFAULT '';
  UPDATE products SET unit = '' WHERE unit IN ('kg', 'boîte', 'pack', 'pièce', 'sac');

  -- Lignes de commande ---------------------------------------------------------
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS carton_quantity integer NOT NULL DEFAULT 0;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS additional_sachets integer NOT NULL DEFAULT 0;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sachets_per_carton integer NOT NULL DEFAULT 1;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_sachets integer NOT NULL DEFAULT 0;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sachet_price_at_order numeric(12,2) NOT NULL DEFAULT 0;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS default_sachet_price_at_order numeric(12,2) NOT NULL DEFAULT 0;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price numeric(12,2) NOT NULL DEFAULT 0;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'quantity') THEN
    UPDATE order_items
       SET additional_sachets = GREATEST(1, round(quantity))::int,
           total_sachets = GREATEST(1, round(quantity))::int,
           sachet_price_at_order = unit_price,
           default_sachet_price_at_order = unit_price,
           total_price = line_total
     WHERE total_sachets = 0;
    ALTER TABLE order_items DROP COLUMN quantity, DROP COLUMN unit_price, DROP COLUMN line_total;
  END IF;
  ALTER TABLE order_items ALTER COLUMN unit SET DEFAULT '';
  ALTER TABLE order_items ALTER COLUMN carton_quantity DROP DEFAULT;
  ALTER TABLE order_items ALTER COLUMN additional_sachets DROP DEFAULT;
  ALTER TABLE order_items ALTER COLUMN sachets_per_carton DROP DEFAULT;
  ALTER TABLE order_items ALTER COLUMN total_sachets DROP DEFAULT;
  ALTER TABLE order_items ALTER COLUMN sachet_price_at_order DROP DEFAULT;
  ALTER TABLE order_items ALTER COLUMN default_sachet_price_at_order DROP DEFAULT;
  ALTER TABLE order_items ALTER COLUMN total_price DROP DEFAULT;
END $$;
