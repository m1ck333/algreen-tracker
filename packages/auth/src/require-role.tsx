import React from 'react';
import { Navigate } from 'react-router-dom';
import type { UserRole } from '@algreen/shared-types';
import { useAuthStore } from './auth-store';

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
