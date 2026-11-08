import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Redirects unauthenticated users to login and blocks users without an allowed role.
// This only controls what the UI shows; the API enforces the same rules on every request.
const ProtectedRoute = ({ roles, children }) => {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (roles && !roles.includes(user.role)) {
        return (
            <section className="page narrow">
                <h1>Access denied</h1>
                <p>Your account type ({user.role}) does not have permission to view this page.</p>
                <Link to="/gigs" className="btn btn-primary">Back to gigs</Link>
            </section>
        );
    }

    return children;
};

export default ProtectedRoute;
