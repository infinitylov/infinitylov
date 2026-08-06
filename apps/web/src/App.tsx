import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { ActivateLicensePage } from './pages/ActivateLicensePage'
import { AdminShell } from './components/AdminShell'
import { AdminDashboardPage } from './pages/admin/DashboardPage'
import { AdminLicensesPage } from './pages/admin/LicensesPage'
import { AdminUsersPage } from './pages/admin/UsersPage'
import { AdminWebhooksPage } from './pages/admin/WebhooksPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ativar-licenca" element={<ActivateLicensePage />} />
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="licencas" element={<AdminLicensesPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="revendedores" element={<Navigate to="/admin" replace />} />
          <Route path="webhooks" element={<AdminWebhooksPage />} />
        </Route>
        <Route path="/membros/*" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
