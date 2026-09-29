import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentBillingPeriod } from '../lib/utils'

export interface DashboardStats {
  totalCustomers: number
  activeCustomers: number
  suspendedCustomers: number
  expectedThisMonth: number
  collectedThisMonth: number
  outstandingBalance: number
  unpaidCustomers: number
  overdueCustomers: number
  collectionsToday: number
}

export interface MonthlyData {
  period: string
  label: string
  expected: number
  collected: number
  outstanding: number
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const period = currentBillingPeriod()
        const today = new Date().toISOString().split('T')[0]

        const [customersRes, chargesCurrentRes, chargesHistoryRes, collectionsRes] = await Promise.all([
          supabase.from('customers').select('status'),
          supabase.from('billing_charges').select('amount_due, amount_paid, status').eq('billing_period', period),
          supabase.from('billing_charges')
            .select('billing_period, amount_due, amount_paid')
            .gte('billing_period', getPastPeriod(6))
            .order('billing_period'),
          supabase.from('collection_schedules').select('status').eq('scheduled_date', today),
        ])

        if (customersRes.error) throw customersRes.error
        if (chargesCurrentRes.error) throw chargesCurrentRes.error

        const customers = customersRes.data ?? []
        const charges = chargesCurrentRes.data ?? []
        const history = chargesHistoryRes.data ?? []
        const collections = collectionsRes.data ?? []

        const activeCustomers = customers.filter(c => c.status === 'active').length
        const suspendedCustomers = customers.filter(c => c.status === 'suspended').length
        const expectedThisMonth = charges.reduce((s, c) => s + c.amount_due, 0)
        const collectedThisMonth = charges.reduce((s, c) => s + c.amount_paid, 0)
        const outstandingBalance = expectedThisMonth - collectedThisMonth
        const unpaidCustomers = charges.filter(c => c.status === 'unpaid' || c.status === 'partial').length
        const overdueCustomers = charges.filter(c => c.status === 'overdue').length
        const collectionsToday = collections.filter(c => c.status === 'scheduled').length

        setStats({
          totalCustomers: customers.length,
          activeCustomers,
          suspendedCustomers,
          expectedThisMonth,
          collectedThisMonth,
          outstandingBalance,
          unpaidCustomers,
          overdueCustomers,
          collectionsToday,
        })

        // Aggregate monthly history
        const periodMap = new Map<string, { expected: number; collected: number }>()
        for (const h of history) {
          const existing = periodMap.get(h.billing_period) ?? { expected: 0, collected: 0 }
          periodMap.set(h.billing_period, {
            expected: existing.expected + h.amount_due,
            collected: existing.collected + h.amount_paid,
          })
        }

        const monthly: MonthlyData[] = Array.from(periodMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([p, v]) => ({
            period: p,
            label: formatPeriodShort(p),
            expected: v.expected,
            collected: v.collected,
            outstanding: v.expected - v.collected,
          }))

        setMonthlyData(monthly)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { stats, monthlyData, loading, error }
}

function getPastPeriod(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodShort(period: string): string {
  const [year, month] = period.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}
