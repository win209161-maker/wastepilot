import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; label: string }
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue' | 'orange'
  className?: string
}

const colorMap = {
  default: 'bg-gray-50 text-gray-700',
  green:   'bg-green-50 text-green-700',
  red:     'bg-red-50 text-red-700',
  yellow:  'bg-yellow-50 text-yellow-700',
  blue:    'bg-blue-50 text-blue-700',
  orange:  'bg-orange-50 text-orange-700',
}

export function KpiCard({ title, value, subtitle, icon, color = 'default', className }: KpiCardProps) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={cn('p-2.5 rounded-lg ml-3 shrink-0', colorMap[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
