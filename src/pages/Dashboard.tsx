import { Users, TrendingDown, TrendingUp, Truck, AlertCircle, Ban, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { KpiCard } from '../components/ui/KpiCard'
import { LoadingState } from '../components/ui/LoadingState'
import { useDashboard } from '../hooks/useDashboard'
import { formatMoney, formatBillingPeriod, currentBillingPeriod } from '../lib/utils'

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function Dashboard() {
  const { stats, monthlyData, loading, error } = useDashboard()
  const period = currentBillingPeriod()

  if (loading) return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500">{formatBillingPeriod(period)}</p>
      </div>
      <LoadingState rows={6} />
    </div>
  )

  if (error) return (
    <div className="p-4 bg-red-50 rounded-lg text-sm text-red-700">
      Erreur: {error}
    </div>
  )

  if (!stats) return null

  const collectionRate = stats.expectedThisMonth > 0
    ? Math.round((stats.collectedThisMonth / stats.expectedThisMonth) * 100)
    : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500">{formatBillingPeriod(period)}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Clients actifs"
          value={stats.activeCustomers}
          subtitle={`${stats.totalCustomers} total`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <KpiCard
          title="Attendu ce mois"
          value={formatMoney(stats.expectedThisMonth)}
          subtitle={formatBillingPeriod(period)}
          icon={<DollarSign className="w-5 h-5" />}
          color="default"
        />
        <KpiCard
          title="Encaissé"
          value={formatMoney(stats.collectedThisMonth)}
          subtitle={`${collectionRate}% du total`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <KpiCard
          title="Solde restant"
          value={formatMoney(stats.outstandingBalance)}
          subtitle={`${stats.unpaidCustomers} clients impayés`}
          icon={<TrendingDown className="w-5 h-5" />}
          color={stats.outstandingBalance > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="En retard"
          value={stats.overdueCustomers}
          subtitle="charges overdue"
          icon={<AlertCircle className="w-5 h-5" />}
          color={stats.overdueCustomers > 0 ? 'orange' : 'default'}
        />
        <KpiCard
          title="Suspendus"
          value={stats.suspendedCustomers}
          subtitle="abonnements suspendus"
          icon={<Ban className="w-5 h-5" />}
          color={stats.suspendedCustomers > 0 ? 'yellow' : 'default'}
        />
        <KpiCard
          title="Collectes aujourd'hui"
          value={stats.collectionsToday}
          subtitle="planifiées"
          icon={<Truck className="w-5 h-5" />}
          color="blue"
        />
        <KpiCard
          title="Taux de recouvrement"
          value={`${collectionRate}%`}
          subtitle="ce mois"
          icon={<TrendingUp className="w-5 h-5" />}
          color={collectionRate >= 80 ? 'green' : collectionRate >= 50 ? 'yellow' : 'red'}
        />
      </div>

      {/* Monthly chart */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Évolution mensuelle</h2>
        {monthlyData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            Pas encore de données historiques
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barGap={4}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => (v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}k` : v)}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v) => v === 'expected' ? 'Attendu' : v === 'collected' ? 'Encaissé' : 'Restant'}
              />
              <Bar dataKey="expected" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="expected" />
              <Bar dataKey="collected" fill="#16a34a" radius={[3, 3, 0, 0]} name="collected" />
              <Bar dataKey="outstanding" fill="#fca5a5" radius={[3, 3, 0, 0]} name="outstanding" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
