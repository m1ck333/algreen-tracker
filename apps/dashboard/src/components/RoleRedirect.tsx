import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@algreen/auth';
import { UserRole } from '@algreen/shared-types';

export function RoleRedirect() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case UserRole.Coordinator:
    case UserRole.Manager:
    case UserRole.Admin:
      return <Navigate to="/dashboard" replace />;
    case UserRole.SalesManager:
      return <Navigate to="/sales" replace />;
    case UserRole.Department:
      return <Navigate to="/orders" replace />;
    default:
      return <Navigate to="/orders" replace />;
  }
}
