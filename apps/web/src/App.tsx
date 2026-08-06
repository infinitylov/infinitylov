import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { ActivateLicensePage } from './pages/ActivateLicensePage'
import { RescueLicensePage } from './pages/RescueLicensePage'
import { AdminShell } from './components/AdminShell'
import { ResellerShell } from './components/ResellerShell'
import { AdminDashboardPage } from './pages/admin/DashboardPage'
import { AdminLicensesPage } from './pages/admin/LicensesPage'
import { AdminUsersPage } from './pages/admin/UsersPage'
import { AdminWebhooksPage } from './pages/admin/WebhooksPage'
import { AdminResellersPage } from './pages/admin/ResellersPage'
import { AdminPacksPage } from './pages/admin/PacksPage'
import { ResellerTokensPage } from './pages/reseller/TokensPage'
import { ResellerBuyPage } from './pages/reseller/BuyPage'
import { ResellerLicensesPage } from './pages/reseller/LicensesPage'
import { ResellerLoginPage } from './pages/reseller/LoginPage'
import { ResellerRegisterPage } from './pages/reseller/RegisterPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ativar-licenca" element={<ActivateLicensePage />} />
        <Route path="/resgatar-licenca" element={<RescueLicensePage />} />
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="licencas" element={<AdminLicensesPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="revendedores" element={<AdminResellersPage />} />
          <Route path="packs" element={<AdminPacksPage />} />
          <Route path="webhooks" element={<AdminWebhooksPage />} />
        </Route>
        <Route path="/revendedor/login" element={<ResellerLoginPage />} />
        <Route path="/revendedor/cadastro" element={<ResellerRegisterPage />} />
        <Route path="/revendedor" element={<ResellerShell />}>
          <Route index element={<ResellerTokensPage />} />
          <Route path="comprar" element={<ResellerBuyPage />} />
          <Route path="licencas" element={<ResellerLicensesPage />} />
        </Route>
        <Route path="/membros/*" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
