import { useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { AppDetailProvider } from '@/context/AppDetailContext';
import { trackReferralParams } from '@/lib/analytics';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { createMuiTheme } from '@/theme/muiTheme';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Index from './pages/Index';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import IncidentsPage from '@/pages/dashboard/IncidentsPage';
import IncidentDetailPage from '@/pages/dashboard/IncidentDetailPage';
import IncidentSimplePage from '@/pages/dashboard/IncidentSimplePage';
import TemplatesPage from '@/pages/dashboard/TemplatesPage';
import IOCTypesPage from '@/pages/dashboard/IOCTypesPage';
import RulesPage from '@/pages/dashboard/RulesPage';
import MitreAttackPage from '@/pages/dashboard/MitreAttackPage';
import DetectionOnboardingPage from '@/pages/dashboard/DetectionOnboardingPage';
import ThreatFeedsPage from '@/pages/dashboard/ThreatFeedsPage';
import CustomFieldsPage from '@/pages/dashboard/CustomFieldsPage';
import ResponseActionsPage from '@/pages/dashboard/ResponseActionsPage';
import UsersPage from '@/pages/dashboard/UsersPage';
import AdminPage from '@/pages/dashboard/AdminPage';
import OrganizationsPage from '@/pages/dashboard/OrganizationsPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import OrgPreferencesPage from '@/pages/dashboard/OrgPreferencesPage';
import AgentActivityPage from '@/pages/dashboard/AgentActivityPage';
import InfrastructurePage from '@/pages/dashboard/InfrastructurePage';
import DataFlowDetailPage from '@/pages/dashboard/DataFlowDetailPage';
import UsecasesPage from '@/pages/dashboard/UsecasesPage';
import AppDetailPage from '@/pages/dashboard/AppDetailPage';
import DocsPage from '@/pages/docs/DocsPage';
import PipelinesPage from '@/pages/dashboard/PipelinesPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import VulnerabilitiesPage from '@/pages/dashboard/VulnerabilitiesPage';
import VulnAssetsPage from '@/pages/dashboard/VulnAssetsPage';
import AssetsPage from '@/pages/dashboard/AssetsPage';
import HostTerminalPage from '@/pages/dashboard/HostTerminalPage';
import MonitorDetailPage from '@/pages/dashboard/MonitorDetailPage';
import EntityReferencePage from '@/pages/dashboard/EntityReferencePage';
import VulnerabilityDetailPage from '@/pages/dashboard/VulnerabilityDetailPage';

import AppsPage from '@/pages/AppsPage';
import NotFound from './pages/NotFound';
import { ScrollToTop } from '@/components/ScrollToTop';
import { DemoProvider } from '@/context/DemoContext';
import { DemoTourDrawer } from '@/components/demo/DemoTourDrawer';
import { DemoSpotlight } from '@/components/demo/DemoSpotlight';
import { DemoCompletionWatcher } from '@/components/demo/DemoCompletionWatcher';

/** Layout that conditionally shows sidebar for authenticated users, navbar + content for guests */
const ConditionalDashboardLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AppDetailProvider><Outlet /></AppDetailProvider>;
  if (isAuthenticated) return <DashboardLayout />;
  return (
    <AppDetailProvider>
      <LandingNavbar />
      <Box sx={{ pt: '72px' }}>
        <Outlet />
      </Box>
    </AppDetailProvider>
  );
};

/** Guard that only allows support users; redirects others to incidents */
const SupportOnly = ({ children }: { children: React.ReactNode }) => {
  const { userInfo } = useAuth();
  if (userInfo?.support !== true) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const queryClient = new QueryClient();

/** Inner app that reads theme context */
const ThemedApp = () => {
  const { resolvedTheme } = useTheme();
  const muiTheme = useMemo(() => createMuiTheme(resolvedTheme), [resolvedTheme]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Toaster 
        position="bottom-right" 
        theme={resolvedTheme}
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          },
        }}
      />
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <DemoProvider>
          <DemoTourDrawer />
          <DemoSpotlight />
          <DemoCompletionWatcher />
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
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/incidents-simple" element={<Navigate to="/incidents" replace />} />
              <Route path="/incidents-simple/:id" element={<IncidentSimplePage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/alerts" element={<IncidentsPage />} />
              <Route path="/alerts/:id" element={<IncidentDetailPage />} />
              <Route path="/tickets" element={<IncidentsPage />} />
              <Route path="/tickets/:id" element={<IncidentDetailPage />} />
              <Route path="/jobs" element={<IncidentsPage />} />
              <Route path="/jobs/:id" element={<IncidentDetailPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/detection" element={<DetectionOnboardingPage />} />
              <Route path="/detection/sigma" element={<RulesPage />} />
              <Route path="/detection/pipelines" element={<PipelinesPage />} />
              <Route path="/detection/mitre" element={<SupportOnly><MitreAttackPage /></SupportOnly>} />
              <Route path="/incidents/ioc-types" element={<IOCTypesPage />} />
              <Route path="/incidents/threat-feeds" element={<ThreatFeedsPage />} />
              <Route path="/incidents/custom-fields" element={<CustomFieldsPage />} />
              <Route path="/incidents/response-actions" element={<ResponseActionsPage />} />
              <Route path="/agent" element={<AgentActivityPage />} />
              <Route path="/infrastructure" element={<InfrastructurePage />} />
              <Route path="/infrastructure/flows/:flowId" element={<DataFlowDetailPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/users" element={<AdminPage />} />
              <Route path="/admin/tenants" element={<AdminPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/preferences" element={<OrgPreferencesPage />} />
              <Route path="/monitors" element={<SupportOnly><VulnAssetsPage /></SupportOnly>} />
              <Route path="/monitors/:id" element={<SupportOnly><MonitorDetailPage /></SupportOnly>} />
              <Route path="/monitors/:hostUuid/terminal" element={<SupportOnly><HostTerminalPage /></SupportOnly>} />
              <Route path="/software/*" element={<SupportOnly><EntityReferencePage type="software" /></SupportOnly>} />
              <Route path="/packages/*" element={<SupportOnly><EntityReferencePage type="package" /></SupportOnly>} />
              <Route path="/assets" element={<AssetsPage />} />
            </Route>

            {/* App detail & usecase detail: uses sidebar when authenticated, standalone when guest */}
            <Route element={<ConditionalDashboardLayout />}>
              <Route path="/usecases" element={<UsecasesPage />} />
              <Route path="/usecases/:flowId" element={<UsecasesPage />} />
              <Route path="/usecases/:flowId/details" element={<DataFlowDetailPage />} />
              <Route path="/apps/:appname" element={<AppDetailPage />} />
              <Route path="/vulnerabilities" element={<VulnerabilitiesPage />} />
              <Route path="/vulnerabilities/*" element={<VulnerabilityDetailPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </DemoProvider>
        </BrowserRouter>
      </AuthProvider>
    </MuiThemeProvider>
  );
};

const App = () => {
  useEffect(() => { trackReferralParams(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
