import { useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { AppDetailProvider } from '@/Shuffle-MCPs/AppDetailContext';
import { setToastImpl } from '@/Shuffle-MCPs/toast';
import { toast as hostToast } from '@/lib/toast';
setToastImpl((arg, opts) => {
  // Bridge MCP-lib toast shape ({ title, description, variant }) onto the
  // host react-toastify wrapper. Plain strings pass through.
  if (typeof arg === 'string') {
    hostToast(arg, opts as any);
    return;
  }
  const { title, description, variant } = (arg ?? {}) as {
    title?: string;
    description?: string;
    variant?: string;
  };
  const message = title || description || '';
  const mergedOpts = { description: title ? description : undefined, ...(opts || {}) };
  if (variant === 'destructive' || variant === 'error') hostToast.error(message, mergedOpts as any);
  else if (variant === 'warning') hostToast.warning(message, mergedOpts as any);
  else if (variant === 'success') hostToast.success(message, mergedOpts as any);
  else if (variant === 'info') hostToast.info(message, mergedOpts as any);
  else hostToast(message, mergedOpts as any);
});
import { trackReferralParams, initAnalytics } from '@/lib/analytics';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { createMuiTheme } from '@/theme/muiTheme';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Index from './pages/Index';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import ExternalLinkConfirmDialog from '@/components/common/ExternalLinkConfirmDialog';
import IncidentsPage from '@/pages/dashboard/IncidentsPage';
import IncidentDetailPage from '@/pages/dashboard/IncidentDetailPage';

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
import AgentsPage from '@/pages/dashboard/AgentsPage';
import InfrastructurePage from '@/pages/dashboard/InfrastructurePage';
import DataFlowDetailPage from '@/pages/dashboard/DataFlowDetailPage';
import UsecasesPageRaw from '@/pages/dashboard/UsecasesPage';
import FormsPage from '@/pages/dashboard/FormsPage';
import { useAuth as useAppAuth } from '@/context/AuthContext';

// Bridge AuthContext -> UsecasesPage so the in-page "Get started free" CTA
// correctly hides for already-authenticated dashboard users.
const UsecasesPage = () => {
  const { isAuthenticated, isLoading, userInfo } = useAppAuth();
  return (
    <UsecasesPageRaw
      isLoaded={!isLoading}
      isLoggedIn={isAuthenticated}
      userdata={userInfo ? {
        id: userInfo.id,
        username: userInfo.username,
        support: userInfo.support,
      } as any : undefined}
    />
  );
};
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
import ShuffleMcpTestPage from '@/pages/ShuffleMcpTestPage';
import NotFound from './pages/NotFound';
import { ScrollToTop } from '@/components/ScrollToTop';
import { DemoProvider } from '@/context/DemoContext';
import { DemoTourDrawer } from '@/components/demo/DemoTourDrawer';
import { DemoSpotlight } from '@/components/demo/DemoSpotlight';
import { DemoCompletionWatcher } from '@/components/demo/DemoCompletionWatcher';
import { DemoResumePill } from '@/components/demo/DemoResumePill';

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

/** Legacy /incidents-simple/:id → /incidents/:id redirect (preserves the id and query string). */
const RedirectIncidentsSimple = () => {
  const { pathname, search } = window.location;
  const id = pathname.split('/').filter(Boolean)[1] || '';
  return <Navigate to={`/incidents/${id}${search}`} replace />;
};

const queryClient = new QueryClient();

/** Inner app that reads theme context */
const ThemedApp = () => {
  const { resolvedTheme } = useTheme();
  const muiTheme = useMemo(() => createMuiTheme(resolvedTheme), [resolvedTheme]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <ExternalLinkConfirmDialog />
      <ToastContainer
        position="bottom-right"
        theme={resolvedTheme}
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        
        hideProgressBar={false}
        style={{ width: 'auto', maxWidth: 420 }}
      />
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <DemoProvider>
          <DemoTourDrawer />
          <DemoSpotlight />
          <DemoCompletionWatcher />
          <DemoResumePill />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:slug" element={<DocsPage />} />
            {/* Public library demo — works whether logged in or not */}
            <Route path="/shuffle-mcp-demo" element={<ShuffleMcpTestPage />} />
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
              {/* Simple incident view was removed — redirect any old links to the full view. */}
              <Route path="/incidents-simple" element={<Navigate to="/incidents" replace />} />
              <Route path="/incidents-simple/:id" element={<RedirectIncidentsSimple />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/alerts" element={<IncidentsPage />} />
              <Route path="/alerts/:id" element={<IncidentDetailPage />} />
              <Route path="/tickets" element={<IncidentsPage />} />
              <Route path="/tickets/:id" element={<IncidentDetailPage />} />
              <Route path="/jobs" element={<IncidentsPage />} />
              <Route path="/jobs/:id" element={<IncidentDetailPage />} />
              <Route path="/cases" element={<IncidentsPage />} />
              <Route path="/cases/:id" element={<IncidentDetailPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/detection" element={<DetectionOnboardingPage />} />
              <Route path="/detection/sigma" element={<RulesPage />} />
              <Route path="/detection/pipelines" element={<PipelinesPage />} />
              <Route path="/detection/mitre" element={<SupportOnly><MitreAttackPage /></SupportOnly>} />
              <Route path="/incidents/observables" element={<IOCTypesPage />} />
              <Route path="/incidents/threat-feeds" element={<ThreatFeedsPage />} />
              {/* Legacy redirects — keep old URLs working for bookmarks/links */}
              <Route path="/incidents/ioc-types" element={<Navigate to="/incidents/observables" replace />} />
              <Route path="/detection/ioc-types" element={<Navigate to="/incidents/observables" replace />} />
              <Route path="/detection/threat-feeds" element={<Navigate to="/incidents/threat-feeds" replace />} />
              <Route path="/incidents/custom-fields" element={<CustomFieldsPage />} />
              <Route path="/monitors/response" element={<SupportOnly><ResponseActionsPage /></SupportOnly>} />
              <Route path="/incidents/response-actions" element={<Navigate to="/monitors/response" replace />} />
              <Route path="/agent" element={<AgentActivityPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/agents/:executionId" element={<AgentsPage />} />
              <Route path="/infrastructure" element={<InfrastructurePage />} />
              <Route path="/infrastructure/flows/:flowId" element={<DataFlowDetailPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/users" element={<AdminPage />} />
              <Route path="/admin/tenants" element={<AdminPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/preferences" element={<OrgPreferencesPage />} />
              <Route path="/monitors" element={<VulnAssetsPage />} />
              <Route path="/monitors/terminal" element={<HostTerminalPage />} />
              <Route path="/monitors/:id" element={<MonitorDetailPage />} />
              <Route path="/monitors/:hostUuid/terminal" element={<HostTerminalPage />} />
              <Route path="/software/*" element={<EntityReferencePage type="software" />} />
              <Route path="/packages/*" element={<EntityReferencePage type="package" />} />
              <Route path="/assets" element={<SupportOnly><AssetsPage /></SupportOnly>} />
            </Route>

            {/* App detail & usecase detail: uses sidebar when authenticated, standalone when guest */}
            <Route element={<ConditionalDashboardLayout />}>
              <Route path="/usecases" element={<UsecasesPage />} />
              <Route path="/usecases/:flowId" element={<UsecasesPage />} />
              <Route path="/usecases/:flowId/details" element={<UsecasesPage />} />
              <Route path="/forms" element={<FormsPage />} />
              <Route path="/forms/:id" element={<FormsPage />} />
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
  useEffect(() => { initAnalytics(); trackReferralParams(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
