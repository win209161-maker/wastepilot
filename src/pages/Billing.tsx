import { useState, useEffect } from 'react'
import { Plus, ChevronLeft, ChevronRight, Zap, MessageCircle, Loader2, CheckCircle2, AlertTriangle, Clock, CreditCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PaymentForm } from '../components/PaymentForm'
import { useBilling, type ChargeRow } from '../hooks/useBilling'
import { formatMoney, formatBillingPeriod, currentBillingPeriod } from '../lib/utils'
import { supabase } from '../lib/supabase'

// ─── Add single charge form ────────────────────────────────────────────────────
function AddChargeForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    customer_id: '',
    billing_period: currentBillingPeriod(),
    monthly_price: '20000',
    months_billed: '1',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<{ id: string; last_name: string; first_name: string; subscriptions: { id: string; monthly_price: number }[] }[]>([])

  useEffect(() => {
    supabase.from('customers').select('id, last_name, first_name, subscriptions (id, monthly_price)')
      .eq('status', 'active').order('last_name')
      .then(({ data }) => setCustomers((data ?? []) as any))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const customer = customers.find(c => c.id === form.customer_id)
    const sub = customer?.subscriptions?.[0]
    if (!sub) { setError('Client ou abonnement introuvable'); return }
    const price = parseInt(form.monthly_price)
    const months = parseInt(form.months_billed)
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('billing_charges').insert({
      customer_id: form.customer_id,
      subscription_id: sub.id,
      billing_period: form.billing_period,
      monthly_price: price,
      months_billed: months,
      amount_due: price * months,
      amount_paid: 0,
    } as any)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>}
      <div>
        <label className="label">Client *</label>
        <select className="select" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} required>
          <option value="">— Sélectionner —</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Période</label>
          <input className="input font-mono" value={form.billing_period} onChange={e => setForm(f => ({ ...f, billing_period: e.target.value }))} pattern="\d{4}-\d{2}" placeholder="2026-01" required />
        </div>
        <div>
          <label className="label">Prix/mois (FG)</label>
          <input className="input" type="number" min="1" value={form.monthly_price} onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Nb mois</label>
          <input className="input" type="number" min="1" max="12" value={form.months_billed} onChange={e => setForm(f => ({ ...f, months_billed: e.target.value }))} required />
        </div>
      </div>
      <div className="p-3 rounded-xl" style={{ background: 'var(--color-sage)' }}>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Montant total</span>
          <span className="font-bold">{formatMoney(parseInt(form.monthly_price || '0') * parseInt(form.months_billed || '1'))}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={saving}>Annuler</button>
        <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Enregistrement...' : 'Créer la charge'}</button>
      </div>
    </form>
  )
}

// ─── AMÉLIORATION 1 — Auto-generate monthly billing ──────────────────────────
interface GeneratePreview {
  toCreate: { customerId: string; subId: string; name: string; price: number }[]
  alreadyExist: string[]
  noSub: string[]
}

