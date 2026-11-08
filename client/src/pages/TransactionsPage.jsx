import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/format';

const TransactionsPage = () => {
    const { user } = useAuth();
    const isFreelancer = user.role === ROLES.FREELANCER;
    const [transactions, setTransactions] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/transactions/mine')
            .then(data => setTransactions(data.transactions))
            .catch(err => setError(err.message));
    }, []);

    const total = (transactions || []).reduce((sum, t) => sum + t.amount, 0);

    return (
        <section className="page">
            <h1>Transactions</h1>
            <Alert>{error}</Alert>
            {!transactions && !error && <p className="muted">Loading transactions...</p>}
            {transactions && (
                <p className="summary">
                    {isFreelancer ? 'Total earned' : 'Total spent'}: <strong>{formatCurrency(total)}</strong>
                    {' '}across {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                </p>
            )}
            {transactions && transactions.length > 0 && (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Gig</th>
                                <th>{isFreelancer ? 'Client' : 'Freelancer'}</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(t => (
                                <tr key={t._id}>
                                    <td className="mono">{t.reference}</td>
                                    <td>{t.booking?.gigTitle || '-'}</td>
                                    <td>{(isFreelancer ? t.client?.username : t.freelancer?.username) || 'Unknown'}</td>
                                    <td>{formatCurrency(t.amount)}</td>
                                    <td>{t.paymentMethod}</td>
                                    <td><span className="status status-confirmed">{t.status}</span></td>
                                    <td>{formatDate(t.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default TransactionsPage;
