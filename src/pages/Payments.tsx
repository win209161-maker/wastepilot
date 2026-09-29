import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { usePayments } from '../hooks/usePayments'
import { formatMoney, formatDate } from '../lib/utils'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  other: 'Autre',
}

export function Payments() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const { payments, total, loading } = usePayments(page, 25)

  return (
    <div>
      <PageHeader
        title="Paiements"
        description={`${total} paiement(s) au total`}
      />

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

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">{page * 25 + 1}–{Math.min((page + 1) * 25, total)} sur {total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                Précédent
              </button>
              <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 25 >= total}>
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
