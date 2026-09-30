import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Payment, Customer } from '../types/database'

export type PaymentRow = Payment & {
  customers: Pick<Customer, 'first_name' | 'last_name' | 'subscriber_id'> | null
}

export function usePayments(page = 0, pageSize = 20) {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const from = page * pageSize
    const to = from + pageSize - 1

    supabase
      .from('payments')
      .select(`*, customers (first_name, last_name, subscriber_id)`, { count: 'exact' })
      .order('payment_date', { ascending: false })
      .range(from, to)
      .then(({ data, count }) => {
        setPayments((data ?? []) as PaymentRow[])
        setTotal(count ?? 0)
        setLoading(false)
      })
  }, [page, pageSize])

  return { payments, total, loading }
}

export interface RecordPaymentInput {
  orgId: string
  customerId: string
  amount: number
  paymentMethod: string
  paymentDate: string
  reference?: string
  notes?: string
}

export async function recordPayment(input: RecordPaymentInput): Promise<{ error?: string; paymentId?: string; coveredPeriods?: string[] }> {
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      org_id: input.orgId,
      customer_id: input.customerId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      payment_date: input.paymentDate,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (payErr) return { error: payErr.message }

  const { data: charges, error: chargeErr } = await supabase
    .from('billing_charges')
    .select('*')
    .eq('customer_id', input.customerId)
    .in('status', ['unpaid', 'partial', 'overdue'])
    .order('billing_period', { ascending: true })

  if (chargeErr) return { error: chargeErr.message }

  let remaining = input.amount
  const coveredPeriods: string[] = []
  for (const charge of charges ?? []) {
    if (remaining <= 0) break
    const canApply = Math.min(remaining, charge.balance)
    if (canApply <= 0) continue

    await supabase.from('payment_allocations').insert({
      payment_id: payment.id,
      charge_id: charge.id,
      amount: canApply,
    })

    const newPaid = charge.amount_paid + canApply
    await supabase.from('billing_charges')
      .update({ amount_paid: newPaid } as any)
      .eq('id', (charge as any).id)

    coveredPeriods.push(charge.billing_period)
    remaining -= canApply
  }

  return { paymentId: payment.id, coveredPeriods }
}
