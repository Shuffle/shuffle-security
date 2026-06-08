/**
 * MonitorsPage — host shell around the Shuffle-Core `MonitorsView`. The
 * /monitors route renders this. Everything substantive (header, host table,
 * Add Host dialog) lives in `src/Shuffle-Core/views/monitors/MonitorsView`
 * so the same UI can be embedded elsewhere (e.g. the Add Host dialog is
 * mounted inline from the usecase sidebar via `mode="add-host-dialog"`).
 */
import MonitorsView from '@/Shuffle-Core/views/monitors/MonitorsView';
import { usePageMeta } from '@/hooks/usePageMeta';

const MonitorsPage = () => {
  usePageMeta({
    title: 'Monitors',
    description: 'Monitor host compliance and security posture',
  });
  return <MonitorsView />;
};

export default MonitorsPage;
