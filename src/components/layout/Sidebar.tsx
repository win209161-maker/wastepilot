import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, Receipt, Truck,
  BarChart3, Settings, Trash2, Menu, X
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/',             label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/customers',   label: 'Clients',           icon: Users },
  { to: '/billing',     label: 'Facturation',       icon: Receipt },
  { to: '/payments',    label: 'Paiements',         icon: CreditCard },
  { to: '/collections', label: 'Collectes',         icon: Truck },
  { to: '/reports',     label: 'Rapports',          icon: BarChart3 },
  { to: '/import',      label: 'Import Excel',      icon: Trash2 },
  { to: '/settings',    label: 'Paramètres',        icon: Settings },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">WastePilot</div>
            <div className="text-xs text-gray-500">Gestion collecte</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">Alpha Yaya · Koloma</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r border-gray-200 bg-white h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white shadow-xl z-10">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  )
}

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-gray-900">WastePilot</span>
      </div>
      <button onClick={onMenuClick} className="p-1.5 rounded-lg hover:bg-gray-100">
        <Menu className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  )
}
