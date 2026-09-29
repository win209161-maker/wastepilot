import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingDown, TrendingUp, Truck, AlertCircle,
  Ban, DollarSign, ChevronRight, Receipt, CreditCard,
  BarChart3, FileSpreadsheet, Layers
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { LoadingState } from '../components/ui/LoadingState'
import { useDashboard } from '../hooks/useDashboard'
import { formatMoney, formatBillingPeriod, currentBillingPeriod } from '../lib/utils'

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name === 'collected' ? 'Encaissé' : p.name === 'expected' ? 'Attendu' : 'Restant'}:</span>
          <span className="font-medium">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function SectionPanel({
  to, icon: Icon, title, children, accent
}: {
  to: string
  icon: any
  title: string
  children: React.ReactNode
  accent?: string
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(to)}
      className="card p-4 cursor-pointer group"
      style={{ borderTop: `3px solid ${accent ?? '#1B6C42'}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: accent ?? '#1B6C42' }} />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
      {children}
    </div>
  )
}

function KpiRow({ label, value, sub, valueColor }: { label: string; value: string | number; sub?: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold" style={{ color: valueColor ?? '#111827' }}>{value}</span>
        {sub && <span className="text-xs text-gray-400 ml-1">{sub}</span>}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { stats, monthlyData, topDebtors, recentPayments, sectorStats, loading, error } = useDashboard()
  const period = currentBillingPeriod()
  const navigate = useNavigate()

  if (loading) return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Tableau de bord</h1>
        <p className="text-sm text-gray-500">{formatBillingPeriod(period)}</p>
      </div>
      <LoadingState rows={8} />
    </div>
  )

  if (error) return (
    <div className="p-4 bg-red-50 rounded-xl text-sm text-red-700 border border-red-200">
      Erreur: {error}
    </div>
  )

  if (!stats) return null

  const collectionRate = stats.expectedThisMonth > 0
    ? Math.round((stats.collectedThisMonth / stats.expectedThisMonth) * 100)
    : 0

  const rateColor = collectionRate >= 80 ? '#16a34a' : collectionRate >= 50 ? '#d97706' : '#dc2626'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatBillingPeriod(period)}</p>
        </div>
        <div
          className="text-right cursor-pointer"
          onClick={() => navigate('/billing')}
        >
          <div className="text-2xl font-bold" style={{ color: rateColor }}>{collectionRate}%</div>
          <div className="text-xs text-gray-400">taux de recouvrement</div>
        </div>
      </div>

      {/* 4 top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Clients actifs', value: stats.activeCustomers,
            sub: `/ ${stats.totalCustomers} total`, icon: Users, color: '#3b82f6', to: '/customers'
          },
          {
            label: 'Attendu ce mois', value: formatMoney(stats.expectedThisMonth),
            sub: formatBillingPeriod(period), icon: DollarSign, color: '#6b7280', to: '/billing'
          },
          {
            label: 'Encaissé', value: formatMoney(stats.collectedThisMonth),
            sub: `${collectionRate}%`, icon: TrendingUp, color: '#16a34a', to: '/payments'
          },
          {
            label: 'Solde restant', value: formatMoney(stats.outstandingBalance),
            sub: `${stats.unpaidCustomers} impayés`, icon: TrendingDown,
            color: stats.outstandingBalance > 0 ? '#dc2626' : '#16a34a', to: '/billing'
          },
        ].map(({ label, value, sub, icon: Icon, color, to }) => (
          <div
            key={label}
            onClick={() => navigate(to)}
            className="card p-4 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Section mini-panels — 3 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* CLIENTS */}
        <SectionPanel to="/customers" icon={Users} title="Clients" accent="#3b82f6">
          <KpiRow label="Actifs" value={stats.activeCustomers} />
          <KpiRow label="Suspendus" value={stats.suspendedCustomers} valueColor={stats.suspendedCustomers > 0 ? '#d97706' : undefined} />
          {sectorStats.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
              {sectorStats.map(s => (
                <div key={s.code} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{s.name}</span>
                  <span className="text-xs font-semibold text-gray-700">{s.active} clients</span>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* FACTURATION */}
        <SectionPanel to="/billing" icon={Receipt} title="Facturation" accent="#1B6C42">
          <KpiRow label="Total facturé" value={formatMoney(stats.expectedThisMonth)} />
          <KpiRow label="Encaissé" value={formatMoney(stats.collectedThisMonth)} valueColor="#16a34a" />
          <KpiRow
            label="Impayé"
            value={formatMoney(stats.outstandingBalance)}
            valueColor={stats.outstandingBalance > 0 ? '#dc2626' : '#16a34a'}
          />
          {stats.overdueCustomers > 0 && (
            <div className="mt-2 pt-2 border-t border-red-50">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-600 font-medium">{stats.overdueCustomers} charges en retard</span>
              </div>
            </div>
          )}
        </SectionPanel>

        {/* PAIEMENTS */}
        <SectionPanel to="/payments" icon={CreditCard} title="Paiements récents" accent="#8b5cf6">
          {recentPayments.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-1.5">
              {recentPayments.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-800 leading-tight">{p.name}</div>
                    <div className="text-xs text-gray-400">{formatDate(p.date)}</div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* COLLECTES */}
        <SectionPanel to="/collections" icon={Truck} title="Collectes" accent="#f59e0b">
          <KpiRow
            label="Aujourd'hui"
            value={stats.collectionsToday}
            sub="planifiées"
            valueColor={stats.collectionsToday > 0 ? '#d97706' : undefined}
          />
          <div className="mt-2 pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400">
              {stats.collectionsToday === 0
                ? 'Aucune collecte planifiée aujourd\'hui'
                : `${stats.collectionsToday} tournée${stats.collectionsToday > 1 ? 's' : ''} à effectuer`}
            </p>
          </div>
        </SectionPanel>

        {/* TOP DÉBITEURS */}
        <SectionPanel to="/billing" icon={AlertCircle} title="Débiteurs ce mois" accent="#ef4444">
          {topDebtors.length === 0 ? (
            <p className="text-xs text-emerald-600 font-medium py-2">Tous les clients sont à jour</p>
          ) : (
            <div className="space-y-1.5">
              {topDebtors.map(d => (
                <div key={d.id} className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 truncate max-w-[120px]">{d.name}</span>
                  <span className="text-xs font-semibold text-red-600">{formatMoney(d.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* SECTEURS */}
        <SectionPanel to="/reports" icon={Layers} title="Secteurs" accent="#0ea5e9">
          {sectorStats.map(s => (
            <div key={s.code} className="py-1.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{s.code} — {s.name}</span>
                <span className="text-xs text-gray-500">{s.active} clients</span>
              </div>
              {s.unpaidAmount > 0 && (
                <div className="flex justify-end">
                  <span className="text-xs text-red-500">{formatMoney(s.unpaidAmount)} impayé</span>
                </div>
              )}
            </div>
          ))}
        </SectionPanel>

      </div>

      {/* Monthly chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Évolution mensuelle</h2>
          <button
            onClick={() => navigate('/reports')}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            Voir rapport <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </div>
        {monthlyData.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-gray-400">
            <FileSpreadsheet className="w-8 h-8 opacity-40" />
            <p className="text-xs">Importez votre Excel pour voir l'historique</p>
            <button onClick={() => navigate('/import')} className="btn-primary text-xs px-3 py-1.5 mt-1">
              Import Excel
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barGap={3} barCategoryGap="35%">
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}k` : String(v)}
                width={42}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="expected" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="expected" />
              <Bar dataKey="collected" fill="#1B6C42" radius={[3, 3, 0, 0]} name="collected" />
              <Bar dataKey="outstanding" fill="#fca5a5" radius={[3, 3, 0, 0]} name="outstanding" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Alert: suspended customers */}
      {stats.suspendedCustomers > 0 && (
        <div
          onClick={() => navigate('/customers')}
          className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <Ban className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 flex-1">
            <strong>{stats.suspendedCustomers} client{stats.suspendedCustomers > 1 ? 's' : ''} suspendu{stats.suspendedCustomers > 1 ? 's' : ''}</strong> — cliquez pour voir la liste
          </p>
          <ChevronRight className="w-4 h-4 text-amber-500" />
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
