import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface Org {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
}

interface OrgContextValue {
  org: Org | null
  orgs: Org[]
  loading: boolean
  switchOrg: (id: string) => void
  refresh: () => Promise<void>
}

const OrgContext = createContext<OrgContextValue>({
  org: null, orgs: [], loading: true,
  switchOrg: () => {}, refresh: async () => {},
})

export function useOrg() {
  return useContext(OrgContext)
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(
    () => localStorage.getItem('wp_org_id')
  )
  const [loading, setLoading] = useState(true)

  async function loadOrgs() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('org_members')
        .select('role, organizations (id, name, slug)')

      const list: Org[] = ((data ?? []) as any[]).flatMap(m => {
        if (!m.organizations) return []
        return [{
          id: m.organizations.id,
          name: m.organizations.name,
          slug: m.organizations.slug,
          role: m.role as Org['role'],
        }]
      })
      setOrgs(list)

      if (list.length > 0) {
        const stored = currentOrgId && list.find(o => o.id === currentOrgId)
        if (!stored) {
          // Prefer an org where user was invited (non-owner) over one they created
          const preferred = list.find(o => o.role !== 'owner') ?? list[0]
          setCurrentOrgId(preferred.id)
          localStorage.setItem('wp_org_id', preferred.id)
        } else if (stored.role === 'owner' && list.some(o => o.role !== 'owner')) {
          // User created an empty org then was added to another — switch to the invited org
          const invited = list.find(o => o.role !== 'owner')!
          setCurrentOrgId(invited.id)
          localStorage.setItem('wp_org_id', invited.id)
        }
      } else {
        setCurrentOrgId(null)
        localStorage.removeItem('wp_org_id')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [])

  function switchOrg(id: string) {
    setCurrentOrgId(id)
    localStorage.setItem('wp_org_id', id)
  }

  const org = orgs.find(o => o.id === currentOrgId) ?? null

  return (
    <OrgContext.Provider value={{ org, orgs, loading, switchOrg, refresh: loadOrgs }}>
      {children}
    </OrgContext.Provider>
  )
}
