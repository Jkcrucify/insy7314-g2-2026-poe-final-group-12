import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BarChart from '../components/BarChart';
import SplitBar from '../components/SplitBar';

const SERIES = [
    { key: 'mar', label: 'Mar 25', value: 0, transactions: 0 },
    { key: 'apr', label: 'Apr 25', value: 40000, transactions: 2 },
    { key: 'may', label: 'May 25', value: 100000, transactions: 3 }
];

describe('BarChart', () => {
    it('describes itself and its highest value to screen readers', () => {
        render(<BarChart data={SERIES} formatValue={(v) => `R${v}`} label="Monthly income" />);

        expect(screen.getByRole('img', { name: /Monthly income\. Highest month R100000\./ })).toBeInTheDocument();
    });

    it('scales bars to the data, with the tallest at full height', () => {
        const { container } = render(<BarChart data={SERIES} formatValue={(v) => `R${v}`} label="Monthly income" />);
        const bars = [...container.querySelectorAll('.chart-bar')];

        expect(bars).toHaveLength(2); // The zero month draws a flat tick instead
        const heights = bars.map(bar => Number(bar.getAttribute('height')));
        expect(heights[1]).toBeGreaterThan(heights[0]);
        expect(container.querySelectorAll('.chart-bar-empty')).toHaveLength(1);
    });

    it('labels only the highest bar directly', () => {
        const { container } = render(<BarChart data={SERIES} formatValue={(v) => `R${v}`} label="Monthly income" />);
        const labels = [...container.querySelectorAll('.chart-value-label')].map(el => el.textContent);

        expect(labels).toEqual(['R100000']);
    });

    it('offers every value as a table', async () => {
        render(<BarChart data={SERIES} formatValue={(v) => `R${v}`} label="Monthly income" />);
        await userEvent.click(screen.getByText('Show the data as a table'));

        const table = screen.getByRole('table', { name: 'Monthly income' });
        expect(within(table).getByRole('rowheader', { name: 'May 25' })).toBeInTheDocument();
        expect(within(table).getByText('R40000')).toBeInTheDocument();
    });

    it('stays readable with no data at all', () => {
        const empty = SERIES.map(point => ({ ...point, value: 0 }));
        render(<BarChart data={empty} label="Monthly income" emptyMessage="No income yet." />);

        expect(screen.getByText('No income yet.')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /No income yet\./ })).toBeInTheDocument();
    });

    it('treats a missing or non-numeric value as zero rather than breaking the scale', () => {
        const { container } = render(
            <BarChart data={[{ label: 'A' }, { label: 'B', value: 'x' }, { label: 'C', value: 100 }]} label="Broken" />
        );

        const coordinates = [...container.querySelectorAll('line, rect')]
            .flatMap(el => ['x1', 'y1', 'x2', 'y2', 'x', 'y', 'width', 'height'].map(a => el.getAttribute(a)))
            .filter(Boolean);

        expect(coordinates.some(value => value.includes('NaN'))).toBe(false);
    });
});

describe('SplitBar', () => {
    const segments = [
        { label: 'Take-home', value: 140235, color: 'var(--series-1)' },
        { label: 'Estimated tax', value: 9765, color: 'var(--series-2)' }
    ];

    it('names both segments in a legend and in the values list', () => {
        render(<SplitBar segments={segments} formatValue={(v) => `R${v}`} label="Split" />);

        expect(screen.getAllByText('Take-home')).not.toHaveLength(0);
        expect(screen.getAllByText('Estimated tax')).not.toHaveLength(0);
        expect(screen.getByText('R140235')).toBeInTheDocument();
    });

    it('sizes each segment by its share of the total', () => {
        const { container } = render(<SplitBar segments={segments} formatValue={(v) => `R${v}`} label="Split" />);
        const widths = [...container.querySelectorAll('.split-segment')].map(el => el.style.width);

        expect(widths[0]).toBe('93.49%');
        expect(widths[1]).toBe('6.51%');
    });

    it('renders an empty bar instead of dividing by zero', () => {
        const { container } = render(
            <SplitBar segments={[{ label: 'A', value: 0 }, { label: 'B', value: 0 }]} label="Split" />
        );

        expect(container.querySelector('.split-segment.is-empty')).not.toBeNull();
    });
});
