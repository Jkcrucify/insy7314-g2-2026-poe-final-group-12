import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import Alert from '../components/Alert';
import { validateLogin } from '../utils/validation';
import { ROLES } from '../utils/constants';

const LoginPage = () => {
    const { login, isAuthenticated, sessionExpired } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [values, setValues] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (isAuthenticated && !submitting) {
        return <Navigate to="/gigs" replace />;
    }

    const handleChange = (event) => {
        const { name, value } = event.target;
        setValues(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');
        const validationErrors = validateLogin(values);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }

        setSubmitting(true);
        try {
            const user = await login(values.email, values.password);
            const fallback = user.role === ROLES.FREELANCER ? '/dashboard' : '/gigs';
            navigate(location.state?.from || fallback, { replace: true });
        } catch (error) {
            // Generic message for failed logins: never reveal whether the email exists.
            // Rate-limit (429) and network (0) messages are safe to show as-is.
            setFormError([0, 429].includes(error.status) ? error.message : 'Invalid email or password.');
            setValues(prev => ({ ...prev, password: '' }));
            setSubmitting(false);
        }
    };

    return (
        <section className="page narrow">
            <h1>Log in</h1>
            {location.state?.registered && <Alert type="success">Registration successful. Please log in.</Alert>}
            {sessionExpired && <Alert type="info">Your session has expired. Please log in again.</Alert>}
            <Alert>{formError}</Alert>
            <form onSubmit={handleSubmit} noValidate className="form card">
                <FormField
                    id="email" name="email" type="email" label="Email" autoComplete="email" maxLength={254}
                    value={values.email} onChange={handleChange} error={errors.email}
                />
                <FormField
                    id="password" name="password" type="password" label="Password" autoComplete="current-password" maxLength={64}
                    value={values.password} onChange={handleChange} error={errors.password}
                />
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Logging in...' : 'Log in'}
                </button>
            </form>
            <p className="muted">Don&apos;t have an account? <Link to="/register">Sign up</Link></p>
        </section>
    );
};

export default LoginPage;
