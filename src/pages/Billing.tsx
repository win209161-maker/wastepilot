import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { useBilling } from '../hooks/useBilling'
import { formatMoney, formatBillingPeriod, currentBillingPeriod } from '../lib/utils'
import { supabase } from '../lib/supabase'

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

  useState(() => {
    supabase.from('customers').select('id, last_name, first_name, subscriptions (id, monthly_price)')
      .eq('status', 'active').order('last_name')
      .then(({ data }) => setCustomers((data ?? []) as any))
  })

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
      {error && <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">{error}</div>}
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
      <div className="p-3 bg-gray-50 rounded-lg">
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

export function Billing() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState(currentBillingPeriod())
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
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

  return (
    <div>
      <PageHeader
        title="Facturation"
        description="Gestion des charges mensuelles"
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Nouvelle charge
          </button>
        }
      />

      {/* Period selector */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-gray-100" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="text-base font-semibold text-gray-900 min-w-[160px] text-center">
              {formatBillingPeriod(period)}
            </div>
            <button className="p-1.5 rounded-lg hover:bg-gray-100" onClick={nextMonth}>
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
          <div className="flex gap-4 ml-auto text-sm">
            <div><span className="text-gray-500">Attendu:</span> <span className="font-semibold ml-1">{formatMoney(summary.expected)}</span></div>
            <div><span className="text-gray-500">Encaissé:</span> <span className="font-semibold text-green-700 ml-1">{formatMoney(summary.collected)}</span></div>
            <div><span className="text-gray-500">Solde:</span> <span className="font-semibold text-red-600 ml-1">{formatMoney(summary.outstanding)}</span></div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingState /> : charges.length === 0 ? (
          <EmptyState title="Aucune charge pour cette période" description="Créez des charges ou changez de période" />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charges.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
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
                      {c.customers?.sectors?.code ?? '—'}
                    </td>
                    <td className="table-cell text-right font-medium">{formatMoney(c.amount_due)}</td>
                    <td className="table-cell text-right hidden sm:table-cell text-green-700">{formatMoney(c.amount_paid)}</td>
                    <td className="table-cell text-right">
                      <span className={c.balance > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                        {formatMoney(c.balance)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} title="Nouvelle charge" onClose={() => setShowForm(false)}>
        <AddChargeForm onSuccess={() => { setShowForm(false); refresh() }} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
