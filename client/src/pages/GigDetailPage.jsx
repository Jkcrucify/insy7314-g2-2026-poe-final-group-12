import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import FormField from '../components/FormField';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/format';

const GigDetailPage = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const [gig, setGig] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState('');
    const [confirmPayment, setConfirmPayment] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [booking, setBooking] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        api.get(`/gigs/${encodeURIComponent(id)}`)
            .then(data => { if (active) setGig(data.gig); })
            .catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [id]);

    const handleBook = async (event) => {
        event.preventDefault();
        setBookingError('');
        if (!confirmPayment) {
            setBookingError('Please confirm the simulated payment to continue.');
            return;
        }
        setSubmitting(true);
        try {
            const data = await api.post('/bookings', { gigId: gig._id, notes: notes.trim(), confirmPayment: true });
            setBooking(data);
        } catch (err) {
            setBookingError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (error) {
        return (
            <section className="page narrow">
                <Alert>{error}</Alert>
                <Link to="/gigs">Back to gigs</Link>
            </section>
        );
    }
    if (!gig) return <section className="page"><p className="muted">Loading gig...</p></section>;

    const isOwner = gig.freelancer?._id === user.id;

    return (
        <section className="page detail-layout">
            <article className="card">
                <Link to="/gigs" className="muted">&larr; Back to gigs</Link>
                <span className="tag">{gig.category}</span>
                <h1>{gig.title}</h1>
                <p className="muted">by {gig.freelancer?.username || 'Unknown freelancer'} &middot; listed {formatDate(gig.createdAt)}</p>
                <p className="description">{gig.description}</p>
                <dl className="facts">
                    <div><dt>Price</dt><dd>{formatCurrency(gig.price)}</dd></div>
                    <div><dt>Delivery</dt><dd>{gig.deliveryDays} days</dd></div>
                </dl>
                {isOwner && <Link to={`/gigs/${gig._id}/edit`} className="btn btn-secondary">Edit this gig</Link>}
            </article>

            {user.role === ROLES.CLIENT && (
                <aside className="card booking-panel">
                    {booking ? (
                        <div>
                            <h2>Booking confirmed</h2>
                            <Alert type="success">{booking.message}</Alert>
                            <dl className="facts">
                                <div><dt>Amount paid</dt><dd>{formatCurrency(booking.transaction.amount)}</dd></div>
                                <div><dt>Transaction ref</dt><dd className="mono">{booking.transaction.reference}</dd></div>
                                <div><dt>Status</dt><dd>{booking.booking.status}</dd></div>
                            </dl>
                            <Link to="/bookings" className="btn btn-primary">View my bookings</Link>
                        </div>
                    ) : (
                        <form onSubmit={handleBook} noValidate className="form">
                            <h2>Book this gig</h2>
                            <Alert>{bookingError}</Alert>
                            <FormField
                                id="notes" label="Notes for the freelancer (optional)" as="textarea" rows={3} maxLength={500}
                                value={notes} onChange={(e) => setNotes(e.target.value)}
                            />
                            <label className="checkbox">
                                <input type="checkbox" checked={confirmPayment} onChange={(e) => setConfirmPayment(e.target.checked)} />
                                I confirm the simulated payment of {formatCurrency(gig.price)}
                            </label>
                            <p className="hint">No real payment is processed. A transaction record is created for your booking.</p>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? 'Processing...' : `Pay ${formatCurrency(gig.price)} & book`}
                            </button>
                        </form>
                    )}
                </aside>
            )}
        </section>
    );
};

export default GigDetailPage;
