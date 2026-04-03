-- ============================================================
-- Contracten tabel
-- Uitvoeren in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS contracten (
  id            bigint generated always as identity primary key,
  licentiehouder_id bigint not null references licentiehouders(id) on delete cascade,
  datum_van     date,
  datum_tot     date,
  actief        boolean not null default true,
  notities      text,
  bestand_naam  text,
  bestand_pad   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS inschakelen
ALTER TABLE contracten ENABLE ROW LEVEL SECURITY;

-- Ingelogde gebruikers mogen alles lezen/schrijven
CREATE POLICY "Authenticated full access"
  ON contracten FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Storage bucket voor PDF-bijlagen
-- ============================================================
-- Voer dit ook uit, OF maak de bucket handmatig aan in
-- Supabase Dashboard > Storage > New bucket:
--   Naam: contracten
--   Public: UIT (privé)

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracten', 'contracten', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated upload contracten"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contracten');

CREATE POLICY "Authenticated read contracten"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contracten');

CREATE POLICY "Authenticated delete contracten"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contracten');
