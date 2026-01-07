import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { muiTheme } from '@/theme/muiTheme';
import Index from './pages/Index';
import Login from './pages/Login';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import AlertsPage from '@/pages/dashboard/AlertsPage';
import CasesPage from '@/pages/dashboard/CasesPage';
import TemplatesPage from '@/pages/dashboard/TemplatesPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="templates/cases" element={<TemplatesPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
