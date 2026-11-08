import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import Alert from '../components/Alert';
import { serverErrorsToMap, validateRegister } from '../utils/validation';
import { ROLES } from '../utils/constants';

const EMPTY = { username: '', email: '', password: '', confirmPassword: '', role: '' };

const RegisterPage = () => {
    const { register, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [values, setValues] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (isAuthenticated) {
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
        const validationErrors = validateRegister(values);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }

        setSubmitting(true);
        try {
            await register({
                username: values.username.trim(),
                email: values.email.trim(),
                password: values.password,
                role: values.role
            });
            navigate('/login', { replace: true, state: { registered: true } });
        } catch (error) {
            setErrors(serverErrorsToMap(error.errors));
            setFormError(error.status === 409 ? 'An account with this email already exists.' : error.message);
            setSubmitting(false);
        }
    };

    return (
        <section className="page narrow">
            <h1>Create an account</h1>
            <Alert>{formError}</Alert>
            <form onSubmit={handleSubmit} noValidate className="form card">
                <FormField
                    id="username" name="username" label="Username" autoComplete="username" maxLength={30}
                    value={values.username} onChange={handleChange} error={errors.username}
                />
                <FormField
                    id="email" name="email" type="email" label="Email" autoComplete="email" maxLength={254}
                    value={values.email} onChange={handleChange} error={errors.email}
                />
                <FormField
                    id="password" name="password" type="password" label="Password" autoComplete="new-password" maxLength={64}
                    value={values.password} onChange={handleChange} error={errors.password}
                />
                <p className="hint">At least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.</p>
                <FormField
                    id="confirmPassword" name="confirmPassword" type="password" label="Confirm password" autoComplete="new-password" maxLength={64}
                    value={values.confirmPassword} onChange={handleChange} error={errors.confirmPassword}
                />
                <fieldset className="role-picker" aria-describedby={errors.role ? 'role-error' : undefined}>
                    <legend>I want to</legend>
                    <label className={values.role === ROLES.CLIENT ? 'selected' : ''}>
                        <input type="radio" name="role" value={ROLES.CLIENT} checked={values.role === ROLES.CLIENT} onChange={handleChange} />
                        Hire freelancers (Client)
                    </label>
                    <label className={values.role === ROLES.FREELANCER ? 'selected' : ''}>
                        <input type="radio" name="role" value={ROLES.FREELANCER} checked={values.role === ROLES.FREELANCER} onChange={handleChange} />
                        Offer my services (Freelancer)
                    </label>
                    {errors.role && <p id="role-error" className="field-error">{errors.role}</p>}
                </fieldset>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Creating account...' : 'Sign up'}
                </button>
            </form>
            <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
        </section>
    );
};

export default RegisterPage;
