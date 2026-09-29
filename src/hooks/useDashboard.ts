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

export interface TopDebtor {
  id: string
  name: string
  balance: number
}

export interface RecentPayment {
  id: string
  name: string
  amount: number
  date: string
}

export interface SectorStat {
  name: string
  code: string
  active: number
  unpaidAmount: number
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [sectorStats, setSectorStats] = useState<SectorStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const period = currentBillingPeriod()
        const today = new Date().toISOString().split('T')[0]

        const [customersRes, chargesCurrentRes, chargesHistoryRes, collectionsRes, paymentsRes, sectorsRes] =
          await Promise.all([
            supabase.from('customers').select('id, first_name, last_name, status, sector_id'),
            supabase.from('billing_charges')
              .select('customer_id, amount_due, amount_paid, balance, status')
              .eq('billing_period', period),
            supabase.from('billing_charges')
              .select('billing_period, amount_due, amount_paid')
              .gte('billing_period', getPastPeriod(6))
              .order('billing_period'),
            supabase.from('collection_schedules').select('status').eq('scheduled_date', today),
            supabase.from('payments')
              .select('id, customer_id, amount, payment_date')
              .order('payment_date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(5),
            supabase.from('sectors').select('id, name, code').eq('active', true),
          ])

        if (customersRes.error) throw customersRes.error
        if (chargesCurrentRes.error) throw chargesCurrentRes.error

        const customers = customersRes.data ?? []
        const charges = chargesCurrentRes.data ?? []
        const history = chargesHistoryRes.data ?? []
        const collections = collectionsRes.data ?? []
        const payments = paymentsRes.data ?? []
        const sectors = sectorsRes.data ?? []

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

        // Top debtors this month
        const customerMap = new Map(customers.map(c => [c.id, `${c.last_name} ${c.first_name}`]))
        const debtors: TopDebtor[] = charges
          .filter(c => (c.balance ?? (c.amount_due - c.amount_paid)) > 0)
          .map(c => ({
            id: c.customer_id,
            name: customerMap.get(c.customer_id) ?? '—',
            balance: c.balance ?? (c.amount_due - c.amount_paid),
          }))
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 4)
        setTopDebtors(debtors)

        // Recent payments with customer names
        const recent: RecentPayment[] = payments.map(p => ({
          id: p.id,
          name: customerMap.get(p.customer_id) ?? '—',
          amount: p.amount,
          date: p.payment_date,
        }))
        setRecentPayments(recent)

        // Sector stats
        const sectorCustomerMap = new Map<string, number>()
        const sectorUnpaidMap = new Map<string, number>()
        for (const c of customers.filter(c => c.status === 'active')) {
          if (c.sector_id) sectorCustomerMap.set(c.sector_id, (sectorCustomerMap.get(c.sector_id) ?? 0) + 1)
        }
        for (const ch of charges.filter(c => (c.balance ?? (c.amount_due - c.amount_paid)) > 0)) {
          const cust = customers.find(c => c.id === ch.customer_id)
          if (cust?.sector_id) {
            sectorUnpaidMap.set(cust.sector_id, (sectorUnpaidMap.get(cust.sector_id) ?? 0) + (ch.balance ?? (ch.amount_due - ch.amount_paid)))
          }
        }
        const ss: SectorStat[] = sectors.map(s => ({
          name: s.name,
          code: s.code,
          active: sectorCustomerMap.get(s.id) ?? 0,
          unpaidAmount: sectorUnpaidMap.get(s.id) ?? 0,
        }))
        setSectorStats(ss)

        // Monthly history
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

  return { stats, monthlyData, topDebtors, recentPayments, sectorStats, loading, error }
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
