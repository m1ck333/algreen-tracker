import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { TenantFeatureKey } from '@alblue/shared-types';
import { useTenantFeatures } from '../hooks/useTenantFeatures';

interface RequireFeatureProps {
  feature: TenantFeatureKey | string;
  children: ReactNode;
}

/**
 * Redirects to / when the tenant's subscription doesn't include the
 * required feature (Saša 17.06.2026 — Basic plan ships with process-times
 * and magacin disabled; SAs upgrade per tenant via the Firme drawer).
 * Renders nothing during the initial /tenants/me load to avoid a redirect
 * flicker — once the SA's PUT updates the tenant, useTenantFeatures
 * invalidation drives the gate live.
 */
export function RequireFeature({ feature, children }: RequireFeatureProps) {
  const { isEnabled, loaded } = useTenantFeatures();
  if (!loaded) return null;
  if (!isEnabled(feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
