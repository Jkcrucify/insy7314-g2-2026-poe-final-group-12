import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GigCard from '../components/GigCard';
import { formatCurrency } from '../utils/format';

const gig = {
    _id: 'g1',
    title: 'Professional Logo Design',
    description: 'A modern logo for your brand.',
    category: 'Design',
    price: 1500,
    deliveryDays: 5,
    freelancer: { _id: 'free1', username: 'sipho' }
};

const renderCard = (props) => render(<MemoryRouter><GigCard gig={{ ...gig, ...props }} /></MemoryRouter>);

describe('GigCard', () => {
    it('renders the gig title, category, price, delivery time and freelancer', () => {
        renderCard();
        expect(screen.getByRole('heading', { name: 'Professional Logo Design' })).toBeInTheDocument();
        expect(screen.getByText('Design')).toBeInTheDocument();
        // en-ZA formatting uses non-breaking spaces, which Testing Library normalises to plain spaces
        expect(screen.getByText(formatCurrency(1500).replace(/\s/g, ' '))).toBeInTheDocument();
        expect(screen.getByText('5 days delivery')).toBeInTheDocument();
        expect(screen.getByText('by sipho')).toBeInTheDocument();
    });

    it('links to the gig detail page', () => {
        renderCard();
        expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/gigs/g1');
    });

    it('renders malicious markup as plain text instead of executing it', () => {
        const { container } = renderCard({ title: '<img src=x onerror=alert(1)>' });
        expect(screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
        expect(container.querySelector('img')).toBeNull();
    });
});
