import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/format';

const BookingsPage = () => {
    const { user } = useAuth();
    const isFreelancer = user.role === ROLES.FREELANCER;
    const [bookings, setBookings] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/bookings/mine')
            .then(data => setBookings(data.bookings))
            .catch(err => setError(err.message));
    }, []);

    return (
        <section className="page">
            <h1>{isFreelancer ? 'Bookings received' : 'My bookings'}</h1>
            <Alert>{error}</Alert>
            {!bookings && !error && <p className="muted">Loading bookings...</p>}
            {bookings && bookings.length === 0 && (
                <p className="muted">
                    No bookings yet. {!isFreelancer && <Link to="/gigs">Browse gigs to make your first booking.</Link>}
                </p>
            )}
            {bookings && bookings.length > 0 && (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Gig</th>
                                <th>{isFreelancer ? 'Client' : 'Freelancer'}</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Transaction ref</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map(b => (
                                <tr key={b._id}>
                                    <td>{b.gigTitle}{b.notes && <div className="muted small">{b.notes}</div>}</td>
                                    <td>{(isFreelancer ? b.client?.username : b.freelancer?.username) || 'Unknown'}</td>
                                    <td>{formatCurrency(b.amount)}</td>
                                    <td><span className={`status status-${b.status.toLowerCase()}`}>{b.status}</span></td>
                                    <td>{formatDate(b.createdAt)}</td>
                                    <td className="mono">{b.transactionReference || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default BookingsPage;
