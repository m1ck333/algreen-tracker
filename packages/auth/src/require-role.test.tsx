import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { UserDto } from '@alblue/shared-types';
import { UserRole } from '@alblue/shared-types';
import { RequireAuth } from './require-auth';
import { RequireRole } from './require-role';
import { useAuthStore } from './auth-store';

const user = (role: UserRole): UserDto => ({
  id: 'u1',
  tenantId: 'T-1',
  email: 'a@b.rs',
  firstName: 'A',
  lastName: 'B',
  fullName: 'A B',
  role,
  additionalRoles: [],
  processes: [],
  canIncludeWithdrawnInAnalysis: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
});

// Login probe surfaces the `from` location that RequireAuth stashes on redirect.
function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  return <div>login page from:{from ?? 'none'}</div>;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/" element={<div>home page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <RequireRole roles={[UserRole.Admin]}>
                <div>secret content</div>
              </RequireRole>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    tenantId: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});
afterEach(cleanup);

describe('route guards', () => {
  it('renders children when authenticated and the role is allowed', () => {
    useAuthStore.setState({ isAuthenticated: true, user: user(UserRole.Admin) });
    renderApp();
    expect(screen.getByText('secret content')).toBeTruthy();
  });

  it('redirects to /login (preserving the "from" location) when not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    renderApp();
    expect(screen.getByText('login page from:/protected')).toBeTruthy();
    expect(screen.queryByText('secret content')).toBeNull();
  });

  it('redirects to / when authenticated but the role is not allowed', () => {
    useAuthStore.setState({ isAuthenticated: true, user: user(UserRole.Department) });
    renderApp();
    expect(screen.getByText('home page')).toBeTruthy();
    expect(screen.queryByText('secret content')).toBeNull();
  });
});
