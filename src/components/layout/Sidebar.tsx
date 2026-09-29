import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, Receipt, Truck,
  BarChart3, Settings, FileSpreadsheet, Menu, X, LogOut
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

const NAV = [
  { to: '/',             label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/customers',   label: 'Clients',           icon: Users },
  { to: '/billing',     label: 'Facturation',       icon: Receipt },
  { to: '/payments',    label: 'Paiements',         icon: CreditCard },
  { to: '/collections', label: 'Collectes',         icon: Truck },
  { to: '/reports',     label: 'Rapports',          icon: BarChart3 },
  { to: '/import',      label: 'Import Excel',      icon: FileSpreadsheet },
  { to: '/settings',    label: 'Paramètres',        icon: Settings },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
      </svg>
    </div>
    <div>
      <div className="text-sm font-bold text-gray-900 font-serif">WastePilot</div>
      <div className="text-xs text-gray-400">Gestion collecte</div>
    </div>
  </div>
)

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const content = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn('sidebar-nav-item', isActive && 'active')
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 space-y-2">
        <p className="text-xs text-gray-400">Alpha Yaya · Koloma · Conakry</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col w-60 shrink-0 h-screen sticky top-0"
        style={{ background: 'var(--color-sage)', borderRight: '1px solid rgba(0,0,0,0.06)' }}
      >
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 shadow-xl z-10" style={{ background: 'var(--color-sage)' }}>
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/60"
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
    <div
      className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
      style={{ background: 'var(--color-sage)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <Logo />
      <button onClick={onMenuClick} className="p-1.5 rounded-lg hover:bg-white/60">
        <Menu className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  )
}
