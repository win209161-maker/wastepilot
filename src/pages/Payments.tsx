import { useState, useEffect, useRef } from 'react'
import { CreditCard, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { PaymentForm } from '../components/PaymentForm'
import { usePayments } from '../hooks/usePayments'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { formatMoney, formatDate, currentBillingPeriod } from '../lib/utils'
import type { BillingCharge } from '../types/database'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  other: 'Autre',
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────
function PaymentStats() {
  const { org } = useOrg()
  const [todayTotal, setTodayTotal] = useState<number | null>(null)
  const [monthTotal, setMonthTotal] = useState<number | null>(null)
  const [monthCount, setMonthCount] = useState<number | null>(null)

  useEffect(() => {
    if (!org) return
    const today = new Date().toISOString().split('T')[0]
    const period = currentBillingPeriod()
    const monthStart = `${period}-01`

    Promise.all([
      supabase.from('payments').select('amount').eq('org_id', org.id).eq('payment_date', today),
      supabase.from('payments').select('amount').eq('org_id', org.id).gte('payment_date', monthStart),
    ]).then(([todayRes, monthRes]) => {
      const tTotal = (todayRes.data ?? []).reduce((s: number, p: any) => s + p.amount, 0)
      const mData = monthRes.data ?? []
      const mTotal = (mData as any[]).reduce((s: number, p: any) => s + p.amount, 0)
      setTodayTotal(tTotal)
      setMonthTotal(mTotal)
      setMonthCount(mData.length)
    })
  }, [org?.id])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div className="card p-4">
        <div className="text-xs text-gray-500 mb-1">Encaissé aujourd'hui</div>
        <div className="text-lg font-bold" style={{ color: 'var(--color-brand)' }}>
          {todayTotal === null ? '—' : formatMoney(todayTotal)}
        </div>
      </div>
      <div className="card p-4">
        <div className="text-xs text-gray-500 mb-1">Ce mois</div>
        <div className="text-lg font-bold text-gray-900">
          {monthTotal === null ? '—' : formatMoney(monthTotal)}
        </div>
      </div>
      <div className="card p-4">
        <div className="text-xs text-gray-500 mb-1">Paiements ce mois</div>
        <div className="text-lg font-bold text-gray-900">
          {monthCount === null ? '—' : monthCount}
        </div>
      </div>
    </div>
  )
}

// ─── New payment modal (customer search) ───────────────────────────────────────
interface SearchResult { id: string; name: string; subscriber_id: string | null; sector: string | null }

function NewPaymentModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { org } = useOrg()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [charges, setCharges] = useState<BillingCharge[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, subscriber_id, sectors (code)')
        .eq('org_id', org!.id)
        .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,subscriber_id.ilike.%${query}%`)
        .eq('status', 'active')
        .limit(10)
      setResults(((data ?? []) as any[]).map(c => ({
        id: c.id,
        name: `${c.last_name} ${c.first_name}`,
        subscriber_id: c.subscriber_id,
        sector: c.sectors?.code ?? null,
      })))
      setSearching(false)
    }, 300)
  }, [query])

  async function selectCustomer(r: SearchResult) {
    setSelected(r)
    setResults([])
    setQuery('')
    const { data } = await supabase
      .from('billing_charges')
      .select('*')
      .eq('customer_id', r.id)
      .in('status', ['unpaid', 'partial', 'overdue'])
      .order('billing_period', { ascending: true })
    setCharges((data ?? []) as BillingCharge[])
  }

  if (selected) {
    return (
      <PaymentForm
        customerId={selected.id}
        customerName={selected.name}
        outstandingCharges={charges}
        onSuccess={() => { onSuccess(); onClose() }}
        onCancel={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-gray-500">Recherchez un client pour enregistrer son paiement.</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Nom, prénom ou N° abonné..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-gray-300 animate-spin" style={{ borderTopColor: 'var(--color-brand)' }} />
        )}
      </div>
      {results.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.id}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left border-b last:border-b-0 border-gray-100 transition-colors"
              onClick={() => selectCustomer(r)}
            >
              <div>
                <div className="text-sm font-medium text-gray-900">{r.name}</div>
                {r.subscriber_id && <div className="text-xs font-mono text-gray-400">{r.subscriber_id}</div>}
              </div>
              {r.sector && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{r.sector}</span>}
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">Aucun client trouvé</p>
      )}
      <button className="btn-secondary w-full" onClick={onClose}>Annuler</button>
    </div>
  )
}

// ─── Main Payments page ────────────────────────────────────────────────────────
export function Payments() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const { payments, total, loading } = usePayments(page, 25)

  return (
    <div>
      <PageHeader
        title="Paiements"
        description={`${total} paiement(s) au total`}
        actions={
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            Nouveau paiement
          </button>
        }
      />

      <PaymentStats />

      <div className="card overflow-hidden">
        {loading ? <LoadingState /> : payments.length === 0 ? (
          <EmptyState
            title="Aucun paiement enregistré"
            description="Les paiements apparaîtront ici"
            icon={<CreditCard className="w-8 h-8" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Date</th>
                  <th className="table-header">Client</th>
                  <th className="table-header hidden md:table-cell">N° Abonné</th>
                  <th className="table-header text-right">Montant</th>
                  <th className="table-header hidden sm:table-cell">Mode</th>
                  <th className="table-header hidden lg:table-cell">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => p.customer_id && navigate(`/customers/${p.customer_id}`)}
                  >
                    <td className="table-cell text-gray-600">{formatDate(p.payment_date)}</td>
                    <td className="table-cell font-medium text-gray-900">
                      {p.customers ? `${p.customers.last_name} ${p.customers.first_name}` : '—'}
                    </td>
                    <td className="table-cell hidden md:table-cell font-mono text-xs text-gray-400">
                      {p.customers?.subscriber_id ?? '—'}
                    </td>
                    <td className="table-cell text-right font-semibold text-green-700">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="table-cell hidden sm:table-cell text-gray-500">
                      {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-gray-400 text-xs">
                      {p.reference ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">{page * 25 + 1}–{Math.min((page + 1) * 25, total)} sur {total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Précédent</button>
              <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 25 >= total}>Suivant</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={showNew} title="Nouveau paiement" onClose={() => setShowNew(false)}>
        <NewPaymentModal
          onSuccess={() => { setShowNew(false); setPage(0) }}
          onClose={() => setShowNew(false)}
        />
      </Modal>
    </div>
  )
}
