import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Statement from './pages/Statement';
import NewReferral from './pages/NewReferral';
import MaterialApoio from './pages/MaterialApoio';
import DiretaCertificacao from './pages/DiretaCertificacao';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPartners from './pages/admin/Partners';
import AdminReferrals from './pages/admin/Referrals';
import AdminCommissions from './pages/admin/Commissions';
import AdminPayments from './pages/admin/Payments';
import AdminProducts from './pages/admin/Products';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-movv-gradient flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return children;
}

function RequireAccounting({ children }) {
  const { user } = useAuth();
  if (!user?.is_admin && user?.type !== 'accounting') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="extrato"              element={<Statement />} />
          <Route path="indicar"              element={<NewReferral />} />
          <Route path="material-apoio"       element={<MaterialApoio />} />
          <Route path="direta-certificacao"  element={<RequireAccounting><DiretaCertificacao /></RequireAccounting>} />
          <Route path="admin"                element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="admin/parceiros"      element={<RequireAdmin><AdminPartners /></RequireAdmin>} />
          <Route path="admin/indicacoes"     element={<RequireAdmin><AdminReferrals /></RequireAdmin>} />
          <Route path="admin/comissoes"      element={<RequireAdmin><AdminCommissions /></RequireAdmin>} />
          <Route path="admin/pagamentos"     element={<RequireAdmin><AdminPayments /></RequireAdmin>} />
          <Route path="admin/produtos"       element={<RequireAdmin><AdminProducts /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
