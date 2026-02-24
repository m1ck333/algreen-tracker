import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from '@algreen/auth';
import { UserRole } from '@algreen/shared-types';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/login/LoginPage';
import { CoordinatorDashboard } from './pages/coordinator/CoordinatorDashboard';
import { OrderListPage } from './pages/orders/OrderListPage';
import { SalesDashboard } from './pages/sales/SalesDashboard';
import { BlockRequestsPage } from './pages/block-requests/BlockRequestsPage';
import { ChangeRequestsPage } from './pages/change-requests/ChangeRequestsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { ProcessesPage } from './pages/admin/ProcessesPage';
import { ProductCategoriesPage } from './pages/admin/ProductCategoriesPage';
import { SpecialRequestTypesPage } from './pages/admin/SpecialRequestTypesPage';
import { TenantsPage } from './pages/admin/TenantsPage';
import { ShiftsPage } from './pages/admin/ShiftsPage';
import { RoleRedirect } from './components/RoleRedirect';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
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

        <Route
          path="/dashboard"
          element={
            <RequireRole
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin]}
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
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin]}
            >
              <BlockRequestsPage />
            </RequireRole>
          }
        />
        <Route
          path="/change-requests"
          element={
            <RequireRole
              roles={[UserRole.Coordinator, UserRole.Manager, UserRole.Admin]}
            >
              <ChangeRequestsPage />
            </RequireRole>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager]}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/processes"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager]}>
              <ProcessesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/product-categories"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager]}>
              <ProductCategoriesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/special-request-types"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager]}>
              <SpecialRequestTypesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/tenants"
          element={
            <RequireRole roles={[UserRole.Admin]}>
              <TenantsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/shifts"
          element={
            <RequireRole roles={[UserRole.Admin, UserRole.Manager]}>
              <ShiftsPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
