import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasLimitedShell, isMemberAllowedPath } from '@/lib/permissions';

/** Redirect cooperative members away from staff-only routes. */
export default function MemberRouteGuard({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return children;
  if (hasLimitedShell(user) && !isMemberAllowedPath(location.pathname)) {
    return <Navigate to="/portal" replace />;
  }
  return children;
}
