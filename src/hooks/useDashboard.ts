import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { currentBillingPeriod } from '../lib/utils'

export interface DashboardStats {
  totalCustomers: number
  activeCustomers: number
  suspendedCustomers: number
  pausedCustomers: number
  expectedThisMonth: number
  collectedThisMonth: number
  outstandingBalance: number
  unpaidCustomers: number
  overdueCustomers: number
  collectionsToday: number
  collectionsCompleted: number
  collectionsMissed: number
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

export interface DailyPayment {
  day: string
  amount: number
}

export interface SectorStat {
  name: string
  code: string
  active: number
  unpaidAmount: number
}

export function useDashboard() {
  const { org } = useOrg()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([])
  const [dailyPayments, setDailyPayments] = useState<DailyPayment[]>([])
  const [sectorStats, setSectorStats] = useState<SectorStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [overdueAlertCount, setOverdueAlertCount] = useState(0)
  const [activePeriod, setActivePeriod] = useState<string>('')

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    if (!org) return
    async function load() {
      setLoading(true)
      try {
        const latestRes = await supabase
          .from('billing_charges')
          .select('billing_period')
          .eq('org_id', org!.id)
          .order('billing_period', { ascending: false })
          .limit(1)
          .maybeSingle()
        const period = latestRes.data?.billing_period ?? currentBillingPeriod()
        setActivePeriod(period)

        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]

        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 6)
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

        const [customersRes, chargesCurrentRes, chargesHistoryRes, collectionsRes, paymentsWeekRes, sectorsRes] =
          await Promise.all([
            supabase.from('customers').select('id, first_name, last_name, status, sector_id, subscriber_id, phone').eq('org_id', org!.id).range(0, 4999),
            supabase.from('billing_charges').select('customer_id, amount_due, amount_paid, balance, status').eq('org_id', org!.id).eq('billing_period', period),
            supabase.from('billing_charges').select('billing_period, amount_due, amount_paid').eq('org_id', org!.id).gte('billing_period', getPastPeriod(6)).order('billing_period'),
            supabase.from('collection_schedules').select('status').eq('org_id', org!.id).eq('scheduled_date', todayStr),
            supabase.from('payments').select('amount, payment_date').eq('org_id', org!.id).gte('payment_date', sevenDaysAgoStr).order('payment_date'),
            supabase.from('sectors').select('id, name, code').eq('org_id', org!.id).eq('active', true),
          ])

        if (customersRes.error) throw customersRes.error
        if (chargesCurrentRes.error) throw chargesCurrentRes.error

        const rawCustomers = customersRes.data ?? []
        const dedupSeen = new Set<string>()
        const customers = rawCustomers.filter(c => {
          const key = c.subscriber_id
            ? `sub:${c.subscriber_id}`
            : `name:${(c.last_name ?? '').toLowerCase()}|${(c.first_name ?? '').toLowerCase()}|${c.phone ?? ''}`
          if (dedupSeen.has(key)) return false
          dedupSeen.add(key)
          return true
        })
        const charges = chargesCurrentRes.data ?? []
        const history = chargesHistoryRes.data ?? []
        const collections = collectionsRes.data ?? []
        const paymentsWeek = paymentsWeekRes.data ?? []
        const sectors = sectorsRes.data ?? []

        const activeCustomers = customers.filter(c => c.status === 'active').length
        const suspendedCustomers = customers.filter(c => c.status === 'suspended').length
        const pausedCustomers = customers.filter(c => c.status === 'paused').length
        const expectedThisMonth = charges.reduce((s, c) => s + c.amount_due, 0)
        const collectedThisMonth = charges.reduce((s, c) => s + c.amount_paid, 0)
        const outstandingBalance = expectedThisMonth - collectedThisMonth
        const unpaidCustomers = charges.filter(c => c.status === 'unpaid' || c.status === 'partial').length
        const overdueCustomers = charges.filter(c => c.status === 'overdue').length
        const collectionsToday = collections.filter(c => c.status === 'scheduled').length
        const collectionsCompleted = collections.filter(c => c.status === 'completed').length
        const collectionsMissed = collections.filter(c => c.status === 'missed').length

        setStats({
          totalCustomers: customers.length,
          activeCustomers, suspendedCustomers, pausedCustomers,
          expectedThisMonth, collectedThisMonth, outstandingBalance,
          unpaidCustomers, overdueCustomers,
          collectionsToday, collectionsCompleted, collectionsMissed,
        })

        const customerMap = new Map(customers.map(c => [c.id, `${c.last_name} ${c.first_name}`]))
        const debtors: TopDebtor[] = charges
          .filter(c => (c.balance ?? (c.amount_due - c.amount_paid)) > 0)
          .map(c => ({
            id: c.customer_id,
            name: customerMap.get(c.customer_id) ?? '—',
            balance: c.balance ?? (c.amount_due - c.amount_paid),
          }))
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 5)
        setTopDebtors(debtors)

        const dayLabels = ['fr', 'sa', 'di', 'lu', 'ma', 'me', 'je']
        const dayMap = new Map<string, number>()
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgo)
          d.setDate(sevenDaysAgo.getDate() + i)
          dayMap.set(d.toISOString().split('T')[0], 0)
        }
        for (const p of paymentsWeek) {
          const existing = dayMap.get(p.payment_date) ?? 0
          dayMap.set(p.payment_date, existing + p.amount)
        }
        const daily: DailyPayment[] = Array.from(dayMap.entries()).map(([dateStr, amount], i) => ({
          day: dayLabels[new Date(dateStr).getDay()] ?? `J${i + 1}`,
          amount,
        }))
        setDailyPayments(daily)

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
        setSectorStats(sectors.map(s => ({
          name: s.name, code: s.code,
          active: sectorCustomerMap.get(s.id) ?? 0,
          unpaidAmount: sectorUnpaidMap.get(s.id) ?? 0,
        })))

        const periodMap = new Map<string, { expected: number; collected: number }>()
        for (const h of history) {
          const ex = periodMap.get(h.billing_period) ?? { expected: 0, collected: 0 }
          periodMap.set(h.billing_period, { expected: ex.expected + h.amount_due, collected: ex.collected + h.amount_paid })
        }
        setMonthlyData(
          Array.from(periodMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([p, v]) => ({
              period: p, label: formatPeriodShort(p),
              expected: v.expected, collected: v.collected, outstanding: v.expected - v.collected,
            }))
        )

        const { data: overdueRows } = await supabase
          .from('billing_charges')
          .select('id', { count: 'exact', head: false })
          .eq('org_id', org!.id)
          .in('status', ['unpaid', 'partial'])
          .lt('billing_period', period)
        setOverdueAlertCount(overdueRows?.length ?? 0)
        setLastUpdated(new Date())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [refreshKey, org?.id])

  return { stats, monthlyData, topDebtors, dailyPayments, sectorStats, loading, error, refresh, lastUpdated, overdueAlertCount, activePeriod }
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
