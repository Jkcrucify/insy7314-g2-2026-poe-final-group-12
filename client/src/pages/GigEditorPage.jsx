import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import GigForm from '../components/GigForm';
import Alert from '../components/Alert';

// Handles both /gigs/new (create) and /gigs/:id/edit (update)
const GigEditorPage = () => {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const { user } = useAuth();
    const navigate = useNavigate();
    const [gig, setGig] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isEdit) return;
        api.get(`/gigs/${encodeURIComponent(id)}`)
            .then(data => {
                if (data.gig.freelancer?._id !== user.id) {
                    setError('You can only edit your own gigs.');
                } else {
                    setGig(data.gig);
                }
            })
            .catch(err => setError(err.message));
    }, [id, isEdit, user.id]);

    const handleSubmit = async (values) => {
        const data = isEdit
            ? await api.put(`/gigs/${gig._id}`, values)
            : await api.post('/gigs', values);
        navigate(`/gigs/${data.gig._id}`);
    };

    return (
        <section className="page narrow">
            <h1>{isEdit ? 'Edit gig' : 'Create a gig'}</h1>
            <Alert>{error}</Alert>
            {error && <Link to="/dashboard">Back to dashboard</Link>}
            {!error && isEdit && !gig && <p className="muted">Loading gig...</p>}
            {!error && (!isEdit || gig) && (
                <div className="card">
                    <GigForm
                        initialValues={gig || undefined}
                        submitLabel={isEdit ? 'Save changes' : 'Publish gig'}
                        onSubmit={handleSubmit}
                    />
                </div>
            )}
        </section>
    );
};

export default GigEditorPage;
