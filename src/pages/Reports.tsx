import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusBadge } from '../components/ui/StatusBadge'
import { supabase } from '../lib/supabase'
import { formatMoney, formatBillingPeriod, formatDate } from '../lib/utils'

interface SectorReport {
  sector: string
  total: number
  expected: number
  collected: number
  outstanding: number
}

interface CustomerReport {
  id: string
  name: string
  subscriber_id: string | null
  sector: string
  status: string
  total_due: number
  total_paid: number
  balance: number
  last_payment: string | null
}

interface MonthTrend { label: string; attendu: number; encaissé: number }

function getPastPeriod(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function periodShort(p: string): string {
  const [y, m] = p.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export function Reports() {
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [sectorReports, setSectorReports] = useState<SectorReport[]>([])
  const [unpaidList, setUnpaidList] = useState<CustomerReport[]>([])
  const [monthTrend, setMonthTrend] = useState<MonthTrend[]>([])
  const [globalRate, setGlobalRate] = useState(0)
  const [totals, setTotals] = useState({ expected: 0, collected: 0, outstanding: 0 })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('billing_charges')
        .select('customer_id, amount_due, amount_paid, customers (sector_id, sectors (name, code))')
        .eq('billing_period', period),
      supabase.from('billing_charges')
        .select('customer_id, billing_period, amount_due, amount_paid, status, customers (first_name, last_name, subscriber_id, sector_id, sectors (code))')
        .in('status', ['unpaid', 'partial', 'overdue']),
      supabase.from('payments')
        .select('customer_id, payment_date')
        .order('payment_date', { ascending: false }),
      supabase.from('billing_charges')
        .select('billing_period, amount_due, amount_paid')
        .gte('billing_period', getPastPeriod(5))
        .order('billing_period'),
    ]).then(([chargesRes, unpaidRes, paymentsRes, trendRes]) => {
      const charges = (chargesRes.data ?? []) as any[]
      const unpaid = (unpaidRes.data ?? []) as any[]
      const payments = (paymentsRes.data ?? []) as any[]
      const trendData = (trendRes.data ?? []) as any[]

      // Monthly trend
      const trendMap = new Map<string, { expected: number; collected: number }>()
      for (const c of trendData) {
        const prev = trendMap.get(c.billing_period) ?? { expected: 0, collected: 0 }
        trendMap.set(c.billing_period, { expected: prev.expected + c.amount_due, collected: prev.collected + c.amount_paid })
      }
      setMonthTrend(Array.from(trendMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([p, v]) => ({
        label: periodShort(p), attendu: v.expected, 'encaissé': v.collected,
      })))

      // Period totals
      const exp = charges.reduce((s: number, c: any) => s + c.amount_due, 0)
      const col = charges.reduce((s: number, c: any) => s + c.amount_paid, 0)
      setTotals({ expected: exp, collected: col, outstanding: exp - col })
      setGlobalRate(exp > 0 ? Math.round((col / exp) * 100) : 0)

      // Sector rollup
      const sectorMap = new Map<string, { total: number; expected: number; collected: number }>()
      for (const c of charges) {
        const customer = c.customers as any
        const sectorName = customer?.sectors?.name ?? 'Non défini'
        const prev = sectorMap.get(sectorName) ?? { total: 0, expected: 0, collected: 0 }
        sectorMap.set(sectorName, {
          total: prev.total + 1,
          expected: prev.expected + c.amount_due,
          collected: prev.collected + c.amount_paid,
        })
      }
      setSectorReports(Array.from(sectorMap.entries()).map(([sector, v]) => ({
        sector,
        ...v,
        outstanding: v.expected - v.collected,
      })))

      // Last payment map
      const lastPay = new Map<string, string>()
      for (const p of payments) {
        if (!lastPay.has(p.customer_id)) lastPay.set(p.customer_id, p.payment_date)
      }

      // Unpaid customers
      const customerMap = new Map<string, CustomerReport>()
      for (const c of unpaid) {
        const customer = c.customers as any
        const id = c.customer_id
        const existing = customerMap.get(id)
        if (existing) {
          existing.total_due += c.amount_due
          existing.total_paid += c.amount_paid
          existing.balance += c.amount_due - c.amount_paid
        } else {
          customerMap.set(id, {
            id,
            name: `${customer?.last_name ?? ''} ${customer?.first_name ?? ''}`.trim(),
            subscriber_id: customer?.subscriber_id ?? null,
            sector: customer?.sectors?.code ?? '—',
            status: c.status,
            total_due: c.amount_due,
            total_paid: c.amount_paid,
            balance: c.amount_due - c.amount_paid,
            last_payment: lastPay.get(id) ?? null,
          })
        }
      }
      setUnpaidList(Array.from(customerMap.values()).sort((a, b) => b.balance - a.balance))
      setLoading(false)
    })
  }, [period])

  function exportCSV() {
    const rows = unpaidList.map(c =>
      [c.name, c.subscriber_id ?? '', c.sector, c.status, c.total_due, c.total_paid, c.balance].join(',')
    )
    const header = 'Nom,N° Abonné,Secteur,Statut,Dû,Payé,Solde'
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport_impayés_${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Rapports"
        description="Analyse financière et opérationnelle"
        actions={
          <button className="btn-secondary" onClick={exportCSV}>
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="label">Période</label>
          <input
            className="input font-mono"
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value.replace('-', '-'))}
          />
        </div>
      </div>

      {loading ? <LoadingState /> : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">Total attendu</div>
              <div className="text-lg font-bold text-gray-900">{formatMoney(totals.expected)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">Encaissé</div>
              <div className="text-lg font-bold text-green-700">{formatMoney(totals.collected)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">Solde restant</div>
              <div className="text-lg font-bold text-red-600">{formatMoney(totals.outstanding)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">Taux de recouvrement</div>
              <div className={`text-lg font-bold ${globalRate >= 80 ? 'text-green-700' : globalRate >= 50 ? 'text-orange-500' : 'text-red-600'}`}>
                {globalRate}%
              </div>
              <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${globalRate}%`, background: globalRate >= 80 ? '#1B6C42' : globalRate >= 50 ? '#f97316' : '#ef4444' }} />
              </div>
            </div>
          </div>

          {/* Monthly trend chart */}
          {monthTrend.length > 1 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Évolution mensuelle (6 derniers mois)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthTrend} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Bar dataKey="attendu" name="Attendu" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="encaissé" name="Encaissé" fill="#1B6C42" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sector breakdown */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Recouvrement par secteur — {formatBillingPeriod(period)}
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Secteur</th>
                  <th className="table-header text-right">Clients</th>
                  <th className="table-header text-right hidden sm:table-cell">Attendu</th>
                  <th className="table-header text-right hidden sm:table-cell">Encaissé</th>
                  <th className="table-header text-right">Solde</th>
                  <th className="table-header">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sectorReports.map(r => {
                  const rate = r.expected > 0 ? Math.round((r.collected / r.expected) * 100) : 0
                  return (
                    <tr key={r.sector}>
                      <td className="table-cell font-medium">{r.sector}</td>
                      <td className="table-cell text-right text-gray-500">{r.total}</td>
                      <td className="table-cell text-right hidden sm:table-cell">{formatMoney(r.expected)}</td>
                      <td className="table-cell text-right hidden sm:table-cell text-green-700">{formatMoney(r.collected)}</td>
                      <td className="table-cell text-right">
                        <span className={r.outstanding > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                          {formatMoney(r.outstanding)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[48px]">
                            <div className="h-full rounded-full" style={{ width: `${rate}%`, background: rate >= 80 ? '#1B6C42' : rate >= 50 ? '#f97316' : '#ef4444' }} />
                          </div>
                          <span className={`text-xs font-semibold ${rate >= 80 ? 'text-green-700' : 'text-orange-600'}`}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Unpaid customers */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Clients avec solde impayé ({unpaidList.length})
              </h2>
            </div>
            {unpaidList.length === 0 ? (
              <div className="p-8 text-center text-sm text-green-600 font-medium">
                Tous les clients sont à jour ✓
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">Client</th>
                      <th className="table-header hidden md:table-cell">Secteur</th>
                      <th className="table-header text-right">Dû</th>
                      <th className="table-header text-right hidden sm:table-cell">Payé</th>
                      <th className="table-header text-right">Solde</th>
                      <th className="table-header">Statut</th>
                      <th className="table-header hidden lg:table-cell">Dernier paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unpaidList.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <div className="font-medium text-gray-900">{c.name}</div>
                          {c.subscriber_id && <div className="text-xs font-mono text-gray-400">{c.subscriber_id}</div>}
                        </td>
                        <td className="table-cell hidden md:table-cell text-gray-500">{c.sector}</td>
                        <td className="table-cell text-right">{formatMoney(c.total_due)}</td>
                        <td className="table-cell text-right hidden sm:table-cell text-green-700">{formatMoney(c.total_paid)}</td>
                        <td className="table-cell text-right">
                          <span className="text-red-600 font-semibold">{formatMoney(c.balance)}</span>
                        </td>
                        <td className="table-cell"><StatusBadge status={c.status} /></td>
                        <td className="table-cell hidden lg:table-cell text-gray-400">{formatDate(c.last_payment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
