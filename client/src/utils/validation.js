// Client-side validation mirrors the API rules so users get instant feedback.
// The API still validates everything; these checks are for usability, not security.
import { GIG_CATEGORIES, ROLES } from './constants';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export const isValidEmail = (email) => EMAIL_PATTERN.test(String(email).trim());

export const passwordProblems = (password) => {
    const problems = [];
    if (password.length < 8 || password.length > 64) problems.push('8-64 characters');
    if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
    if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
    if (!/[0-9]/.test(password)) problems.push('a number');
    if (!/[^A-Za-z0-9]/.test(password)) problems.push('a symbol');
    return problems;
};

export const validateLogin = ({ email, password }) => {
    const errors = {};
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';
    if (!password) errors.password = 'Password is required.';
    return errors;
};

export const validateRegister = ({ username, email, password, confirmPassword, role }) => {
    const errors = {};
    const name = username.trim();
    if (!name) errors.username = 'Username is required.';
    else if (name.length < 3 || name.length > 30) errors.username = 'Username must be 3-30 characters.';
    else if (!USERNAME_PATTERN.test(name)) errors.username = 'Use only letters, numbers and underscores.';

    if (!email.trim()) errors.email = 'Email is required.';
    else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';

    const problems = passwordProblems(password);
    if (problems.length) errors.password = `Password needs ${problems.join(', ')}.`;

    if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';

    if (!Object.values(ROLES).includes(role)) errors.role = 'Please choose an account type.';
    return errors;
};

export const validateGig = ({ title, description, category, price, deliveryDays }) => {
    const errors = {};
    const t = title.trim();
    const d = description.trim();
    const p = Number(price);
    const days = Number(deliveryDays);

    if (t.length < 5 || t.length > 100) errors.title = 'Title must be 5-100 characters.';
    if (d.length < 20 || d.length > 1000) errors.description = 'Description must be 20-1000 characters.';
    if (!GIG_CATEGORIES.includes(category)) errors.category = 'Please choose a category.';
    if (price === '' || Number.isNaN(p) || p < 50 || p > 100000) errors.price = 'Price must be between R50 and R100 000.';
    if (deliveryDays === '' || !Number.isInteger(days) || days < 1 || days > 60) {
        errors.deliveryDays = 'Delivery time must be a whole number of days (1-60).';
    }
    return errors;
};

// Converts the API's [{ field, message }] array into a { field: message } map
export const serverErrorsToMap = (errors = []) =>
    errors.reduce((map, { field, message }) => ({ ...map, [field]: message }), {});
