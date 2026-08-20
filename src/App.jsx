import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
// Add page imports here
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Casos from './pages/Casos';
import Documentos from './pages/Documentos';
import Tareas from './pages/Tareas';
import Calendario from './pages/Calendario';
import Equipo from './pages/Equipo';
import Administracion from './pages/Administracion';
import Honorarios from './pages/Honorarios';
import Clientes from './pages/Clientes';
import VistaCliente from './pages/VistaCliente';
import Comentarios from './pages/Comentarios';
import PortalLayout from './components/legal/PortalLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }


  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<PortalLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/casos" element={<Casos />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/equipo" element={<Equipo />} />
          <Route path="/honorarios" element={<Honorarios />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/vista-cliente" element={<VistaCliente />} />
          <Route path="/comentarios" element={<Comentarios />} />
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
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App