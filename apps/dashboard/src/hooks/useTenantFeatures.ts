import { useQuery } from '@tanstack/react-query';
import { tenantsApi } from '@alblue/api-client';
import type { TenantFeatureKey } from '@alblue/shared-types';
import { useAuthStore } from '@alblue/auth';

/**
 * Reads the current tenant's feature flags from /tenants/me. SAs and
 * regular users share the same endpoint so this hook works for everyone
 * — when a SA is browsing while logged into "DEMO", they get DEMO's
 * feature set. The query is cached so reuse across SidebarMenu + route
 * guards is free.
 *
 * Pre-login (no JWT) the query is disabled and isEnabled() returns true
 * so we don't accidentally hide menu items during the auth flicker.
 */
export function useTenantFeatures() {
  const isAuthed = useAuthStore((s) => !!s.tenantId);

  const { data } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy().then((r) => r.data),
    enabled: isAuthed,
    staleTime: 30_000,
  });

  const disabled = data?.disabledFeatures ?? [];

  const isEnabled = (feature: TenantFeatureKey | string) => !disabled.includes(feature);

  return { isEnabled, disabledFeatures: disabled, loaded: !!data };
}
