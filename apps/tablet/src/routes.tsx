import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '@algreen/auth';
import { TabletLayout } from './layouts/TabletLayout';
import { TabletLoginPage } from './pages/login/TabletLoginPage';
import { CheckInPage } from './pages/checkin/CheckInPage';
import { OrderQueuePage } from './pages/queue/OrderQueuePage';
import { WorkPage } from './pages/work/WorkPage';
import { IncomingOrdersPage } from './pages/incoming/IncomingOrdersPage';
import { CheckOutPage } from './pages/checkout/CheckOutPage';
import { useWorkSessionStore } from './stores/work-session-store';

function CheckInOrRedirect() {
  const processId = useWorkSessionStore((s) => s.processId);
  if (processId) return <Navigate to="/queue" replace />;
  return <CheckInPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<TabletLoginPage />} />

      <Route
        element={
          <RequireAuth>
            <TabletLayout />
          </RequireAuth>
        }
      >
        <Route index element={<CheckInOrRedirect />} />
        <Route path="/queue" element={<OrderQueuePage />} />
        <Route path="/work/:orderItemProcessId" element={<WorkPage />} />
        <Route path="/incoming" element={<IncomingOrdersPage />} />
        <Route path="/checkout" element={<CheckOutPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
