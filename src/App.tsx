import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { muiTheme } from '@/theme/muiTheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Index from './pages/Index';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import IncidentsPage from '@/pages/dashboard/IncidentsPage';
import IncidentDetailPage from '@/pages/dashboard/IncidentDetailPage';
import TemplatesPage from '@/pages/dashboard/TemplatesPage';
import IOCTypesPage from '@/pages/dashboard/IOCTypesPage';
import RulesPage from '@/pages/dashboard/RulesPage';
import MitreAttackPage from '@/pages/dashboard/MitreAttackPage';
import DetectionOnboardingPage from '@/pages/dashboard/DetectionOnboardingPage';
import ThreatFeedsPage from '@/pages/dashboard/ThreatFeedsPage';
import CustomFieldsPage from '@/pages/dashboard/CustomFieldsPage';
import UsersPage from '@/pages/dashboard/UsersPage';
import OrganizationsPage from '@/pages/dashboard/OrganizationsPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import AgentActivityPage from '@/pages/dashboard/AgentActivityPage';
import InfrastructurePage from '@/pages/dashboard/InfrastructurePage';
import DataFlowDetailPage from '@/pages/dashboard/DataFlowDetailPage';
import AppDetailPage from '@/pages/dashboard/AppDetailPage';
import DocsPage from '@/pages/docs/DocsPage';

import AppsPage from '@/pages/AppsPage';
import NotFound from './pages/NotFound';
import { ScrollToTop } from '@/components/ScrollToTop';

/** Layout that conditionally shows sidebar for authenticated users, bare page for guests */
const ConditionalDashboardLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Outlet />;
  if (isAuthenticated) return <DashboardLayout />;
  return <Outlet />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Toaster 
        position="bottom-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: 'linear-gradient(180deg, #262626 0%, #1f1f1f 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'hsl(var(--foreground))',
          },
        }}
      />
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:slug" element={<DocsPage />} />
            {/* Onboarding with sidebar (collapsed by default) */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout defaultCollapsed />
                </ProtectedRoute>
              }
            >
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/onboarding/sources" element={<OnboardingPage />} />
              <Route path="/onboarding/authenticate" element={<OnboardingPage />} />
              <Route path="/onboarding/automate" element={<OnboardingPage />} />
            </Route>
            
            {/* Product routes with shared layout */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/detection" element={<DetectionOnboardingPage />} />
              <Route path="/detection/sigma" element={<RulesPage />} />
              <Route path="/detection/mitre" element={<MitreAttackPage />} />
              <Route path="/incidents/ioc-types" element={<IOCTypesPage />} />
              <Route path="/incidents/threat-feeds" element={<ThreatFeedsPage />} />
              <Route path="/incidents/custom-fields" element={<CustomFieldsPage />} />
              <Route path="/agent" element={<AgentActivityPage />} />
              <Route path="/infrastructure" element={<InfrastructurePage />} />
              <Route path="/infrastructure/flows/:flowId" element={<DataFlowDetailPage />} />
              
              <Route path="/users" element={<UsersPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* App detail: uses sidebar when authenticated, standalone when guest */}
            <Route element={<ConditionalDashboardLayout />}>
              <Route path="/apps/:appname" element={<AppDetailPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
