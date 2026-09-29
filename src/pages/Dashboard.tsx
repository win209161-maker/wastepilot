import { useNavigate } from 'react-router-dom'
import { ChevronRight, Users, TrendingDown, TrendingUp, Truck, Receipt, CreditCard, Layers } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { LoadingState } from '../components/ui/LoadingState'
import { useDashboard } from '../hooks/useDashboard'
import { formatMoney, formatBillingPeriod, currentBillingPeriod } from '../lib/utils'

// ─── Shared tooltip ───────────────────────────────────────────────────────────
function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-gray-500">{p.name ?? p.dataKey}:</span>
          <span className="font-medium">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Clickable panel wrapper ───────────────────────────────────────────────────
function Panel({
  to, title, icon: Icon, accent = '#1B6C42', topRight, children
}: {
  to: string; title: string; icon: any; accent?: string; topRight?: React.ReactNode; children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(to)}
      className="card p-4 cursor-pointer group flex flex-col gap-3"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: accent }} />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {topRight}
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Gauge circle for collection rate ────────────────────────────────────────
function RateGauge({ rate }: { rate: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (rate / 100) * circ
  const color = rate >= 80 ? '#1B6C42' : rate >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{rate}%</text>
      </svg>
      <p className="text-xs text-gray-500 -mt-1">recouvrement</p>
    </div>
  )
}

