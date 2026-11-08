import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GigsPage from './pages/GigsPage';
import GigDetailPage from './pages/GigDetailPage';
import GigEditorPage from './pages/GigEditorPage';
import BookingsPage from './pages/BookingsPage';
import TransactionsPage from './pages/TransactionsPage';
import DashboardPage from './pages/DashboardPage';
import IncomePage from './pages/IncomePage';
import NotFoundPage from './pages/NotFoundPage';
import { ROLES } from './utils/constants';

const App = () => {
    const { isAuthenticated } = useAuth();

    return (
        <>
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<Navigate to={isAuthenticated ? '/gigs' : '/login'} replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    <Route path="/gigs" element={<ProtectedRoute><GigsPage /></ProtectedRoute>} />
                    <Route path="/gigs/new" element={<ProtectedRoute roles={[ROLES.FREELANCER]}><GigEditorPage /></ProtectedRoute>} />
                    <Route path="/gigs/:id" element={<ProtectedRoute><GigDetailPage /></ProtectedRoute>} />
                    <Route path="/gigs/:id/edit" element={<ProtectedRoute roles={[ROLES.FREELANCER]}><GigEditorPage /></ProtectedRoute>} />
                    <Route path="/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
                    <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute roles={[ROLES.FREELANCER]}><DashboardPage /></ProtectedRoute>} />
                    <Route path="/income" element={<ProtectedRoute roles={[ROLES.FREELANCER]}><IncomePage /></ProtectedRoute>} />

                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>
        </>
    );
};

export default App;
