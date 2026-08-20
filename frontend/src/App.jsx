import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Statement from './pages/Statement';
import NewReferral from './pages/NewReferral';
import MaterialApoio from './pages/MaterialApoio';
import DiretaCertificacao from './pages/DiretaCertificacao';
import MyEmployees from './pages/MyEmployees';
import MovvOffice from './pages/MovvOffice';
import MovvCobrancas from './pages/MovvCobrancas';
import MovvSuprimentos from './pages/MovvSuprimentos';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPartners from './pages/admin/Partners';
import AdminReferrals from './pages/admin/Referrals';
import AdminCommissions from './pages/admin/Commissions';
import AdminPayments from './pages/admin/Payments';
import AdminProducts from './pages/admin/Products';
import AdminInterest from './pages/admin/Interest';
import AdminInternalCommissions from './pages/admin/InternalCommissions';
import AdminIndicadores from './pages/admin/AdminIndicadores';
import DiretaDashboardAdmin from './pages/admin/Direta/DiretaDashboard';
import DiretaVendasAdmin from './pages/admin/Direta/DiretaVendas';
import DiretaContabilidadesAdmin from './pages/admin/Direta/DiretaContabilidades';
import MinhasComissoes from './pages/MinhasComissoes';
import DiretaFernandoDashboard from './pages/direta/Dashboard';
import DiretaFernandoMinhasVendas from './pages/direta/MinhasVendas';
import DiretaFernandoAtividades from './pages/direta/Atividades';
import MovvCafe from './pages/MovvCafe';
import AlterarSenha from './pages/AlterarSenha';
import TrocarSenhaObrigatorio from './pages/TrocarSenhaObrigatorio';
// Páginas públicas
import SejaIndicador from './pages/SejaIndicador';
import CadastroIndicador from './pages/CadastroIndicador';
import TermosIndicador from './pages/TermosIndicador';
// Páginas do indicador
import IndicadorDashboard from './pages/indicador/Dashboard';
import IndicadorIndicar from './pages/indicador/Indicar';
import IndicadorMinhasIndicacoes from './pages/indicador/MinhasIndicacoes';
import IndicadorProdutosAzul from './pages/indicador/ProdutosAzul';
import IndicadorSimulador from './pages/indicador/Simulador';
import IndicadorMaterialApoio from './pages/indicador/MaterialApoio';
import IndicadorMeusPagamentos from './pages/indicador/MeusPagamentos';
import IndicadorPerfil from './pages/indicador/Perfil';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div className="min-h-screen bg-movv-gradient flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  // Indicadores não passam pelo fluxo de troca obrigatória de senha
  if (user.type !== 'indicator' && user.must_change_password && location.pathname !== '/trocar-senha-obrigatorio') {
    return <Navigate to="/trocar-senha-obrigatorio" replace />;
  }
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

function RequireInternal({ children }) {
  const { user } = useAuth();
  if (user?.type !== 'internal') return <Navigate to="/" replace />;
  return children;
}

function RequireComercialFull({ children }) {
  const { user } = useAuth();
  if (user?.type !== 'internal' || user?.role !== 'comercial_full') return <Navigate to="/" replace />;
  return children;
}

function RequireIndicator({ children }) {
  const { user } = useAuth();
  if (user?.type !== 'indicator') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Páginas públicas */}
        <Route path="/login"             element={<Login />} />
        <Route path="/seja-indicador"    element={<SejaIndicador />} />
        <Route path="/cadastro-indicador" element={<CadastroIndicador />} />
        <Route path="/termos-indicador"   element={<TermosIndicador />} />

        <Route path="/trocar-senha-obrigatorio" element={
          <RequireAuth><TrocarSenhaObrigatorio /></RequireAuth>
        } />

        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="extrato"              element={<Statement />} />
          <Route path="meus-funcionarios"   element={<RequireAccounting><MyEmployees /></RequireAccounting>} />
          <Route path="indicar"              element={<NewReferral />} />
          <Route path="material-apoio"       element={<MaterialApoio />} />
          <Route path="direta-certificacao"  element={<RequireAccounting><DiretaCertificacao /></RequireAccounting>} />
          <Route path="movv-office"          element={<MovvOffice />} />
          <Route path="movv-cobrancas"       element={<MovvCobrancas />} />
          <Route path="movv-suprimentos"     element={<MovvSuprimentos />} />
          <Route path="admin"                element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="admin/parceiros"      element={<RequireAdmin><AdminPartners /></RequireAdmin>} />
          <Route path="admin/indicacoes"     element={<RequireAdmin><AdminReferrals /></RequireAdmin>} />
          <Route path="admin/comissoes"      element={<RequireAdmin><AdminCommissions /></RequireAdmin>} />
          <Route path="admin/interesse"      element={<RequireAdmin><AdminInterest /></RequireAdmin>} />
          <Route path="admin/pagamentos"     element={<RequireAdmin><AdminPayments /></RequireAdmin>} />
          <Route path="admin/produtos"          element={<RequireAdmin><AdminProducts /></RequireAdmin>} />
          <Route path="admin/comissoes-internas" element={<RequireAdmin><AdminInternalCommissions /></RequireAdmin>} />
          <Route path="admin/indicadores"   element={<RequireAdmin><AdminIndicadores /></RequireAdmin>} />
          <Route path="admin/direta"             element={<RequireAdmin><DiretaDashboardAdmin /></RequireAdmin>} />
          <Route path="admin/direta/vendas"      element={<RequireAdmin><DiretaVendasAdmin /></RequireAdmin>} />
          <Route path="admin/direta/contabilidades" element={<RequireAdmin><DiretaContabilidadesAdmin /></RequireAdmin>} />
          <Route path="minhas-comissoes"         element={<RequireInternal><MinhasComissoes /></RequireInternal>} />
          <Route path="direta/dashboard"         element={<RequireComercialFull><DiretaFernandoDashboard /></RequireComercialFull>} />
          <Route path="direta/minhas-vendas"     element={<RequireComercialFull><DiretaFernandoMinhasVendas /></RequireComercialFull>} />
          <Route path="direta/atividades"        element={<RequireComercialFull><DiretaFernandoAtividades /></RequireComercialFull>} />
          <Route path="direta/contabilidades"    element={<RequireComercialFull><DiretaContabilidadesAdmin /></RequireComercialFull>} />
          <Route path="movv-cafe"                element={<MovvCafe />} />
          <Route path="alterar-senha"            element={<AlterarSenha />} />
          {/* Rotas do Indicador */}
          <Route path="indicador/dashboard"          element={<RequireIndicator><IndicadorDashboard /></RequireIndicator>} />
          <Route path="indicador/indicar"            element={<RequireIndicator><IndicadorIndicar /></RequireIndicator>} />
          <Route path="indicador/minhas-indicacoes"  element={<RequireIndicator><IndicadorMinhasIndicacoes /></RequireIndicator>} />
          <Route path="indicador/produtos-azul"      element={<RequireIndicator><IndicadorProdutosAzul /></RequireIndicator>} />
          <Route path="indicador/simulador"          element={<RequireIndicator><IndicadorSimulador /></RequireIndicator>} />
          <Route path="indicador/material-apoio"     element={<RequireIndicator><IndicadorMaterialApoio /></RequireIndicator>} />
          <Route path="indicador/meus-pagamentos"    element={<RequireIndicator><IndicadorMeusPagamentos /></RequireIndicator>} />
          <Route path="indicador/perfil"             element={<RequireIndicator><IndicadorPerfil /></RequireIndicator>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
