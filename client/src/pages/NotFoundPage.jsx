import { Link } from 'react-router-dom';

const NotFoundPage = () => (
    <section className="page narrow">
        <h1>Page not found</h1>
        <p className="muted">The page you are looking for does not exist.</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
    </section>
);

export default NotFoundPage;
