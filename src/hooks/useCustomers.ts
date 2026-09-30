import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer, Sector } from '../types/database'

export type CustomerRow = Customer & {
  sectors: Pick<Sector, 'name' | 'code'> | null
  current_balance: number
  last_payment_date: string | null
  subscription_status: string | null
  monthly_price: number | null
}

interface Filters {
  search: string
  status: string
  sector: string
  paymentStatus: string
}

export function useCustomers(filters: Filters) {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('customers')
        .select(`
          *,
          sectors (name, code)
        `)
        .order('last_name, first_name')

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters.sector && filters.sector !== 'all') {
        query = query.eq('sector_id', filters.sector)
      }
      if (filters.search) {
        const s = `%${filters.search}%`
        query = query.or(`first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s},subscriber_id.ilike.${s}`)
      }

      const { data, error: err } = await query.range(0, 4999)
      if (err) throw err

      const customerIds = (data ?? []).map(c => c.id)
      if (customerIds.length === 0) {
        setCustomers([])
        setLoading(false)
        return
      }

      // Batch .in() queries to avoid URL-length limits (max 200 IDs per request)
      const CHUNK = 200
      const chargesArr: { customer_id: string; balance: number; status: string }[] = []
      const subsArr: { customer_id: string; monthly_price: number; status: string }[] = []
      const paymentsArr: { customer_id: string; payment_date: string }[] = []

      for (let i = 0; i < customerIds.length; i += CHUNK) {
        const chunk = customerIds.slice(i, i + CHUNK)
        const [c, s, p] = await Promise.all([
          supabase.from('billing_charges').select('customer_id, balance, status').in('customer_id', chunk),
          supabase.from('subscriptions').select('customer_id, monthly_price, status').in('customer_id', chunk).eq('status', 'active'),
          supabase.from('payments').select('customer_id, payment_date').in('customer_id', chunk).order('payment_date', { ascending: false }),
        ])
        if (c.data) chargesArr.push(...(c.data as typeof chargesArr))
        if (s.data) subsArr.push(...(s.data as typeof subsArr))
        if (p.data) paymentsArr.push(...(p.data as typeof paymentsArr))
      }

      const charges = chargesArr
      const subs = subsArr
      const lastPayments = paymentsArr

      const balanceMap = new Map<string, number>()
      const payStatusMap = new Map<string, string>()
      for (const c of charges ?? []) {
        balanceMap.set(c.customer_id, (balanceMap.get(c.customer_id) ?? 0) + c.balance)
        if (c.status !== 'paid') {
          payStatusMap.set(c.customer_id, c.status)
        }
      }

      const subMap = new Map<string, { status: string; monthly_price: number }>()
      for (const s of subs ?? []) {
        if (!subMap.has(s.customer_id)) {
          subMap.set(s.customer_id, { status: s.status, monthly_price: s.monthly_price })
        }
      }

      const lastPaymentMap = new Map<string, string>()
      for (const p of lastPayments ?? []) {
        if (!lastPaymentMap.has(p.customer_id)) {
          lastPaymentMap.set(p.customer_id, p.payment_date)
        }
      }

      const rows: CustomerRow[] = (data ?? []).map(c => ({
        ...c,
        current_balance: balanceMap.get(c.id) ?? 0,
        last_payment_date: lastPaymentMap.get(c.id) ?? null,
        subscription_status: subMap.get(c.id)?.status ?? null,
        monthly_price: subMap.get(c.id)?.monthly_price ?? null,
      }))

      // Deduplicate: keep one per subscriber_id (if set), else per (last_name+first_name+phone)
      // This handles the case where the same customer was imported multiple times
      const dedupSeen = new Set<string>()
      const deduped = rows.filter(r => {
        const key = r.subscriber_id
          ? `sub:${r.subscriber_id}`
          : `name:${r.last_name?.toLowerCase()}|${r.first_name?.toLowerCase()}|${r.phone ?? ''}`
        if (dedupSeen.has(key)) return false
        dedupSeen.add(key)
        return true
      })

      // Filter by payment status client-side
      const filtered = filters.paymentStatus && filters.paymentStatus !== 'all'
        ? deduped.filter(r => {
            if (filters.paymentStatus === 'paid') return r.current_balance === 0
            if (filters.paymentStatus === 'unpaid') return r.current_balance > 0
            return true
          })
        : deduped

      setCustomers(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [filters.search, filters.status, filters.sector, filters.paymentStatus])

  useEffect(() => { load() }, [load])

  return { customers, loading, error, refresh: load }
}

export function useSectors() {
  const [sectors, setSectors] = useState<Sector[]>([])
  useEffect(() => {
    supabase.from('sectors').select('*').order('name')
      .then(({ data }) => setSectors(data ?? []))
  }, [])
  return sectors
}
