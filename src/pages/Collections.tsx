import { useEffect, useState } from 'react'
import { Truck, CheckCircle2, XCircle, CalendarPlus, Loader2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { formatDate } from '../lib/utils'
import type { CollectionSchedule, Customer, Sector } from '../types/database'

// ─── Generate schedules modal ──────────────────────────────────────────────────
function GenerateSchedulesModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { org } = useOrg()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [sectorId, setSectorId] = useState('all')
  const [sectors, setSectors] = useState<{ id: string; name: string; code: string }[]>([])
  const [preview, setPreview] = useState<{ id: string; name: string; subId: string }[] | null>(null)
  const [existingCount, setExistingCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(0)

  useEffect(() => {
    supabase.from('sectors').select('id, name, code').eq('active', true).order('name')
      .then(({ data }) => setSectors((data ?? []) as any))
  }, [])

  async function loadPreview() {
    setLoading(true)
    let q = supabase.from('customers')
      .select('id, first_name, last_name, subscriptions!inner(id, status)')
      .eq('status', 'active')
      .eq('subscriptions.status', 'active')
    if (sectorId !== 'all') q = q.eq('sector_id', sectorId)
    const [{ data: customers }, { data: existing }] = await Promise.all([
      q,
      supabase.from('collection_schedules').select('customer_id').eq('scheduled_date', date),
    ])
    const existingIds = new Set((existing ?? []).map((e: any) => e.customer_id))
    const toCreate = ((customers ?? []) as any[])
      .filter(c => !existingIds.has(c.id))
      .map(c => ({ id: c.id, name: `${c.last_name} ${c.first_name}`, subId: c.subscriptions[0]?.id }))
    setPreview(toCreate)
    setExistingCount(existingIds.size)
    setLoading(false)
  }

  async function generate() {
    if (!preview || preview.length === 0) return
    setGenerating(true)
    const rows = preview.map(c => ({
      org_id: org!.id,
      customer_id: c.id,
      subscription_id: c.subId,
      scheduled_date: date,
      status: 'scheduled',
    }))
    await supabase.from('collection_schedules').insert(rows as any)
    setDone(rows.length)
    setGenerating(false)
    setTimeout(() => { onSuccess() }, 1000)
  }

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-gray-500">
        Génère une fiche de collecte pour chaque client actif à la date choisie.
        Les clients déjà planifiés ce jour sont ignorés.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date de collecte</label>
          <input className="input" type="date" value={date} onChange={e => { setDate(e.target.value); setPreview(null); setDone(0) }} />
        </div>
        <div>
          <label className="label">Secteur</label>
          <select className="select" value={sectorId} onChange={e => { setSectorId(e.target.value); setPreview(null); setDone(0) }}>
            <option value="all">Tous les secteurs</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
      </div>

      {done > 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {done} collectes planifiées avec succès
        </div>
      )}

      {preview && done === 0 && (
        <div className="space-y-2">
          {preview.length > 0 ? (
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                À planifier — {preview.length} clients
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.map(c => <div key={c.id} className="text-xs text-gray-700">{c.name}</div>)}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
              Tous les clients actifs sont déjà planifiés ce jour.
            </div>
          )}
          {existingCount > 0 && (
            <p className="text-xs text-amber-600">{existingCount} client(s) déjà planifié(s) ce jour — ignorés.</p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
        {!preview ? (
          <button className="btn-primary flex-1" onClick={loadPreview} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse...</> : 'Prévisualiser'}
          </button>
        ) : (
          <button className="btn-primary flex-1" onClick={generate} disabled={generating || preview.length === 0 || done > 0}>
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</> : `Planifier ${preview.length} collectes`}
          </button>
        )}
      </div>
    </div>
  )
}

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
  const [showGenerate, setShowGenerate] = useState(false)

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
      <PageHeader
        title="Collectes"
        description="Suivi des collectes de déchets"
        actions={
          <button className="btn-primary" onClick={() => setShowGenerate(true)}>
            <CalendarPlus className="w-4 h-4" />
            Générer planning
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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

      <Modal open={showGenerate} title="📅 Générer le planning de collectes" onClose={() => setShowGenerate(false)}>
        <GenerateSchedulesModal
          onSuccess={() => {
            setShowGenerate(false)
            setLoading(true)
            supabase.from('collection_schedules')
              .select(`*, customers (first_name, last_name, concession, reference, sectors (code))`)
              .eq('scheduled_date', dateFilter)
              .then(({ data }) => { setSchedules((data ?? []) as ScheduleRow[]); setLoading(false) })
          }}
          onClose={() => setShowGenerate(false)}
        />
      </Modal>
    </div>
  )
}
