import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { PaymentForm } from '../components/PaymentForm'
import { useCustomerBilling } from '../hooks/useBilling'
import { formatMoney, formatDate, formatBillingPeriod } from '../lib/utils'
import type { Customer, Sector, Subscription } from '../types/database'

type FullCustomer = Customer & {
  sectors: Sector | null
  subscriptions: Subscription[]
}

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<FullCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)

  const { charges, loading: chargesLoading } = useCustomerBilling(id!)

  useEffect(() => {
    if (!id) return
    supabase
      .from('customers')
      .select('*, sectors (*), subscriptions (*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setCustomer(data as unknown as FullCustomer)
        setLoading(false)
      })
  }, [id])

  const totalDue = charges.reduce((s, c) => s + c.amount_due, 0)
  const totalPaid = charges.reduce((s, c) => s + c.amount_paid, 0)
  const totalBalance = totalDue - totalPaid
  const activeSub = customer?.subscriptions.find(s => s.status === 'active')

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
          <button className="btn-secondary" onClick={() => setShowPayment(true)}>
            <CreditCard className="w-4 h-4" />
            Enregistrer paiement
          </button>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
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
              <div className="flex justify-between">
                <span className="text-gray-500">Prix mensuel</span>
                <span className="font-semibold">{formatMoney(activeSub.monthly_price)}</span>
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

      <Modal open={showPayment} title="Enregistrer un paiement" onClose={() => setShowPayment(false)}>
        <PaymentForm
          customerId={customer.id}
          customerName={`${customer.last_name} ${customer.first_name}`}
          outstandingCharges={charges.filter(c => c.status !== 'paid' && c.status !== 'waived')}
          onSuccess={() => {
            setShowPayment(false)
            window.location.reload()
          }}
          onCancel={() => setShowPayment(false)}
        />
      </Modal>
    </div>
  )
}
