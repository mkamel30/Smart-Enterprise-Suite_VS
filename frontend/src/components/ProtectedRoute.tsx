import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { normalizeRole } from '../lib/permissions';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isAuthenticated, token, user } = useAuth();
    const location = useLocation();

    if (!isAuthenticated || !token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(normalizeRole(user.role))) {
        // Redirect to dashboard or 403 page if role is not allowed
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
