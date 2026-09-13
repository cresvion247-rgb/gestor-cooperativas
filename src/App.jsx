import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import Cooperativas from '@/pages/Cooperativas';
import Promociones from '@/pages/Promociones';
import Contratos from '@/pages/Contratos';
import Finanzas from '@/pages/Finanzas';
import Construccion from '@/pages/Construccion';
import Gobierno from '@/pages/Gobierno';
import Entregas from '@/pages/Entregas';
import Documentos from '@/pages/Documentos';
import Comunicaciones from '@/pages/Comunicaciones';
import Informes from '@/pages/Informes';
import Administracion from '@/pages/Administracion';
import AppLayout from '@/components/erp/AppLayout';
import { I18nProvider } from '@/lib/i18n';
import InactiveUserScreen from '@/components/InactiveUserScreen';
import PortalSocio from '@/pages/PortalSocio';
import AltaSocio from '@/pages/AltaSocio';
import Incidencias from '@/pages/Incidencias';
import Soporte from '@/pages/Soporte';
import Bandeja from '@/pages/Bandeja';
import Socios from '@/pages/Socios';
import Urbanismo from '@/pages/Urbanismo';
import Juridico from '@/pages/Juridico';
import Proveedores from '@/pages/Proveedores';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Block deactivated users
  if (user?.estado === 'inactivo') {
    return <InactiveUserScreen />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cooperativas" element={<Cooperativas />} />
          <Route path="/promociones" element={<Promociones />} />
          <Route path="/socios" element={<Socios />} />
          <Route path="/urbanismo" element={<Urbanismo />} />
          <Route path="/juridico" element={<Juridico />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/construccion" element={<Construccion />} />
          <Route path="/gobierno" element={<Gobierno />} />
          <Route path="/entregas" element={<Entregas />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/comunicaciones" element={<Comunicaciones />} />
          <Route path="/informes" element={<Informes />} />
          <Route path="/portal" element={<PortalSocio />} />
          <Route path="/alta-socio" element={<AltaSocio />} />
          <Route path="/incidencias" element={<Incidencias />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/bandeja" element={<Bandeja />} />
          <Route path="/administracion" element={<Administracion />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <I18nProvider>
            <AuthenticatedApp />
          </I18nProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

// Build refresh: harmless marker to force a clean preview rebuild after a stuck cache state.
export default App