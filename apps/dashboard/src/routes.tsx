import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from '@alblue/auth';
import { UserRole, StockMovementType, TenantFeature } from '@alblue/shared-types';
import { RequireFeature } from './components/RequireFeature';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/login/LoginPage';
import { RoleRedirect } from './components/RoleRedirect';
import { NotFoundPage } from './pages/not-found/NotFoundPage';

// Every page beyond the login flow is lazy-loaded so the initial JS chunk
// only carries the auth shell + the RoleRedirect target. Each chunk is
// fetched on demand and cached by the browser for subsequent visits.
const AboutPage = lazy(() => import('./pages/about/AboutPage').then((m) => ({ default: m.AboutPage })));
const TutorialPage = lazy(() => import('./pages/tutorial/TutorialPage').then((m) => ({ default: m.TutorialPage })));
const WhatsNewPage = lazy(() => import('./pages/whats-new/WhatsNewPage').then((m) => ({ default: m.WhatsNewPage })));
const CoordinatorDashboard = lazy(() => import('./pages/coordinator/CoordinatorDashboard').then((m) => ({ default: m.CoordinatorDashboard })));
const OrderListPage = lazy(() => import('./pages/orders/OrderListPage').then((m) => ({ default: m.OrderListPage })));
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard').then((m) => ({ default: m.SalesDashboard })));
const BlockRequestsPage = lazy(() => import('./pages/block-requests/BlockRequestsPage').then((m) => ({ default: m.BlockRequestsPage })));
const ChangeRequestsPage = lazy(() => import('./pages/change-requests/ChangeRequestsPage').then((m) => ({ default: m.ChangeRequestsPage })));
const KorisniciPage = lazy(() => import('./pages/admin/KorisniciPage').then((m) => ({ default: m.KorisniciPage })));
const ProcessesPage = lazy(() => import('./pages/admin/ProcessesPage').then((m) => ({ default: m.ProcessesPage })));
const ProductCategoriesPage = lazy(() => import('./pages/admin/ProductCategoriesPage').then((m) => ({ default: m.ProductCategoriesPage })));
const SpecialRequestTypesPage = lazy(() => import('./pages/admin/SpecialRequestTypesPage').then((m) => ({ default: m.SpecialRequestTypesPage })));
const OrderTypesPage = lazy(() => import('./pages/admin/OrderTypesPage').then((m) => ({ default: m.OrderTypesPage })));
const FirmaPage = lazy(() => import('./pages/admin/FirmaPage').then((m) => ({ default: m.FirmaPage })));
const ShiftsPage = lazy(() => import('./pages/admin/ShiftsPage').then((m) => ({ default: m.ShiftsPage })));
const MaterialsPage = lazy(() => import('./pages/admin/MaterialsPage').then((m) => ({ default: m.MaterialsPage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const StockPage = lazy(() => import('./pages/warehouse/StockPage').then((m) => ({ default: m.StockPage })));
const StockEntryPage = lazy(() => import('./pages/warehouse/StockEntryPage').then((m) => ({ default: m.StockEntryPage })));
const HistoryPage = lazy(() => import('./pages/warehouse/HistoryPage').then((m) => ({ default: m.HistoryPage })));

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>

      {/* Authenticated */}
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<RoleRedirect />} />

        <Route path="/tutorial" element={<TutorialPage />} />
        <Route path="/whats-new" element={<WhatsNewPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireRole
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin, UserRole.SuperAdmin]}
            >
              <CoordinatorDashboard />
            </RequireRole>
          }
        />

        <Route path="/orders" element={<OrderListPage />} />

        <Route
          path="/sales"
          element={
            <RequireRole roles={[UserRole.SalesManager]}>
              <SalesDashboard />
            </RequireRole>
          }
        />

        <Route
          path="/block-requests"
          element={
            <RequireRole
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin, UserRole.SuperAdmin]}
            >
              <BlockRequestsPage />
            </RequireRole>
          }
        />
        <Route
          path="/change-requests"
          element={
            <RequireRole
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin, UserRole.SuperAdmin]}
            >
              <ChangeRequestsPage />
            </RequireRole>
          }
        />

        <Route
          path="/reports"
          element={
            <RequireRole
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin, UserRole.SuperAdmin]}
            >
              <RequireFeature feature={TenantFeature.ProcessTimes}>
                <ReportsPage />
              </RequireFeature>
            </RequireRole>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin]}>
              <KorisniciPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/processes"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin]}>
              <ProcessesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/product-categories"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin]}>
              <ProductCategoriesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/special-request-types"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin]}>
              <SpecialRequestTypesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/order-types"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin]}>
              <OrderTypesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/company"
          element={
            <RequireRole roles={[UserRole.SuperAdmin, UserRole.Admin]}>
              <FirmaPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/shifts"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin]}>
              <ShiftsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/materials"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin, UserRole.Magacioner]}>
              <RequireFeature feature={TenantFeature.Magacin}>
                <MaterialsPage />
              </RequireFeature>
            </RequireRole>
          }
        />

        {/* Magacin (warehouse) — Saša 08.06.2026 */}
        <Route
          path="/warehouse/stock"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.Coordinator, UserRole.SuperAdmin, UserRole.Magacioner]}>
              <RequireFeature feature={TenantFeature.Magacin}>
                <StockPage />
              </RequireFeature>
            </RequireRole>
          }
        />
        <Route
          path="/warehouse/inflow"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin, UserRole.Magacioner]}>
              <RequireFeature feature={TenantFeature.Magacin}>
                <StockEntryPage type={StockMovementType.Inflow} />
              </RequireFeature>
            </RequireRole>
          }
        />
        <Route
          path="/warehouse/outflow"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.SuperAdmin, UserRole.Magacioner]}>
              <RequireFeature feature={TenantFeature.Magacin}>
                <StockEntryPage type={StockMovementType.Outflow} />
              </RequireFeature>
            </RequireRole>
          }
        />
        <Route
          path="/warehouse/history"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager, UserRole.Coordinator, UserRole.SuperAdmin, UserRole.Magacioner]}>
              <RequireFeature feature={TenantFeature.Magacin}>
                <HistoryPage />
              </RequireFeature>
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