// ─── Horizontal bar for debtors ────────────────────────────────────────────
function DebtBar({ name, balance, max }: { name: string; balance: number; max: number }) {
  const pct = max > 0 ? (balance / max) * 100 : 0
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600 truncate max-w-[120px]">{name}</span>
        <span className="text-xs font-semibold text-red-600">{formatMoney(balance)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { stats, monthlyData, topDebtors, dailyPayments, sectorStats, loading, error } = useDashboard()
  const period = currentBillingPeriod()
  const navigate = useNavigate()

  if (loading) return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Tableau de bord</h1>
        <p className="text-sm text-gray-500">{formatBillingPeriod(period)}</p>
      </div>
      <LoadingState rows={8} />
    </div>
  )

  if (error) return (
    <div className="p-4 bg-red-50 rounded-xl text-sm text-red-700 border border-red-200">Erreur: {error}</div>
  )

  if (!stats) return null

  const collectionRate = stats.expectedThisMonth > 0
    ? Math.round((stats.collectedThisMonth / stats.expectedThisMonth) * 100)
    : 0

  // Data for clients pie
  const clientPieData = [
    { name: 'Actifs', value: stats.activeCustomers, color: '#1B6C42' },
    { name: 'Suspendus', value: stats.suspendedCustomers, color: '#f59e0b' },
    ...(stats.pausedCustomers > 0 ? [{ name: 'Pausés', value: stats.pausedCustomers, color: '#94a3b8' }] : []),
  ].filter(d => d.value > 0)

  // Data for facturation bar
  const billingBarData = [
    { name: 'Attendu', value: stats.expectedThisMonth, fill: '#e2e8f0' },
    { name: 'Encaissé', value: stats.collectedThisMonth, fill: '#1B6C42' },
    { name: 'Restant', value: stats.outstandingBalance, fill: '#fca5a5' },
  ]

  // Sector bar data
  const sectorBarData = sectorStats.map(s => ({
    code: s.code,
    Clients: s.active,
    Impayé: Math.round(s.unpaidAmount / 1000),
  }))

  const maxDebt = topDebtors[0]?.balance ?? 1

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatBillingPeriod(period)}</p>
        </div>
        <div className="text-right">
          <div
            className="text-2xl font-bold"
            style={{ color: collectionRate >= 80 ? '#1B6C42' : collectionRate >= 50 ? '#d97706' : '#dc2626' }}
          >
            {collectionRate}%
          </div>
          <div className="text-xs text-gray-400">recouvrement</div>
        </div>
      </div>

      {/* Top 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Clients actifs', value: stats.activeCustomers, sub: `/ ${stats.totalCustomers}`, icon: Users, color: '#3b82f6', to: '/customers' },
          { label: 'Attendu', value: formatMoney(stats.expectedThisMonth), sub: formatBillingPeriod(period), icon: Receipt, color: '#6b7280', to: '/billing' },
          { label: 'Encaissé', value: formatMoney(stats.collectedThisMonth), sub: `${collectionRate}%`, icon: TrendingUp, color: '#1B6C42', to: '/payments' },
          { label: 'Solde restant', value: formatMoney(stats.outstandingBalance), sub: `${stats.unpaidCustomers} impayés`, icon: TrendingDown, color: stats.outstandingBalance > 0 ? '#dc2626' : '#1B6C42', to: '/billing' },
        ].map(({ label, value, sub, icon: Icon, color, to }) => (
          <div key={label} onClick={() => navigate(to)} className="card p-4 cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">{label}</span>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* 3-column chart panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* CLIENTS — Pie chart */}
        <Panel to="/customers" icon={Users} title="Clients" accent="#3b82f6"
          topRight={<span className="text-xs font-bold text-gray-700">{stats.totalCustomers}</span>}
        >
          <div className="flex items-center gap-4">
            <PieChart width={90} height={90}>
              <Pie data={clientPieData} cx={40} cy={40} innerRadius={22} outerRadius={40}
                dataKey="value" strokeWidth={0}
              >
                {clientPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-1.5 flex-1">
              {clientPieData.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs text-gray-500">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* FACTURATION — Bar chart + gauge */}
        <Panel to="/billing" icon={Receipt} title="Facturation" accent="#1B6C42"
          topRight={<span className="text-xs text-gray-400">{formatBillingPeriod(period)}</span>}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={billingBarData} barCategoryGap="25%">
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {billingBarData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: any) => formatMoney(v)}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f1f5f9' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <RateGauge rate={collectionRate} />
          </div>
          {stats.overdueCustomers > 0 && (
            <div className="text-xs text-red-500 font-medium">{stats.overdueCustomers} en retard</div>
          )}
        </Panel>

        {/* PAIEMENTS — Area chart 7 derniers jours */}
        <Panel to="/payments" icon={CreditCard} title="Paiements — 7 jours" accent="#8b5cf6"
          topRight={
            <span className="text-xs font-bold text-gray-700">
              {formatMoney(dailyPayments.reduce((s, d) => s + d.amount, 0))}
            </span>
          }
        >
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={dailyPayments} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any) => formatMoney(v)}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f1f5f9' }}
              />
              <Area type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2}
                fill="url(#payGrad)" name="Encaissé" dot={{ r: 3, fill: '#8b5cf6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {dailyPayments.every(d => d.amount === 0) && (
            <p className="text-xs text-gray-400 -mt-2">Aucun paiement cette semaine</p>
          )}
        </Panel>

        {/* SECTEURS — Grouped bar chart */}
        <Panel to="/reports" icon={Layers} title="Secteurs" accent="#0ea5e9">
          {sectorBarData.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Aucun secteur configuré</p>
          ) : (
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={sectorBarData} barCategoryGap="30%" barGap={3}>
                <XAxis dataKey="code" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any, name: any) => name === 'Impayé' ? [`${v}k FG`, name] : [`${v} clients`, name]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f1f5f9' }}
                />
                <Bar dataKey="Clients" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Impayé" fill="#fca5a5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 -mt-1">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#0ea5e9]" /><span className="text-xs text-gray-400">Clients</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#fca5a5]" /><span className="text-xs text-gray-400">Impayé (k FG)</span></div>
          </div>
        </Panel>

        {/* COLLECTES — Donut */}
        <Panel to="/collections" icon={Truck} title="Collectes" accent="#f59e0b"
          topRight={<span className="text-xs text-gray-400">aujourd'hui</span>}
        >
          {(stats.collectionsToday + stats.collectionsCompleted + stats.collectionsMissed) === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1">
              <Truck className="w-8 h-8 text-gray-200" />
              <p className="text-xs text-gray-400 text-center">Aucune collecte planifiée</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={90} height={90}>
                <Pie
                  data={[
                    { name: 'Planifiées', value: stats.collectionsToday, color: '#f59e0b' },
                    { name: 'Effectuées', value: stats.collectionsCompleted, color: '#1B6C42' },
                    { name: 'Manquées', value: stats.collectionsMissed, color: '#ef4444' },
                  ].filter(d => d.value > 0)}
                  cx={40} cy={40} innerRadius={22} outerRadius={40} dataKey="value" strokeWidth={0}
                >
                  {[
                    { color: '#f59e0b' }, { color: '#1B6C42' }, { color: '#ef4444' }
                  ].map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: 'Planifiées', value: stats.collectionsToday, color: '#f59e0b' },
                  { label: 'Effectuées', value: stats.collectionsCompleted, color: '#1B6C42' },
                  { label: 'Manquées', value: stats.collectionsMissed, color: '#ef4444' },
                ].map(d => (
                  <div key={d.label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-gray-500">{d.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* TOP DÉBITEURS — Horizontal progress bars */}
        <Panel to="/billing" icon={TrendingDown} title="Top débiteurs" accent="#ef4444">
          {topDebtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1">
              <TrendingUp className="w-8 h-8 text-emerald-300" />
              <p className="text-xs text-emerald-600 font-medium">Tous les clients sont à jour</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topDebtors.map(d => (
                <DebtBar key={d.id} name={d.name} balance={d.balance} max={maxDebt} />
              ))}
            </div>
          )}
        </Panel>

      </div>

      {/* ÉVOLUTION MENSUELLE — full width bar chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Évolution mensuelle</h2>
          <button onClick={() => navigate('/reports')} className="text-xs text-gray-400 hover:text-gray-600">
            Voir rapport →
          </button>
        </div>
        {monthlyData.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-3 text-gray-400">
            <p className="text-xs">Importez votre Excel pour voir l'historique mensuel</p>
            <button onClick={e => { e.stopPropagation(); navigate('/import') }} className="btn-primary text-xs px-3 py-1.5">
              Import Excel →
            </button>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barGap={3} barCategoryGap="30%">
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={42}
                  tickFormatter={v => v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}k` : String(v)}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="expected" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="Attendu" />
                <Bar dataKey="collected" fill="#1B6C42" radius={[3, 3, 0, 0]} name="Encaissé" />
                <Bar dataKey="outstanding" fill="#fca5a5" radius={[3, 3, 0, 0]} name="Restant" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2 justify-center">
              {[['#e2e8f0', 'Attendu'], ['#1B6C42', 'Encaissé'], ['#fca5a5', 'Restant']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                  <span className="text-xs text-gray-500">{l}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
