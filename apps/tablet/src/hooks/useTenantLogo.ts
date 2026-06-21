import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantsApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';

/**
 * Tablet mirror of dashboard's `useTenantLogo`. Resolves the current
 * tenant's uploaded logo to an in-memory blob URL so the StatusBar (and
 * anywhere else) can render it via a plain <img src>.
 *
 * Why a blob URL instead of an <img src="/api/tenants/me/logo"> route?
 * The endpoint is auth-protected (JWT in Authorization header); a bare
 * img tag can't send that header. The axios instance already attaches
 * the JWT, so we fetch as a blob and hand back an object URL.
 *
 * Returns `null` while loading, when the user isn't signed in, or when
 * the tenant hasn't uploaded a logo — caller falls back to the MPMS mark.
 */
export function useTenantLogo(): string | null {
  const tenantId = useAuthStore((s) => s.tenantId);

  const { data: tenant } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy().then((r) => r.data),
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.logoUrl) {
      setLogoObjectUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    tenantsApi
      .getMyLogoBlob()
      .then((r) => {
        if (cancelled) return;
        url = URL.createObjectURL(r.data);
        setLogoObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLogoObjectUrl(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [tenant?.logoUrl]);

  return logoObjectUrl;
}