function GenerateBillingModal({ period, onSuccess, onCancel }: {
  period: string; onSuccess: () => void; onCancel: () => void
}) {
  const [targetPeriod, setTargetPeriod] = useState(period)
  const [preview, setPreview] = useState<GeneratePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview() {
    setLoadingPreview(true)
    setError(null)
    setPreview(null)
    try {
      const [{ data: subs }, { data: existing }] = await Promise.all([
        supabase.from('subscriptions')
          .select('id, customer_id, monthly_price, customers!inner(first_name, last_name, status)')
          .eq('status', 'active')
          .eq('customers.status', 'active'),
        supabase.from('billing_charges')
          .select('customer_id')
          .eq('billing_period', targetPeriod),
      ])

      const existingIds = new Set((existing ?? []).map((e: any) => e.customer_id))
      const toCreate: GeneratePreview['toCreate'] = []
      const alreadyExist: string[] = []
      const noSub: string[] = []

      for (const s of (subs ?? []) as any[]) {
        const name = `${s.customers?.last_name ?? ''} ${s.customers?.first_name ?? ''}`.trim()
        if (existingIds.has(s.customer_id)) {
          alreadyExist.push(name)
        } else {
          toCreate.push({ customerId: s.customer_id, subId: s.id, name, price: s.monthly_price })
        }
      }

      setPreview({ toCreate, alreadyExist, noSub })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function generate() {
    if (!preview || preview.toCreate.length === 0) return
    setGenerating(true)
    setError(null)
    let count = 0

    const rows = preview.toCreate.map(r => ({
      customer_id: r.customerId,
      subscription_id: r.subId,
      billing_period: targetPeriod,
      monthly_price: r.price,
      months_billed: 1,
      amount_due: r.price,
      amount_paid: 0,
    }))

    const { error: err } = await supabase.from('billing_charges').insert(rows as any)
    if (err) { setError(err.message); setGenerating(false); return }
    count = rows.length
    setDone(count)
    setGenerating(false)
    setTimeout(() => { onSuccess() }, 1200)
  }

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-gray-600">
        Génère automatiquement une charge pour chaque abonnement actif sur la période sélectionnée.
        Les clients déjà facturés sont ignorés.
      </p>

      <div>
        <label className="label">Période à générer</label>
        <input
          className="input font-mono w-40"
          value={targetPeriod}
          onChange={e => { setTargetPeriod(e.target.value); setPreview(null); setDone(0) }}
          pattern="\d{4}-\d{2}"
          placeholder="2026-01"
        />
      </div>

      {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700">{error}</div>}

      {done > 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {done} charges créées avec succès
        </div>
      )}

      {preview && done === 0 && (
        <div className="space-y-3">
          {preview.toCreate.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                À créer — {preview.toCreate.length} clients
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-emerald-50 rounded-xl p-3">
                {preview.toCreate.map(r => (
                  <div key={r.customerId} className="flex justify-between text-xs">
                    <span className="text-gray-700">{r.name}</span>
                    <span className="font-semibold text-emerald-700">{formatMoney(r.price)}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Total: <strong>{formatMoney(preview.toCreate.reduce((s, r) => s + r.price, 0))}</strong>
              </div>
            </div>
          )}
          {preview.alreadyExist.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <strong>{preview.alreadyExist.length} clients</strong> déjà facturés ce mois — ignorés
              </div>
            </div>
          )}
          {preview.toCreate.length === 0 && (
            <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
              Tous les clients actifs sont déjà facturés pour cette période.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button className="btn-secondary flex-1" onClick={onCancel}>Annuler</button>
        {!preview ? (
          <button className="btn-primary flex-1" onClick={loadPreview} disabled={loadingPreview || !/^\d{4}-\d{2}$/.test(targetPeriod)}>
            {loadingPreview ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse...</> : 'Prévisualiser'}
          </button>
        ) : (
          <button
            className="btn-primary flex-1"
            onClick={generate}
            disabled={generating || preview.toCreate.length === 0 || done > 0}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</>
              : `Générer ${preview.toCreate.length} charges`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── AMÉLIORATION 2 — WhatsApp reminders ──────────────────────────────────────
interface UnpaidRow {
  name: string
  phone: string | null
  balance: number
  status: string
}

function WhatsAppModal({ period, onClose }: { period: string; onClose: () => void }) {
  const [rows, setRows] = useState<UnpaidRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msgTemplate, setMsgTemplate] = useState(
    `Bonjour {NOM}, votre facture de {MONTANT} pour {MOIS} est en attente. Merci de régulariser. — WastePilot Conakry`
  )

  useEffect(() => {
    supabase.from('billing_charges')
      .select(`amount_due, amount_paid, balance, status,
        customers (first_name, last_name, phone)`)
      .eq('billing_period', period)
      .in('status', ['unpaid', 'partial', 'overdue'])
      .order('status')
      .then(({ data }) => {
        const r: UnpaidRow[] = ((data ?? []) as any[]).map(c => ({
          name: `${c.customers?.last_name ?? ''} ${c.customers?.first_name ?? ''}`.trim(),
          phone: c.customers?.phone ?? null,
          balance: c.balance ?? (c.amount_due - c.amount_paid),
          status: c.status,
        }))
        setRows(r)
        setLoading(false)
      })
  }, [period])

  function buildMessage(row: UnpaidRow) {
    return msgTemplate
      .replace('{NOM}', row.name)
      .replace('{MONTANT}', formatMoney(row.balance))
      .replace('{MOIS}', formatBillingPeriod(period))
  }

  function openWhatsApp(row: UnpaidRow) {
    if (!row.phone) return
    // Strip non-digits, ensure Guinea prefix 224
    const digits = row.phone.replace(/\D/g, '')
    const number = digits.startsWith('224') ? digits : `224${digits}`
    const url = `https://wa.me/${number}?text=${encodeURIComponent(buildMessage(row))}`
    window.open(url, '_blank')
  }

  function copyAll() {
    const text = rows
      .filter(r => r.phone)
      .map(r => `${r.phone} — ${buildMessage(r)}`)
      .join('\n\n')
    navigator.clipboard.writeText(text)
  }

  const withPhone = rows.filter(r => r.phone)
  const noPhone = rows.filter(r => !r.phone)

  return (
    <div className="p-6 space-y-4">
      {/* Message template */}
      <div>
        <label className="label">Modèle de message</label>
        <textarea
          className="input resize-none text-xs font-mono"
          rows={3}
          value={msgTemplate}
          onChange={e => setMsgTemplate(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">
          Variables: <code className="bg-gray-100 px-1 rounded">{'{NOM}'}</code> <code className="bg-gray-100 px-1 rounded">{'{MONTANT}'}</code> <code className="bg-gray-100 px-1 rounded">{'{MOIS}'}</code>
        </p>
      </div>

      {loading ? (
        <LoadingState rows={3} />
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-xl text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Aucun client impayé pour cette période.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{rows.length} clients impayés</span>
            {withPhone.length > 0 && (
              <button onClick={copyAll} className="btn-secondary text-xs py-1.5 px-3">
                Copier tous les messages
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{r.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{r.phone ?? 'Pas de numéro'}</span>
                    <span className="text-xs font-semibold text-red-600">{formatMoney(r.balance)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status === 'overdue' ? 'retard' : r.status === 'partial' ? 'partiel' : 'impayé'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openWhatsApp(r)}
                  disabled={!r.phone}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#128C7E] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              </div>
            ))}
          </div>

          {noPhone.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>{noPhone.length} client(s)</strong> sans numéro de téléphone — ajoutez-le dans leur fiche.
              </p>
            </div>
          )}
        </>
      )}

      <button className="btn-secondary w-full" onClick={onClose}>Fermer</button>
    </div>
  )
}

// ─── Main Billing page ─────────────────────────────────────────────────────────
export function Billing() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState(currentBillingPeriod())
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  // Amélioration 3: inline payment
  const [payCharge, setPayCharge] = useState<ChargeRow | null>(null)
  // Amélioration 4: mark overdue
  const [overdueCount, setOverdueCount] = useState(0)
  const [showOverdueConfirm, setShowOverdueConfirm] = useState(false)
  const [markingOverdue, setMarkingOverdue] = useState(false)
  const { charges, loading, summary, refresh } = useBilling(period, statusFilter)

  function prevMonth() {
    const [y, m] = period.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function nextMonth() {
    const [y, m] = period.split('-').map(Number)
    const d = new Date(y, m, 1)
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  async function checkOverdue() {
    const { data } = await supabase
      .from('billing_charges')
      .select('id', { count: 'exact', head: true })
      .in('status', ['unpaid', 'partial'])
      .lt('billing_period', currentBillingPeriod())
    setOverdueCount((data as any)?.length ?? 0)
    // Use count from the response
    supabase.from('billing_charges')
      .select('id')
      .in('status', ['unpaid', 'partial'])
      .lt('billing_period', currentBillingPeriod())
      .then(({ data: rows }) => {
        setOverdueCount(rows?.length ?? 0)
        setShowOverdueConfirm(true)
      })
  }

  async function handleMarkOverdue() {
    setMarkingOverdue(true)
    const { data: rows } = await supabase
      .from('billing_charges')
      .select('id')
      .in('status', ['unpaid', 'partial'])
      .lt('billing_period', currentBillingPeriod())
    if (rows && rows.length > 0) {
      await supabase.from('billing_charges')
        .update({ status: 'overdue' } as any)
        .in('id', rows.map((r: any) => r.id))
    }
    setMarkingOverdue(false)
    setShowOverdueConfirm(false)
    refresh()
  }

  const unpaidCount = charges.filter(c => ['unpaid', 'partial', 'overdue'].includes(c.status)).length

  return (
    <div>
      <PageHeader
        title="Facturation"
        description="Gestion des charges mensuelles"
        actions={
          <div className="flex gap-2">
            <button
              className="btn-secondary relative"
              onClick={() => setShowWhatsApp(true)}
              title="Rappels WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              Rappels
              {unpaidCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unpaidCount > 9 ? '9+' : unpaidCount}
                </span>
              )}
            </button>
            <button className="btn-secondary" onClick={checkOverdue} title="Marquer en retard les mois précédents">
              <Clock className="w-4 h-4 text-orange-500" />
              Retards
            </button>
            <button className="btn-secondary" onClick={() => setShowGenerate(true)}>
              <Zap className="w-4 h-4 text-amber-500" />
              Générer
            </button>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Nouvelle charge
            </button>
          </div>
        }
      />

      {/* Period selector */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-xl hover:bg-gray-100" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="text-base font-semibold text-gray-900 min-w-[160px] text-center">
              {formatBillingPeriod(period)}
            </div>
            <button className="p-1.5 rounded-xl hover:bg-gray-100" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <select className="select sm:w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Tous</option>
            <option value="paid">Payé</option>
            <option value="partial">Partiel</option>
            <option value="unpaid">Impayé</option>
            <option value="overdue">En retard</option>
          </select>
          <div className="flex flex-wrap gap-4 ml-auto text-sm">
            <div><span className="text-gray-500">Attendu:</span> <span className="font-semibold ml-1">{formatMoney(summary.expected)}</span></div>
            <div><span className="text-gray-500">Encaissé:</span> <span className="font-semibold text-green-700 ml-1">{formatMoney(summary.collected)}</span></div>
            <div><span className="text-gray-500">Solde:</span> <span className="font-semibold text-red-600 ml-1">{formatMoney(summary.outstanding)}</span></div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingState /> : charges.length === 0 ? (
          <EmptyState
            title="Aucune charge pour cette période"
            description={`Cliquez sur "Générer" pour créer toutes les charges du mois automatiquement`}
          />
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
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charges.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => c.customer_id && navigate(`/customers/${c.customer_id}`)}
                  >
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {c.customers?.last_name} {c.customers?.first_name}
                      </div>
                      {c.months_billed > 1 && (
                        <div className="text-xs text-gray-400 mt-0.5">{c.months_billed} mois × {formatMoney(c.monthly_price)}</div>
                      )}
                    </td>
                    <td className="table-cell hidden md:table-cell text-gray-500">
                      {(c.customers as any)?.sectors?.code ?? '—'}
                    </td>
                    <td className="table-cell text-right font-medium">{formatMoney(c.amount_due)}</td>
                    <td className="table-cell text-right hidden sm:table-cell text-green-700">{formatMoney(c.amount_paid)}</td>
                    <td className="table-cell text-right">
                      <span className={c.balance > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                        {formatMoney(c.balance)}
                      </span>
                    </td>
                    <td className="table-cell"><StatusBadge status={c.status} /></td>
                    {/* Amélioration 3: inline pay button */}
                    <td className="table-cell">
                      {['unpaid', 'partial', 'overdue'].includes(c.status) && (
                        <button
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
                          style={{ background: 'var(--color-brand)', color: 'white' }}
                          onClick={e => { e.stopPropagation(); setPayCharge(c) }}
                          title="Enregistrer un paiement"
                        >
                          <CreditCard className="w-3 h-3" />
                          Payer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={showForm} title="Nouvelle charge" onClose={() => setShowForm(false)}>
        <AddChargeForm onSuccess={() => { setShowForm(false); refresh() }} onCancel={() => setShowForm(false)} />
      </Modal>

      <Modal open={showGenerate} title="⚡ Générer la facturation mensuelle" onClose={() => setShowGenerate(false)}>
        <GenerateBillingModal
          period={period}
          onSuccess={() => { setShowGenerate(false); refresh() }}
          onCancel={() => setShowGenerate(false)}
        />
      </Modal>

      <Modal open={showWhatsApp} title="💬 Rappels WhatsApp — impayés" onClose={() => setShowWhatsApp(false)}>
        <WhatsAppModal period={period} onClose={() => setShowWhatsApp(false)} />
      </Modal>

      {/* Amélioration 3: inline payment modal */}
      <Modal
        open={!!payCharge}
        title={`Paiement — ${payCharge?.customers?.last_name ?? ''} ${payCharge?.customers?.first_name ?? ''}`}
        onClose={() => setPayCharge(null)}
      >
        {payCharge && (
          <PaymentForm
            customerId={payCharge.customer_id}
            customerName={`${payCharge.customers?.last_name ?? ''} ${payCharge.customers?.first_name ?? ''}`}
            outstandingCharges={[payCharge as any]}
            onSuccess={() => { setPayCharge(null); refresh() }}
            onCancel={() => setPayCharge(null)}
          />
        )}
      </Modal>

      {/* Amélioration 4: overdue confirmation */}
      <ConfirmDialog
        open={showOverdueConfirm}
        title="Marquer les retards"
        description={
          overdueCount === 0
            ? 'Aucune charge impayée des mois précédents.'
            : `${overdueCount} charge(s) impayée(s) des mois précédents seront marquées "En retard".`
        }
        confirmLabel={markingOverdue ? 'Mise à jour...' : `Marquer ${overdueCount} retard(s)`}
        onConfirm={overdueCount > 0 ? handleMarkOverdue : () => setShowOverdueConfirm(false)}
        onCancel={() => setShowOverdueConfirm(false)}
      />
    </div>
  )
}
