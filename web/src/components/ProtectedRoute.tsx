import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AppSection } from '../utils/roleAccess';
import { canAccess } from '../utils/roleAccess';

export default function ProtectedRoute({
  children,
  section,
}: {
  children: ReactNode;
  section?: AppSection;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <span style={{ marginLeft: '0.5rem' }}>Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (section && !canAccess(user?.role, section)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
