import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';

const Navbar = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="navbar">
            <Link to="/" className="brand">HustleHub<span>+</span></Link>
            <nav aria-label="Main navigation">
                {isAuthenticated ? (
                    <>
                        <NavLink to="/gigs" end>Browse gigs</NavLink>
                        {user.role === ROLES.FREELANCER && <NavLink to="/dashboard">Dashboard</NavLink>}
                        {user.role === ROLES.FREELANCER && <NavLink to="/income">Income &amp; tax</NavLink>}
                        <NavLink to="/bookings">
                            {user.role === ROLES.FREELANCER ? 'Bookings received' : 'My bookings'}
                        </NavLink>
                        <NavLink to="/transactions">Transactions</NavLink>
                        <span className="user-chip" title={`Signed in as ${user.username}`}>
                            {user.username} <span className="role-badge">{user.role}</span>
                        </span>
                        <button type="button" className="btn btn-ghost" onClick={handleLogout}>Log out</button>
                    </>
                ) : (
                    <>
                        <NavLink to="/login">Log in</NavLink>
                        <NavLink to="/register" className="btn btn-primary">Sign up</NavLink>
                    </>
                )}
            </nav>
        </header>
    );
};

export default Navbar;
