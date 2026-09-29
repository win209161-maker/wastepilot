import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const CONFIG: Record<string, { label: string; className: string }> = {
  active:    { label: 'Actif',     className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspendu',  className: 'bg-red-100 text-red-800' },
  paused:    { label: 'Pausé',     className: 'bg-yellow-100 text-yellow-800' },
  cancelled: { label: 'Résilié',   className: 'bg-gray-100 text-gray-600' },
  paid:      { label: 'Payé',      className: 'bg-green-100 text-green-800' },
  partial:   { label: 'Partiel',   className: 'bg-yellow-100 text-yellow-800' },
  unpaid:    { label: 'Impayé',    className: 'bg-red-100 text-red-800' },
  overdue:   { label: 'En retard', className: 'bg-orange-100 text-orange-800' },
  waived:    { label: 'Annulé',    className: 'bg-gray-100 text-gray-600' },
  completed: { label: 'Effectué',  className: 'bg-green-100 text-green-800' },
  scheduled: { label: 'Planifié',  className: 'bg-blue-100 text-blue-800' },
  missed:    { label: 'Manqué',    className: 'bg-red-100 text-red-800' },
  rescheduled: { label: 'Reprogrammé', className: 'bg-yellow-100 text-yellow-800' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = CONFIG[status?.toLowerCase()] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', config.className, className)}>
      {config.label}
    </span>
  )
}
