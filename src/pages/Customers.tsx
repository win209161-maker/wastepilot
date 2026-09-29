import { useState } from 'react'
import { Plus, Search, Phone, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { CustomerForm } from '../components/CustomerForm'
import { useCustomers, useSectors } from '../hooks/useCustomers'
import { formatMoney, formatDate } from '../lib/utils'

export function Customers() {
  const navigate = useNavigate()
  const sectors = useSectors()
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    sector: 'all',
    paymentStatus: 'all',
  })

  const { customers, loading, error, refresh } = useCustomers(filters)

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`${customers.length} client(s) trouvé(s)`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Nouveau client
          </button>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <select
            className="select"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="paused">Pausé</option>
            <option value="cancelled">Résilié</option>
          </select>
          <select
            className="select"
            value={filters.sector}
            onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
          >
            <option value="all">Tous les secteurs</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
          <select
            className="select"
            value={filters.paymentStatus}
            onChange={e => setFilters(f => ({ ...f, paymentStatus: e.target.value }))}
          >
            <option value="all">Statut paiement</option>
            <option value="paid">Soldé</option>
            <option value="unpaid">Solde en cours</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="Aucun client"
            description="Commencez par ajouter vos premiers clients"
            icon={<User className="w-8 h-8" />}
            action={
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" />
                Nouveau client
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Client</th>
                  <th className="table-header hidden md:table-cell">N° Abonné</th>
                  <th className="table-header hidden lg:table-cell">Contact</th>
                  <th className="table-header hidden lg:table-cell">Secteur</th>
                  <th className="table-header">Prix/mois</th>
                  <th className="table-header">Solde</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header hidden md:table-cell">Dernier paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {c.last_name} {c.first_name}
                      </div>
                      {c.sectors && (
                        <div className="text-xs text-gray-400 mt-0.5">{c.sectors.code}</div>
                      )}
                    </td>
                    <td className="table-cell hidden md:table-cell text-gray-500 font-mono text-xs">
                      {c.subscriber_id ?? '—'}
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      {c.phone ? (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-gray-500">
                      {c.sectors?.name ?? '—'}
                    </td>
                    <td className="table-cell font-medium">
                      {c.monthly_price ? formatMoney(c.monthly_price) : '—'}
                    </td>
                    <td className="table-cell">
                      {c.current_balance > 0 ? (
                        <span className="text-red-600 font-semibold">{formatMoney(c.current_balance)}</span>
                      ) : (
                        <span className="text-green-600 font-medium">Soldé</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="table-cell hidden md:table-cell text-gray-500">
                      {formatDate(c.last_payment_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} title="Nouveau client" onClose={() => setShowForm(false)} size="lg">
        <CustomerForm
          sectors={sectors}
          onSuccess={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  )
}
