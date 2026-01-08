import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { muiTheme } from '@/theme/muiTheme';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Index from './pages/Index';
import AuthPage from './pages/AuthPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import AlertsPage from '@/pages/dashboard/AlertsPage';
import CasesPage from '@/pages/dashboard/CasesPage';
import TemplatesPage from '@/pages/dashboard/TemplatesPage';
import UsersPage from '@/pages/dashboard/UsersPage';
import OrganizationsPage from '@/pages/dashboard/OrganizationsPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import DocsPage from '@/pages/docs/DocsPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:slug" element={<DocsPage />} />
            
            {/* Dashboard routes with shared layout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CasesPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="cases" element={<CasesPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="organizations" element={<OrganizationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
