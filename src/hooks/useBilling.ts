import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { BillingCharge, Customer, Sector } from '../types/database'

export type ChargeRow = BillingCharge & {
  customers: (Pick<Customer, 'first_name' | 'last_name' | 'subscriber_id' | 'sector_id'> & {
    sectors: Pick<Sector, 'code'> | null
  }) | null
}

export function useBilling(period: string, statusFilter: string) {
  const [charges, setCharges] = useState<ChargeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ expected: 0, collected: 0, outstanding: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('billing_charges')
        .select(`
          *,
          customers (first_name, last_name, subscriber_id, sector_id, sectors (code))
        `)
        .eq('billing_period', period)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error

      const rows = (data ?? []) as ChargeRow[]
      setCharges(rows)

      const expected = rows.reduce((s, r) => s + r.amount_due, 0)
      const collected = rows.reduce((s, r) => s + r.amount_paid, 0)
      setSummary({ expected, collected, outstanding: expected - collected })
    } finally {
      setLoading(false)
    }
  }, [period, statusFilter])

  useEffect(() => { load() }, [load])

  return { charges, loading, summary, refresh: load }
}

export function useCustomerBilling(customerId: string) {
  const [charges, setCharges] = useState<BillingCharge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('billing_charges')
      .select('*')
      .eq('customer_id', customerId)
      .order('billing_period', { ascending: false })
      .then(({ data }) => {
        setCharges(data ?? [])
        setLoading(false)
      })
  }, [customerId])

  return { charges, loading }
}
