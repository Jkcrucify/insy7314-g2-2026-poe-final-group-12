import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Alert from '../components/Alert';
import BarChart from '../components/BarChart';
import { formatCompactCurrency, formatCurrency } from '../utils/format';

const DashboardPage = () => {
    const [income, setIncome] = useState(null);
    const [gigs, setGigs] = useState(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
        Promise.all([api.get('/transactions/income'), api.get('/gigs/mine')])
            .then(([incomeData, gigData]) => {
                setIncome(incomeData);
                setGigs(gigData.gigs);
            })
            .catch(err => setError(err.message));
    }, []);

    const handleDelete = async (gigId) => {
        setError('');
        setMessage('');
        try {
            await api.del(`/gigs/${gigId}`);
            setGigs(prev => prev.filter(g => g._id !== gigId));
            setMessage('Gig deleted.');
        } catch (err) {
            setError(err.message);
        } finally {
            setPendingDelete(null);
        }
    };

    return (
        <section className="page">
            <div className="page-header">
                <h1>Freelancer dashboard</h1>
                <Link to="/gigs/new" className="btn btn-primary">Create a gig</Link>
            </div>
            <Alert>{error}</Alert>
            <Alert type="success">{message}</Alert>

            <div className="stats">
                <div className="card stat accent">
                    <span className="stat-label">Total income</span>
                    <span className="stat-value">{income ? formatCurrency(income.totalIncome) : '...'}</span>
                    <span className="stat-note">All time</span>
                </div>
                <div className="card stat accent-tax">
                    <span className="stat-label">Estimated tax</span>
                    <span className="stat-value">{income ? formatCurrency(income.tax.taxPayable) : '...'}</span>
                    <span className="stat-note">
                        {income ? `${income.taxYear.label} tax year` : ''}
                    </span>
                </div>
                <div className="card stat">
                    <span className="stat-label">Paid bookings</span>
                    <span className="stat-value">{income ? income.transactionCount : '...'}</span>
                </div>
                <div className="card stat">
                    <span className="stat-label">Active gigs</span>
                    <span className="stat-value">{gigs ? gigs.length : '...'}</span>
                </div>
            </div>

            {income && (
                <div className="card chart-card">
                    <h2>Income this tax year</h2>
                    <p className="caption">
                        {formatCurrency(income.taxYear.income)} earned in {income.taxYear.label}.{' '}
                        <Link to="/income">See the full income and tax breakdown</Link>.
                    </p>
                    <BarChart
                        data={income.monthly.map(month => ({
                            key: month.key,
                            label: month.label,
                            value: month.income,
                            transactions: month.transactions
                        }))}
                        formatValue={formatCompactCurrency}
                        label={`Monthly income for the ${income.taxYear.label} tax year`}
                        emptyMessage="No income recorded in this tax year yet."
                    />
                </div>
            )}

            <p>
                <Link to="/income">Income &amp; tax</Link> &middot;{' '}
                <Link to="/bookings">View bookings received</Link> &middot;{' '}
                <Link to="/transactions">View transactions</Link>
            </p>

            <h2>My gigs</h2>
            {gigs && gigs.length === 0 && <p className="muted">You have not created any gigs yet.</p>}
            {gigs && gigs.length > 0 && (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Title</th><th>Category</th><th>Price</th><th>Delivery</th><th aria-label="Actions" /></tr>
                        </thead>
                        <tbody>
                            {gigs.map(gig => (
                                <tr key={gig._id}>
                                    <td><Link to={`/gigs/${gig._id}`}>{gig.title}</Link></td>
                                    <td>{gig.category}</td>
                                    <td>{formatCurrency(gig.price)}</td>
                                    <td>{gig.deliveryDays} days</td>
                                    <td className="actions">
                                        {pendingDelete === gig._id ? (
                                            <>
                                                <span className="small">Delete this gig?</span>
                                                <button type="button" className="btn btn-danger" onClick={() => handleDelete(gig._id)}>Yes, delete</button>
                                                <button type="button" className="btn btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <Link to={`/gigs/${gig._id}/edit`} className="btn btn-secondary">Edit</Link>
                                                <button type="button" className="btn btn-ghost" onClick={() => setPendingDelete(gig._id)}>Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default DashboardPage;
