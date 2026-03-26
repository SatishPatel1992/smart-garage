import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobList from './pages/Jobs/JobList';
import JobDetail from './pages/Jobs/JobDetail';
import CreateJob from './pages/Jobs/CreateJob';
import Billing from './pages/Billing';
import CustomerList from './pages/Customers/CustomerList';
import CustomerProfile from './pages/Customers/CustomerProfile';
import AddCustomer from './pages/Customers/AddCustomer';
import Estimates from './pages/Estimates';
import Inventory from './pages/Inventory';
import Procurement from './pages/Procurement';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Users from './pages/Users';
import CreditNotes from './pages/CreditNotes';
import Communications from './pages/Communications';
import ServiceReminders from './pages/ServiceReminders';
import VehicleMakes from './pages/VehicleMakes';
import PublicEstimate from './pages/PublicEstimate';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/public/estimate/:estimateId" element={<PublicEstimate />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="jobs" element={<ProtectedRoute section="jobs"><JobList /></ProtectedRoute>} />
        <Route path="jobs/new" element={<ProtectedRoute section="jobs"><CreateJob /></ProtectedRoute>} />
        <Route path="jobs/:jobId" element={<ProtectedRoute section="jobs"><JobDetail /></ProtectedRoute>} />
        <Route path="billing" element={<ProtectedRoute section="billing"><Billing /></ProtectedRoute>} />
        <Route path="customers" element={<ProtectedRoute section="customers"><CustomerList /></ProtectedRoute>} />
        <Route path="customers/new" element={<ProtectedRoute section="customers"><AddCustomer /></ProtectedRoute>} />
        <Route path="customers/:customerId" element={<ProtectedRoute section="customers"><CustomerProfile /></ProtectedRoute>} />
        <Route path="estimates" element={<ProtectedRoute section="estimates"><Estimates /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute section="inventory"><Inventory /></ProtectedRoute>} />
        <Route path="procurement" element={<ProtectedRoute section="procurement"><Procurement /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute section="payments"><Payments /></ProtectedRoute>} />
        <Route path="credit-notes" element={<ProtectedRoute section="creditNotes"><CreditNotes /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute section="reports"><Reports /></ProtectedRoute>} />
        <Route path="communications" element={<ProtectedRoute section="communications"><Communications /></ProtectedRoute>} />
        <Route path="service-reminders" element={<ProtectedRoute section="serviceReminders"><ServiceReminders /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute section="settings"><Settings /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute section="profile"><Profile /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute section="users"><Users /></ProtectedRoute>} />
        <Route path="vehicle-makes" element={<ProtectedRoute section="vehicleMakes"><VehicleMakes /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
