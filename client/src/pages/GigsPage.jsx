import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import GigCard from '../components/GigCard';
import Alert from '../components/Alert';
import { GIG_CATEGORIES, ROLES } from '../utils/constants';

const GigsPage = () => {
    const { user } = useAuth();
    const [gigs, setGigs] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadGigs = useCallback(async (filters = {}) => {
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.category) params.set('category', filters.category);
        const query = params.toString();
        try {
            const data = await api.get(`/gigs${query ? `?${query}` : ''}`);
            setGigs(data.gigs);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGigs();
    }, [loadGigs]);

    const handleSearch = (event) => {
        event.preventDefault();
        loadGigs({ search: search.trim(), category });
    };

    return (
        <section className="page">
            <div className="page-header">
                <h1>Browse gigs</h1>
                {user.role === ROLES.FREELANCER && <Link to="/gigs/new" className="btn btn-primary">Create a gig</Link>}
            </div>

            <form className="search-bar" onSubmit={handleSearch} role="search">
                <label htmlFor="search" className="sr-only">Search gigs</label>
                <input
                    id="search" type="search" placeholder="Search gigs..." maxLength={100}
                    value={search} onChange={(e) => setSearch(e.target.value)}
                />
                <label htmlFor="category-filter" className="sr-only">Category</label>
                <select id="category-filter" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {GIG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="submit" className="btn btn-primary">Search</button>
            </form>

            <Alert>{error}</Alert>
            {loading && <p className="muted">Loading gigs...</p>}
            {!loading && !error && gigs.length === 0 && <p className="muted">No gigs found.</p>}
            <div className="grid">
                {gigs.map(gig => <GigCard key={gig._id} gig={gig} />)}
            </div>
        </section>
    );
};

export default GigsPage;
