-- Kasa Trading — alignement sur le schéma partagé (Neon). Idempotent, uniquement additif/compatible.
ALTER TABLE products    ADD COLUMN IF NOT EXISTS unit varchar(30) NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit varchar(30) NOT NULL DEFAULT '';
ALTER TABLE users       ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='sachets_per_carton_at_order') THEN
    ALTER TABLE order_items RENAME COLUMN sachets_per_carton_at_order TO sachets_per_carton;
  END IF;
  ALTER TABLE order_items ALTER COLUMN additional_sachets TYPE numeric(12,2), ALTER COLUMN total_sachets TYPE numeric(12,2),
                          ALTER COLUMN carton_quantity SET DEFAULT 0, ALTER COLUMN sachets_per_carton SET DEFAULT 1;
  ALTER TABLE users ALTER COLUMN name TYPE varchar(160), ALTER COLUMN email TYPE varchar(200), ALTER COLUMN role TYPE varchar(30);
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='id') THEN
    DROP TABLE sessions;
    CREATE TABLE sessions (id serial PRIMARY KEY, token_hash varchar(128) NOT NULL UNIQUE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                           expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX sessions_user_idx ON sessions(user_id);
  END IF;
END $$;
