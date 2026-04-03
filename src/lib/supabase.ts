import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(supabaseUrl, supabaseKey)
export type DebiteurType = 'Extern' | 'Intern' | 'Royakkers'
export type SoortPlant = 'Aardbei' | 'Framboos' | 'Braam'
export type GrbType = 'Voorschot' | 'Eindafrekening' | 'Reservering' | 'Overige'
export interface Debiteur { id: number; nummer: string; naam: string; land: string; type: DebiteurType; actief: boolean; created_at: string; updated_at: string }
export interface Licentiehouder { id: number; naam: string; created_at: string; updated_at: string; bedrijven?: LicentiehouderBedrijf[]; rassen?: Ras[] }
export interface LicentiehouderBedrijf { id: number; licentiehouder_id: number; bedrijfsnaam: string }
export interface Ras { id: number; licentiehouder_id: number; naam: string; soort: SoortPlant; tarief: number; actief: boolean }
export interface Artikel { id: number; code: string; code_groep: string | null; omschrijving: string; ras_id: number | null }
export interface Transactie { id: number; datum: string; rekening: string | null; omschrijving: string | null; debet_eur: number | null; credit_eur: number | null; vv_bedrag: number | null; debiteur_id: number | null; artikel_id: number | null; licentiehouder_id: number | null; ras_id: number | null; soort: SoortPlant | null; aantal: number; licentiekost_per_plant: number | null; totaal_licentiekosten: number | null; maand: string; jaar: number; debiteuren?: Pick<Debiteur, 'nummer'|'naam'|'land'>; licentiehouders?: Pick<Licentiehouder, 'naam'>; rassen?: Pick<Ras, 'naam'|'soort'> }
export interface Grootboek1955 { id: number; datum: string; factuurnr: string | null; uw_referentie: string | null; omschrijving: string; debet_eur: number | null; credit_eur: number | null; vv_bedrag: number; licentiehouder_id: number | null; artikel_type: GrbType | null; maand: string; jaar: number; licentiehouders?: Pick<Licentiehouder, 'naam'> }
export interface Contract { id: number; licentiehouder_id: number; ras_id: number | null; soort: string | null; datum_van: string | null; datum_tot: string | null; actief: boolean; notities: string | null; bestand_naam: string | null; bestand_pad: string | null; created_at: string; updated_at: string; licentiehouders?: Pick<Licentiehouder, 'naam'> }
