import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CustomisationHub from './pages/CustomisationHub'
import CategoryPage from './pages/CategoryPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminCustomerDetail from './pages/admin/AdminCustomerDetail'
import AdminQuotes from './pages/admin/AdminQuotes'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/hub" element={<CustomisationHub />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:customerId" element={<AdminCustomerDetail />} />
          <Route path="quotes" element={<AdminQuotes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
