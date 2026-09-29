import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar, MobileHeader } from './components/layout/Sidebar'
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
    <div className="flex min-h-screen bg-gray-50">
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
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
