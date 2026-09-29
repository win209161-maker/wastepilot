import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-GN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FG'
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatBillingPeriod(period: string): string {
  const [year, month] = period.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date)
}

export function currentBillingPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function parseMultiMonthValue(raw: string | number | null): {
  monthlyPrice: number
  monthsBilled: number
  totalAmount: number
} | null {
  if (raw == null) return null
  const str = String(raw).trim()
  const match = str.match(/^(\d+)x(\d+)$/i)
  if (match) {
    const months = parseInt(match[1])
    const price = parseInt(match[2])
    return { monthlyPrice: price, monthsBilled: months, totalAmount: months * price }
  }
  const num = parseFloat(str.replace(/\s/g, ''))
  if (!isNaN(num)) {
    return { monthlyPrice: num, monthsBilled: 1, totalAmount: num }
  }
  return null
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active': return 'badge-green'
    case 'suspended': return 'badge-red'
    case 'paused': return 'badge-yellow'
    case 'cancelled': return 'badge-gray'
    case 'paid': return 'badge-green'
    case 'partial': return 'badge-yellow'
    case 'unpaid': return 'badge-red'
    case 'overdue': return 'badge-orange'
    case 'waived': return 'badge-gray'
    case 'completed': return 'badge-green'
    case 'scheduled': return 'badge-blue'
    case 'missed': return 'badge-red'
    case 'rescheduled': return 'badge-yellow'
    default: return 'badge-gray'
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Actif',
    suspended: 'Suspendu',
    paused: 'Pausé',
    cancelled: 'Résilié',
    paid: 'Payé',
    partial: 'Partiel',
    unpaid: 'Impayé',
    overdue: 'En retard',
    waived: 'Annulé',
    completed: 'Effectué',
    scheduled: 'Planifié',
    missed: 'Manqué',
    rescheduled: 'Reprogrammé',
  }
  return labels[status?.toLowerCase()] || status
}
