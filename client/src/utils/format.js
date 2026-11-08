const currencyFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const dateFormatter = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });

export const formatCurrency = (amount) => currencyFormatter.format(Number(amount) || 0);

export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '');

// Short form for chart axis ticks, where "R120 000,00" would crowd the plot
export const formatCompactCurrency = (value) => {
    const amount = Number(value) || 0;
    if (amount >= 1000000) return `R${(amount / 1000000).toFixed(1)}m`;
    if (amount >= 1000) return `R${Math.round(amount / 1000)}k`;
    return `R${Math.round(amount)}`;
};

// Rates arrive from the API already expressed as percentages (e.g. 18 for 18%)
export const formatPercent = (rate) => `${(Number(rate) || 0).toFixed(2).replace(/\.00$/, '')}%`;

// Reads the expiry (ms since epoch) from a JWT payload without verifying it.
// Verification happens on the server; this is only used to log out when the token expires.
export const getTokenExpiry = (token) => {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp } = JSON.parse(atob(payload));
        return typeof exp === 'number' ? exp * 1000 : null;
    } catch {
        return null;
    }
};
