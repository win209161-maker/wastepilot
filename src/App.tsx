import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Sidebar, MobileHeader } from './components/layout/Sidebar'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Customers } from './pages/Customers'
import { CustomerProfile } from './pages/CustomerProfile'
import { Billing } from './pages/Billing'
import { Payments } from './pages/Payments'
import { Collections } from './pages/Collections'
import { Reports } from './pages/Reports'
import { Import } from './pages/Import'
import { Settings } from './pages/Settings'

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-sage)' }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 lg:p-6 max-w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerProfile />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Still loading
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-sage)' }}>
        <div className="w-8 h-8 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: 'var(--color-brand)' }} />
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
