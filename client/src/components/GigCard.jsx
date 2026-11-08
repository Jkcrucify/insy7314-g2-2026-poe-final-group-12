import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/format';

const GigCard = ({ gig }) => (
    <article className="card gig-card">
        <span className="tag">{gig.category}</span>
        <h3>{gig.title}</h3>
        <p className="muted clamp">{gig.description}</p>
        <div className="gig-meta">
            <span className="price">{formatCurrency(gig.price)}</span>
            <span className="muted">{gig.deliveryDays} day{gig.deliveryDays === 1 ? '' : 's'} delivery</span>
        </div>
        <div className="gig-footer">
            <span className="muted">by {gig.freelancer?.username || 'Unknown freelancer'}</span>
            <Link to={`/gigs/${gig._id}`} className="btn btn-secondary" aria-label={`View details for ${gig.title}`}>
                View details
            </Link>
        </div>
    </article>
);

export default GigCard;
