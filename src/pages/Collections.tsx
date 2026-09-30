import { useEffect, useState } from 'react'
import { Truck, CheckCircle2, XCircle, CalendarPlus, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
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
    if (!org) return
    supabase.from('sectors').select('id, name, code').eq('org_id', org.id).eq('active', true).order('name')
      .then(({ data }) => setSectors((data ?? []) as any))
  }, [org?.id])

  async function loadPreview() {
    if (!org) return
    setLoading(true)
    let q = supabase.from('customers')
      .select('id, first_name, last_name, subscriptions!inner(id, status)')
      .eq('org_id', org.id)
      .eq('status', 'active')
      .eq('subscriptions.status', 'active')
    if (sectorId !== 'all') q = q.eq('sector_id', sectorId)
    const [{ data: customers }, { data: existing }] = await Promise.all([
      q,
      supabase.from('collection_schedules').select('customer_id').eq('org_id', org.id).eq('scheduled_date', date),
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

// ─── Missed rollover modal ─────────────────────────────────────────────────────
type MissedRow = {
  id: string
  customer_id: string
  subscription_id: string
  scheduled_date: string
  customerName: string
  sectorCode: string | null
}

function MissedRolloverModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { org } = useOrg()
  const today = new Date().toISOString().split('T')[0]
  // Default reschedule date = tomorrow
  const tomorrow = new Date(new Date().getTime() + 86400000).toISOString().split('T')[0]

  const [missed, setMissed] = useState<MissedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [rescheduleDate, setRescheduleDate] = useState(tomorrow)
  const [rescheduling, setRescheduling] = useState(false)
  const [done, setDone] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return
    supabase
      .from('collection_schedules')
      .select(`id, customer_id, subscription_id, scheduled_date, customers (first_name, last_name, sectors (code))`)
      .eq('org_id', org.id)
      .eq('status', 'missed')
      .lte('scheduled_date', today)
      .order('scheduled_date')
      .then(({ data }) => {
        const rows: MissedRow[] = ((data ?? []) as any[]).map(s => ({
          id: s.id,
          customer_id: s.customer_id,
          subscription_id: s.subscription_id,
          scheduled_date: s.scheduled_date,
          customerName: `${s.customers?.last_name ?? ''} ${s.customers?.first_name ?? ''}`.trim(),
          sectorCode: s.customers?.sectors?.code ?? null,
        }))
        setMissed(rows)
        setLoading(false)
      })
  }, [org?.id])

  async function rescheduleAll() {
    if (!org || missed.length === 0 || !rescheduleDate) return
    setRescheduling(true)
    setError(null)

    // Check what's already scheduled on that date to avoid duplicates
    const { data: existing } = await supabase
      .from('collection_schedules')
      .select('customer_id')
      .eq('org_id', org.id)
      .eq('scheduled_date', rescheduleDate)

    const existingIds = new Set((existing ?? []).map((e: any) => e.customer_id))
    const toCreate = missed.filter(m => !existingIds.has(m.customer_id))
    const alreadyThere = missed.length - toCreate.length

    if (toCreate.length > 0) {
      const { error: insertErr } = await supabase.from('collection_schedules').insert(
        toCreate.map(m => ({
          org_id: org.id,
          customer_id: m.customer_id,
          subscription_id: m.subscription_id,
          scheduled_date: rescheduleDate,
          status: 'scheduled',
        })) as any
      )
      if (insertErr) {
        setError(insertErr.message)
        setRescheduling(false)
        return
      }
    }

    // Mark all original missed entries as rescheduled
    await supabase
      .from('collection_schedules')
      .update({ status: 'rescheduled' } as any)
      .in('id', missed.map(m => m.id))

    setDone(toCreate.length)
    setSkipped(alreadyThere)
    setRescheduling(false)
    setTimeout(() => { onSuccess() }, 1400)
  }

  const dateLabel = rescheduleDate
    ? new Date(rescheduleDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="p-6 space-y-4">
      {loading ? (
        <LoadingState rows={3} />
      ) : missed.length === 0 ? (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-xl text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Aucune collecte manquée — tout est à jour.
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            <strong>{missed.length} collecte(s) manquée(s)</strong> sur des dates passées.
            Choisissez la prochaine date pour les reprogrammer automatiquement.
          </p>

          {/* Date picker */}
          <div>
            <label className="label">Reprogrammer pour le</label>
            <input
              type="date"
              className="input sm:w-52"
              value={rescheduleDate}
              min={today}
              onChange={e => setRescheduleDate(e.target.value)}
            />
            {dateLabel && (
              <p className="text-xs text-gray-500 mt-1 capitalize">{dateLabel}</p>
            )}
          </div>

          {/* Missed list */}
          <div className="rounded-xl border border-red-100 overflow-hidden">
            <div className="px-3 py-2 bg-red-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                Collectes manquées — {missed.length}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {missed.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{s.customerName}</span>
                    {s.sectorCode && (
                      <span className="ml-2 text-xs text-gray-400 font-mono bg-gray-100 px-1.5 rounded">{s.sectorCode}</span>
                    )}
                  </div>
                  <span className="text-xs text-red-500 font-medium shrink-0 ml-2">
                    {new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {done > 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {done} collecte(s) reprogrammée(s) pour le {dateLabel}
              {skipped > 0 && <span className="text-xs font-normal ml-1">({skipped} déjà planifié(s) ce jour)</span>}
            </div>
          )}
        </>
      )}

      <div className="flex gap-3">
        <button className="btn-secondary flex-1 justify-center" onClick={onClose}>
          {done > 0 ? 'Fermer' : 'Annuler'}
        </button>
        {missed.length > 0 && done === 0 && (
          <button
            className="btn-primary flex-1 justify-center"
            onClick={rescheduleAll}
            disabled={rescheduling || !rescheduleDate}
          >
            {rescheduling
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Reprogrammation...</>
              : <><RefreshCw className="w-4 h-4" /> Reprogrammer {missed.length}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type ScheduleRow = CollectionSchedule & {
  customers: (Pick<Customer, 'first_name' | 'last_name' | 'concession' | 'reference'> & {
    sectors: Pick<Sector, 'code'> | null
  }) | null
}

// ─── Main Collections page ─────────────────────────────────────────────────────
export function Collections() {
  const { org } = useOrg()
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showMissed, setShowMissed] = useState(false)
  const [missedPastCount, setMissedPastCount] = useState(0)

  const today = new Date().toISOString().split('T')[0]

  function loadSchedules() {
    if (!org) return
    setLoading(true)
    let query = supabase
      .from('collection_schedules')
      .select(`*, customers (first_name, last_name, concession, reference, sectors (code))`)
      .eq('org_id', org.id)
      .eq('scheduled_date', dateFilter)
      .order('created_at')
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    query.then(({ data }) => {
      setSchedules((data ?? []) as ScheduleRow[])
      setLoading(false)
    })
  }

  function loadMissedPastCount() {
    if (!org) return
    supabase
      .from('collection_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'missed')
      .lte('scheduled_date', today)
      .then(({ count }) => setMissedPastCount(count ?? 0))
  }

  useEffect(() => {
    loadSchedules()
  }, [dateFilter, statusFilter, org?.id])

  useEffect(() => {
    loadMissedPastCount()
  }, [org?.id])

  async function markStatus(id: string, status: 'completed' | 'missed') {
    setUpdating(id)
    await supabase.from('collection_schedules')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null } as any)
      .eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    setUpdating(null)
    // Refresh missed count after a status change
    loadMissedPastCount()
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
          <div className="flex flex-wrap gap-2">
            {missedPastCount > 0 && (
              <button className="btn-secondary relative" onClick={() => setShowMissed(true)}>
                <RefreshCw className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Manquées</span>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {missedPastCount > 9 ? '9+' : missedPastCount}
                </span>
              </button>
            )}
            <button className="btn-primary" onClick={() => setShowGenerate(true)}>
              <CalendarPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Générer planning</span>
              <span className="sm:hidden">Planifier</span>
            </button>
          </div>
        }
      />

      {/* Missed-past banner */}
      {missedPastCount > 0 && (
        <button
          onClick={() => setShowMissed(true)}
          className="w-full mb-4 flex items-center gap-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {missedPastCount} collecte{missedPastCount > 1 ? 's' : ''} manquée{missedPastCount > 1 ? 's' : ''} — à reprogrammer
            </p>
            <p className="text-xs text-amber-600">
              Tapez ici pour les ajouter au prochain planning
            </p>
          </div>
          <RefreshCw className="w-4 h-4 text-amber-500 shrink-0" />
        </button>
      )}

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
        <button
          className="card p-3 text-center hover:border-amber-300 transition-colors"
          onClick={() => stats.missed > 0 ? setShowMissed(true) : undefined}
          style={{ cursor: stats.missed > 0 ? 'pointer' : 'default' }}
        >
          <div className={`text-lg font-bold ${stats.missed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.missed}</div>
          <div className="text-xs text-gray-500">Manquées</div>
          {stats.missed > 0 && (
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Reprogrammer →</div>
          )}
        </button>
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
                  <tr key={s.id} className={s.status === 'missed' ? 'bg-red-50/40' : ''}>
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
                      {s.status === 'missed' && (
                        <button
                          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                          onClick={() => setShowMissed(true)}
                          title="Reprogrammer cette collecte"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reprog.
                        </button>
                      )}
                      {s.status === 'completed' && (
                        <span className="text-xs text-gray-400">
                          {s.completed_at ? formatDate(s.completed_at.split('T')[0]) : '—'}
                        </span>
                      )}
                      {s.status === 'rescheduled' && (
                        <span className="text-xs text-blue-500 font-medium">Reprogrammé ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate modal */}
      <Modal open={showGenerate} title="📅 Générer le planning de collectes" onClose={() => setShowGenerate(false)}>
        <GenerateSchedulesModal
          onSuccess={() => {
            setShowGenerate(false)
            loadSchedules()
          }}
          onClose={() => setShowGenerate(false)}
        />
      </Modal>

      {/* Missed rollover modal */}
      <Modal open={showMissed} title="🔄 Collectes manquées — reprogrammer" onClose={() => setShowMissed(false)}>
        <MissedRolloverModal
          onClose={() => setShowMissed(false)}
          onSuccess={() => {
            setShowMissed(false)
            loadSchedules()
            loadMissedPastCount()
          }}
        />
      </Modal>
    </div>
  )
}
