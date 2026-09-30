import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, CreditCard, Pencil, Check, X, Download, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { PaymentForm } from '../components/PaymentForm'
import { CustomerForm } from '../components/CustomerForm'
import { useCustomerBilling } from '../hooks/useBilling'
import { useSectors } from '../hooks/useCustomers'
import { formatMoney, formatDate, formatBillingPeriod } from '../lib/utils'
import { generateReceipt, downloadPdf, shareOnWhatsApp, type ReceiptData } from '../lib/pdf'
import type { Customer, Sector, Subscription } from '../types/database'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  other: 'Autre',
}

type FullCustomer = Customer & {
  sectors: Sector | null
  subscriptions: Subscription[]
}

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { org } = useOrg()
  const [customer, setCustomer] = useState<FullCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const sectors = useSectors()

  const { charges, loading: chargesLoading } = useCustomerBilling(id!)
  const [payments, setPayments] = useState<any[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  function loadPayments() {
    if (!id || !org) return
    supabase.from('payments')
      .select('*, payment_allocations(billing_charges(billing_period))')
      .eq('org_id', org.id)
      .eq('customer_id', id)
      .order('payment_date', { ascending: false })
      .then(({ data }) => { setPayments(data ?? []); setPaymentsLoading(false) })
  }

  function reloadCustomer() {
    if (!id || !org) return
    supabase.from('customers').select('*, sectors (*), subscriptions (*)')
      .eq('org_id', org.id)
      .eq('id', id).single()
      .then(({ data }) => setCustomer(data as unknown as FullCustomer))
  }

  useEffect(() => {
    if (!id || !org) return
    supabase
      .from('customers')
      .select('*, sectors (*), subscriptions (*)')
      .eq('org_id', org.id)
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setCustomer(data as unknown as FullCustomer)
        setLoading(false)
      })
    loadPayments()
  }, [id, org?.id])

  const totalDue = charges.reduce((s, c) => s + c.amount_due, 0)
  const totalPaid = charges.reduce((s, c) => s + c.amount_paid, 0)
  const totalBalance = totalDue - totalPaid
  const activeSub = customer?.subscriptions.find(s => s.status === 'active')

  function handleDownloadReceipt(p: any) {
    if (!customer) return
    const periods: string[] = (p.payment_allocations ?? [])
      .map((a: any) => a.billing_charges?.billing_period)
      .filter(Boolean)
    const data: ReceiptData = {
      paymentId: p.id,
      customerName: `${customer.last_name} ${customer.first_name}`,
      subscriberId: customer.subscriber_id ?? null,
      phone: customer.phone ?? null,
      amount: p.amount,
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      reference: p.reference ?? null,
      periods,
    }
    const doc = generateReceipt(data)
    downloadPdf(doc, `Recu-WP-${p.payment_date}-${customer.last_name}.pdf`)
  }

  async function handleWhatsAppReceipt(p: any) {
    if (!customer) return
    const periods: string[] = (p.payment_allocations ?? [])
      .map((a: any) => a.billing_charges?.billing_period)
      .filter(Boolean)
    const data: ReceiptData = {
      paymentId: p.id,
      customerName: `${customer.last_name} ${customer.first_name}`,
      subscriberId: customer.subscriber_id ?? null,
      phone: customer.phone ?? null,
      amount: p.amount,
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      reference: p.reference ?? null,
      periods,
    }
    const doc = generateReceipt(data)
    const filename = `Recu-WP-${p.payment_date}-${customer.last_name}.pdf`
    const text = [
      `WastePilot Conakry`,
      `RECU DE PAIEMENT N WP-R-${p.id.slice(-8).toUpperCase()}`,
      ``,
      `Client: ${customer.last_name} ${customer.first_name}`,
      `Montant recu: ${formatMoney(p.amount)} FG`,
      `Date: ${new Date(p.payment_date).toLocaleDateString('fr-FR')}`,
      `Mode: ${METHOD_LABEL[p.payment_method] ?? p.payment_method}`,
      ...(p.reference ? [`Reference: ${p.reference}`] : []),
      ...(periods.length > 0 ? [`Periode(s): ${periods.map(formatBillingPeriod).join(', ')}`] : []),
      ``,
      `Merci pour votre paiement. - WastePilot Conakry`,
    ].join('\n')
    await shareOnWhatsApp(doc, filename, { phone: customer.phone, text })
  }

  if (loading) return <LoadingState />

  if (!customer) return (
    <div className="text-sm text-gray-500">Client introuvable</div>
  )

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </button>

      {/* Header */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-gray-900">
                {customer.last_name} {customer.first_name}
              </h1>
              <StatusBadge status={customer.status} />
            </div>
            {customer.subscriber_id && (
              <p className="text-xs font-mono text-gray-500 mb-2">{customer.subscriber_id}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {customer.phone}
                </div>
              )}
              {customer.sectors && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {customer.sectors.name} — Sect. {customer.sectors.code}
                </div>
              )}
              {customer.concession && (
                <div className="text-gray-500">{customer.concession}</div>
              )}
              {customer.reference && (
                <div className="text-gray-500">{customer.reference}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowEdit(true)}>
              <Pencil className="w-4 h-4" />
              Modifier
            </button>
            <button className="btn-primary" onClick={() => setShowPayment(true)}>
              <CreditCard className="w-4 h-4" />
              Paiement
            </button>
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="card p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Total facturé</div>
          <div className="text-lg font-bold text-gray-900">{formatMoney(totalDue)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Total payé</div>
          <div className="text-lg font-bold text-green-700">{formatMoney(totalPaid)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Solde restant</div>
          <div className={`text-lg font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatMoney(totalBalance)}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Subscription info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Abonnement</h2>
          {activeSub ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Prix mensuel</span>
                {editingPrice ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="input w-28 py-1 text-xs text-right"
                      type="number"
                      min="1000"
                      max="10000000"
                      step="1"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="p-1 rounded-lg hover:bg-green-50 text-green-600"
                      disabled={savingPrice}
                      onClick={async () => {
                        const price = parseInt(newPrice)
                        if (isNaN(price) || price < 1000 || price > 10000000) return
                        setSavingPrice(true)
                        await supabase.from('subscriptions').update({ monthly_price: price } as any).eq('id', activeSub.id)
                        setSavingPrice(false)
                        setEditingPrice(false)
                        reloadCustomer()
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 rounded-lg hover:bg-red-50 text-red-400" onClick={() => setEditingPrice(false)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{formatMoney(activeSub.monthly_price)}</span>
                    <button
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      onClick={() => { setNewPrice(String(activeSub.monthly_price)); setEditingPrice(true) }}
                      title="Modifier le prix"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Début</span>
                <span>{formatDate(activeSub.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fréquence</span>
                <span>{activeSub.service_frequency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statut</span>
                <StatusBadge status={activeSub.status} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun abonnement actif</p>
          )}
        </div>

        {/* Billing history */}
        <div className="card lg:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Historique de facturation</h2>
          </div>
          {chargesLoading ? (
            <LoadingState rows={3} />
          ) : charges.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Aucune facturation</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Période</th>
                    <th className="table-header text-right">Dû</th>
                    <th className="table-header text-right">Payé</th>
                    <th className="table-header text-right">Solde</th>
                    <th className="table-header">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {charges.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        {formatBillingPeriod(c.billing_period)}
                        {c.months_billed > 1 && (
                          <span className="ml-1 text-xs text-gray-400">×{c.months_billed}</span>
                        )}
                      </td>
                      <td className="table-cell text-right">{formatMoney(c.amount_due)}</td>
                      <td className="table-cell text-right text-green-700">{formatMoney(c.amount_paid)}</td>
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
      </div>

      {/* Payment history */}
      <div className="card overflow-hidden mt-4">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Paiements effectués</h2>
          <span className="text-xs text-gray-400">{payments.length} paiement{payments.length !== 1 ? 's' : ''}</span>
        </div>
        {paymentsLoading ? (
          <LoadingState rows={3} />
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Aucun paiement enregistré</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Montant</th>
                  <th className="table-header hidden sm:table-cell">Mode</th>
                  <th className="table-header hidden md:table-cell">Référence</th>
                  <th className="table-header text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{formatDate(p.payment_date)}</td>
                    <td className="table-cell text-right font-semibold text-green-700">{formatMoney(p.amount)}</td>
                    <td className="table-cell hidden sm:table-cell text-gray-500">{METHOD_LABEL[p.payment_method] ?? p.payment_method}</td>
                    <td className="table-cell hidden md:table-cell text-gray-400 text-xs">{p.reference ?? '—'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadReceipt(p)}
                          title="Télécharger le reçu PDF"
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span className="hidden sm:inline">Reçu</span>
                        </button>
                        {customer?.phone && (
                          <button
                            onClick={() => handleWhatsAppReceipt(p)}
                            title="Envoyer reçu par WhatsApp"
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showPayment} title="Enregistrer un paiement" onClose={() => setShowPayment(false)}>
        <PaymentForm
          customerId={customer.id}
          customerName={`${customer.last_name} ${customer.first_name}`}
          outstandingCharges={charges.filter(c => c.status !== 'paid' && c.status !== 'waived')}
          phone={customer.phone}
          subscriberId={customer.subscriber_id}
          onSuccess={() => {
            setShowPayment(false)
            loadPayments()
            window.location.reload()
          }}
          onCancel={() => setShowPayment(false)}
        />
      </Modal>

      <Modal open={showEdit} title="Modifier le client" onClose={() => setShowEdit(false)} size="lg">
        <CustomerForm
          sectors={sectors}
          customerId={customer.id}
          defaultValues={{
            last_name: customer.last_name,
            first_name: customer.first_name,
            phone: customer.phone ?? '',
            subscriber_id: customer.subscriber_id ?? '',
            neighborhood: customer.neighborhood ?? '',
            sector_id: customer.sector_id ?? '',
            concession: customer.concession ?? '',
            reference: customer.reference ?? '',
            address: customer.address ?? '',
            request_date: customer.request_date ?? '',
            status: customer.status,
          }}
          onSuccess={() => { setShowEdit(false); reloadCustomer() }}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>
    </div>
  )
}
