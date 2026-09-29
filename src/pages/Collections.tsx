import { useEffect, useState } from 'react'
import { Truck, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import type { CollectionSchedule, Customer, Sector } from '../types/database'

type ScheduleRow = CollectionSchedule & {
  customers: (Pick<Customer, 'first_name' | 'last_name' | 'concession' | 'reference'> & {
    sectors: Pick<Sector, 'code'> | null
  }) | null
}

export function Collections() {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    let query = supabase
      .from('collection_schedules')
      .select(`*, customers (first_name, last_name, concession, reference, sectors (code))`)
      .eq('scheduled_date', dateFilter)
      .order('created_at')

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    query.then(({ data }) => {
      setSchedules((data ?? []) as ScheduleRow[])
      setLoading(false)
    })
  }, [dateFilter, statusFilter])

  async function markStatus(id: string, status: 'completed' | 'missed') {
    setUpdating(id)
    await supabase.from('collection_schedules')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null } as any)
      .eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    setUpdating(null)
  }

  const stats = {
    total: schedules.length,
    completed: schedules.filter(s => s.status === 'completed').length,
    missed: schedules.filter(s => s.status === 'missed').length,
    scheduled: schedules.filter(s => s.status === 'scheduled').length,
  }

  return (
    <div>
      <PageHeader title="Collectes" description="Suivi des collectes de déchets" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{stats.scheduled}</div>
          <div className="text-xs text-gray-500">Planifiées</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-green-600">{stats.completed}</div>
          <div className="text-xs text-gray-500">Effectuées</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-red-600">{stats.missed}</div>
          <div className="text-xs text-gray-500">Manquées</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          className="input sm:w-48"
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        />
        <select className="select sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="scheduled">Planifié</option>
          <option value="completed">Effectué</option>
          <option value="missed">Manqué</option>
          <option value="rescheduled">Reprogrammé</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingState /> : schedules.length === 0 ? (
          <EmptyState
            title="Aucune collecte pour cette date"
            description="Changez la date ou ajoutez des planifications"
            icon={<Truck className="w-8 h-8" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Client</th>
                  <th className="table-header hidden md:table-cell">Secteur</th>
                  <th className="table-header hidden lg:table-cell">Localisation</th>
                  <th className="table-header hidden sm:table-cell">Agent</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map(s => (
                  <tr key={s.id}>
                    <td className="table-cell font-medium text-gray-900">
                      {s.customers?.last_name} {s.customers?.first_name}
                    </td>
                    <td className="table-cell hidden md:table-cell text-gray-500">
                      {s.customers?.sectors?.code ?? '—'}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-gray-500 text-xs">
                      {[s.customers?.concession, s.customers?.reference].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="table-cell hidden sm:table-cell text-gray-500">
                      {s.assigned_worker ?? '—'}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="table-cell">
                      {s.status === 'scheduled' && (
                        <div className="flex gap-2">
                          <button
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50"
                            onClick={() => markStatus(s.id, 'completed')}
                            disabled={updating === s.id}
                            title="Marquer effectué"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                            onClick={() => markStatus(s.id, 'missed')}
                            disabled={updating === s.id}
                            title="Marquer manqué"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {s.status !== 'scheduled' && (
                        <span className="text-xs text-gray-400">
                          {s.completed_at ? formatDate(s.completed_at.split('T')[0]) : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
