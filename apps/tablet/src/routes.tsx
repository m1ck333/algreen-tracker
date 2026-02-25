import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '@algreen/auth';
import { TabletLayout } from './layouts/TabletLayout';
import { TabletLoginPage } from './pages/login/TabletLoginPage';
import { OrderQueuePage } from './pages/queue/OrderQueuePage';
import { IncomingOrdersPage } from './pages/incoming/IncomingOrdersPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { CheckOutPage } from './pages/checkout/CheckOutPage';

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
        <Route index element={<Navigate to="/queue" replace />} />
        <Route path="/queue" element={<OrderQueuePage />} />
        <Route path="/incoming" element={<IncomingOrdersPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/checkout" element={<CheckOutPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
