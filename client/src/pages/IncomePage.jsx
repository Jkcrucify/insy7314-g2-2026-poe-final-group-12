import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Alert from '../components/Alert';
import BarChart from '../components/BarChart';
import SplitBar from '../components/SplitBar';
import { formatCompactCurrency, formatCurrency, formatPercent } from '../utils/format';

const AGE_GROUPS = [
    { value: 'under65', label: 'Under 65' },
    { value: '65to74', label: '65 to 74' },
    { value: '75plus', label: '75 and over' }
];

const IncomePage = () => {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    // Planning inputs: applied on submit, not on every keystroke
    const [expensesInput, setExpensesInput] = useState('0');
    const [ageInput, setAgeInput] = useState('under65');
    const [applied, setApplied] = useState({ expenses: 0, ageGroup: 'under65' });

    const load = useCallback(async ({ expenses, ageGroup }) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ expenses: String(expenses), ageGroup });
            setSummary(await api.get(`/transactions/income?${params.toString()}`));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(applied);
    }, [load, applied]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const expenses = Number(expensesInput);
        if (!Number.isFinite(expenses) || expenses < 0) {
            setError('Expenses must be zero or a positive amount.');
            return;
        }
        setApplied({ expenses, ageGroup: ageInput });
    };

    const tax = summary?.tax;
    const taxYear = summary?.taxYear;

    return (
        <section className="page">
            <div className="page-header">
                <h1>Income &amp; tax</h1>
                <Link to="/dashboard" className="btn btn-ghost">Back to dashboard</Link>
            </div>

            <Alert>{error}</Alert>

            {loading && !summary && <p className="muted">Loading your figures...</p>}

            {summary && (
                <>
                    <p className="summary">
                        Tax year <strong>{taxYear.label}</strong> (1 March {taxYear.label.split('/')[0]} to
                        {' '}28 February {taxYear.label.split('/')[1]}) &middot;{' '}
                        {taxYear.transactionCount} paid booking{taxYear.transactionCount === 1 ? '' : 's'}
                    </p>

                    <div className="stats">
                        <div className="card stat accent">
                            <span className="stat-label">Income this tax year</span>
                            <span className="stat-value">{formatCurrency(taxYear.income)}</span>
                            <span className="stat-note">{formatCurrency(summary.totalIncome)} all time</span>
                        </div>
                        <div className="card stat accent-tax">
                            <span className="stat-label">Estimated tax</span>
                            <span className="stat-value">{formatCurrency(tax.taxPayable)}</span>
                            <span className="stat-note">
                                {tax.belowThreshold
                                    ? `Below the ${formatCurrency(tax.threshold)} threshold`
                                    : `${formatPercent(tax.effectiveRate)} effective rate`}
                            </span>
                        </div>
                        <div className="card stat">
                            <span className="stat-label">Estimated take-home</span>
                            <span className="stat-value">{formatCurrency(tax.netIncome)}</span>
                            <span className="stat-note">After tax and expenses</span>
                        </div>
                        <div className="card stat">
                            <span className="stat-label">Marginal rate</span>
                            <span className="stat-value">{formatPercent(tax.marginalRate)}</span>
                            <span className="stat-note">Tax on your next rand earned</span>
                        </div>
                    </div>

                    <div className="charts">
                        <div className="card chart-card">
                            <h2>Income by month</h2>
                            <p className="caption">
                                Successful transactions for each month of the {taxYear.label} tax year.
                            </p>
                            <BarChart
                                data={summary.monthly.map(month => ({
                                    key: month.key,
                                    label: month.label,
                                    value: month.income,
                                    transactions: month.transactions
                                }))}
                                formatValue={formatCompactCurrency}
                                label={`Monthly income for the ${taxYear.label} tax year`}
                                emptyMessage="No income recorded in this tax year yet."
                            />
                        </div>

                        <div className="card chart-card">
                            <h2>Where your income goes</h2>
                            <p className="caption">Taxable income split between tax and take-home pay.</p>
                            <SplitBar
                                label="Take-home pay versus estimated tax"
                                formatValue={formatCurrency}
                                segments={[
                                    { label: 'Take-home', value: tax.netIncome, color: 'var(--series-1)' },
                                    { label: 'Estimated tax', value: tax.taxPayable, color: 'var(--series-2)' }
                                ]}
                            />
                            {tax.taxPayable > 0 && (
                                <p className="caption" style={{ marginTop: '1rem' }}>
                                    Provisional taxpayers pay this in two instalments of{' '}
                                    <strong>{formatCurrency(tax.provisionalPayment)}</strong> (end of August and
                                    end of February).
                                </p>
                            )}
                        </div>
                    </div>

                    <h2>Adjust the estimate</h2>
                    <form className="tax-controls" onSubmit={handleSubmit}>
                        <div className="form-field">
                            <label htmlFor="expenses">Deductible business expenses (R)</label>
                            <input
                                id="expenses"
                                name="expenses"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={expensesInput}
                                onChange={(e) => setExpensesInput(e.target.value)}
                            />
                        </div>
                        <div className="form-field">
                            <label htmlFor="ageGroup">Age group</label>
                            <select
                                id="ageGroup"
                                name="ageGroup"
                                value={ageInput}
                                onChange={(e) => setAgeInput(e.target.value)}
                            >
                                {AGE_GROUPS.map(group => (
                                    <option key={group.value} value={group.value}>{group.label}</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Calculating...' : 'Recalculate'}
                        </button>
                    </form>

                    <h2>How this is worked out</h2>
                    <div className="tax-note">
                        <p>
                            Freelance income is taxed as personal income using the SARS individual
                            tables for {summary.taxYear.tableLabel}:
                        </p>
                        <ol>
                            <li>
                                <strong>Taxable income</strong> = income earned this tax year
                                ({formatCurrency(tax.grossIncome)}) minus expenses ({formatCurrency(tax.expenses)}) ={' '}
                                {formatCurrency(tax.taxableIncome)}.
                            </li>
                            <li>
                                <strong>Gross tax</strong> = each slice of income taxed at its own bracket rate ={' '}
                                {formatCurrency(tax.grossTax)}.
                            </li>
                            <li>
                                <strong>Less the rebate</strong> of {formatCurrency(tax.rebate)}, which every
                                taxpayer receives, giving {formatCurrency(tax.taxPayable)} payable.
                            </li>
                            <li>
                                Income up to {formatCurrency(tax.threshold)} is therefore tax free, because the
                                rebate cancels the tax out entirely.
                            </li>
                        </ol>
                        <p>
                            This is an estimate for planning only. It assumes no other income and no VAT
                            registration, and it is not a substitute for a tax return.
                        </p>
                    </div>

                    <h2>Tax brackets applied</h2>
                    <div className="table-wrap">
                        <table>
                            <caption className="sr-only">How your taxable income is split across the tax brackets</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Bracket</th>
                                    <th scope="col">Rate</th>
                                    <th scope="col" className="numeric">Your income in this bracket</th>
                                    <th scope="col" className="numeric">Tax from this bracket</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tax.bands.map(band => (
                                    <tr key={band.from}>
                                        <th scope="row">
                                            {formatCurrency(band.from)}
                                            {band.to ? ` – ${formatCurrency(band.to)}` : ' and above'}
                                        </th>
                                        <td>{formatPercent(band.rate)}</td>
                                        <td className="numeric">{formatCurrency(band.incomeInBand)}</td>
                                        <td className="numeric">{formatCurrency(band.taxInBand)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th scope="row" colSpan="3">Gross tax before rebate</th>
                                    <td className="numeric"><strong>{formatCurrency(tax.grossTax)}</strong></td>
                                </tr>
                                <tr>
                                    <th scope="row" colSpan="3">Less rebate</th>
                                    <td className="numeric">-{formatCurrency(tax.rebate)}</td>
                                </tr>
                                <tr>
                                    <th scope="row" colSpan="3">Estimated tax payable</th>
                                    <td className="numeric"><strong>{formatCurrency(tax.taxPayable)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {summary.topGigs.length > 0 && (
                        <>
                            <h2>Top earning gigs this tax year</h2>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th scope="col">Gig</th>
                                            <th scope="col" className="numeric">Bookings</th>
                                            <th scope="col" className="numeric">Income</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.topGigs.map(gig => (
                                            <tr key={gig.title}>
                                                <th scope="row">{gig.title}</th>
                                                <td className="numeric">{gig.count}</td>
                                                <td className="numeric">{formatCurrency(gig.income)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </section>
    );
};

export default IncomePage;
