import { createContext, useContext } from 'react'

export interface PagePermissions {
  dashboard: boolean
  debiteuren: boolean
  licentiehouders: boolean
  rassen: boolean
  artikelen: boolean
  omzetrekeningen: boolean
  ontbrekende_kosten: boolean
  licentiekosten: boolean
  checklist: boolean
  can_edit: boolean
}

export interface UserProfile {
  id: string
  email: string
  status: 'pending' | 'active' | 'rejected'
  is_admin: boolean
  permissions: PagePermissions
}

export const ADMIN_EMAIL = 'thom@greann.com'

export const DEFAULT_PERMISSIONS: PagePermissions = {
  dashboard: true,
  debiteuren: false,
  licentiehouders: false,
  rassen: false,
  artikelen: false,
  omzetrekeningen: false,
  ontbrekende_kosten: false,
  licentiekosten: false,
  checklist: false,
  can_edit: false,
}

export const FULL_PERMISSIONS: PagePermissions = {
  dashboard: true, debiteuren: true, licentiehouders: true, rassen: true,
  artikelen: true, omzetrekeningen: true, ontbrekende_kosten: true,
  licentiekosten: true, checklist: true, can_edit: true,
}

export const PAGE_LABELS: { key: keyof Omit<PagePermissions, 'can_edit'>; label: string }[] = [
  { key: 'dashboard',          label: 'Dashboard' },
  { key: 'debiteuren',         label: 'Debiteuren' },
  { key: 'licentiehouders',    label: 'Licentiehouders' },
  { key: 'rassen',             label: 'Rassen' },
  { key: 'artikelen',          label: 'Artikelen' },
  { key: 'omzetrekeningen',    label: 'Omzetrekeningen' },
  { key: 'ontbrekende_kosten', label: 'Ontbrekende kosten' },
  { key: 'licentiekosten',     label: 'Licentiekosten' },
  { key: 'checklist',          label: 'Checklist' },
]

interface AuthContextType {
  profile: UserProfile | null
}

export const AuthContext = createContext<AuthContextType>({ profile: null })
export const useAuth = () => useContext(AuthContext)
