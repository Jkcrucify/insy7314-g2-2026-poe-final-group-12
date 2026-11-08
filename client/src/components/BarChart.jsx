import { useId, useState } from 'react';

// Monthly income chart: a single series of magnitudes over time, so vertical bars
// with a recessive baseline. One series means no legend is needed (the heading
// names it); only the highest bar is labelled directly, the rest are on hover.
// A data table is always available underneath for screen readers and for anyone
// who cannot distinguish the marks.

const VIEW_W = 720;
const VIEW_H = 260;
const PAD = { top: 24, right: 12, bottom: 34, left: 12 };
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const BAR_GAP = 2; // 2px surface gap between adjacent bars

const niceCeiling = (value) => {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    return Math.ceil(value / magnitude) * magnitude;
};

const BarChart = ({ data = [], formatValue = (v) => v, label = 'Chart', emptyMessage = 'No data yet.' }) => {
    const [active, setActive] = useState(null);
    const titleId = useId();

    // Coerce once: a missing or non-numeric value must not turn the whole scale into NaN
    const points = data.map(point => ({ ...point, value: Number(point.value) || 0 }));
    const max = Math.max(0, ...points.map(d => d.value));
    const scaleMax = niceCeiling(max);
    const hasData = max > 0;

    const slotW = (VIEW_W - PAD.left - PAD.right) / Math.max(1, points.length);
    const barW = Math.max(6, slotW - BAR_GAP * 2);

    const yOf = (value) => PAD.top + PLOT_H - (value / scaleMax) * PLOT_H;

    // Three recessive gridlines: zero, midpoint and the top of the scale
    const gridValues = [0, scaleMax / 2, scaleMax];

    return (
        <div className="chart">
            <div className="chart-plot">
                <svg
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    role="img"
                    aria-labelledby={titleId}
                    preserveAspectRatio="xMidYMid meet"
                >
                    <title id={titleId}>
                        {hasData
                            ? `${label}. Highest month ${formatValue(max)}.`
                            : `${label}. ${emptyMessage}`}
                    </title>

                    {gridValues.map(value => (
                        <g key={value}>
                            <line
                                className="chart-grid"
                                x1={PAD.left}
                                x2={VIEW_W - PAD.right}
                                y1={yOf(value)}
                                y2={yOf(value)}
                            />
                            <text className="chart-axis-label" x={PAD.left} y={yOf(value) - 5}>
                                {formatValue(value)}
                            </text>
                        </g>
                    ))}

                    {points.map((point, index) => {
                        const x = PAD.left + index * slotW + BAR_GAP;
                        const isActive = active === index;
                        const barH = hasData ? Math.max(0, PLOT_H - (yOf(point.value) - PAD.top)) : 0;
                        const isMax = hasData && point.value === max;

                        return (
                            <g key={point.key || point.label}>
                                {/* Hit target spans the full slot height, not just the bar */}
                                <rect
                                    x={PAD.left + index * slotW}
                                    y={PAD.top}
                                    width={slotW}
                                    height={PLOT_H}
                                    fill="transparent"
                                    onMouseEnter={() => setActive(index)}
                                    onMouseLeave={() => setActive(null)}
                                    onFocus={() => setActive(index)}
                                    onBlur={() => setActive(null)}
                                    tabIndex={0}
                                    role="presentation"
                                >
                                    <title>{`${point.label}: ${formatValue(point.value)}`}</title>
                                </rect>

                                {point.value > 0 ? (
                                    <rect
                                        className={`chart-bar${isActive ? ' is-active' : ''}`}
                                        x={x}
                                        y={yOf(point.value)}
                                        width={barW}
                                        height={barH}
                                        rx="4"
                                    />
                                ) : (
                                    // A flat tick keeps empty months visible on the baseline
                                    <rect
                                        className="chart-bar-empty"
                                        x={x}
                                        y={yOf(0) - 2}
                                        width={barW}
                                        height={2}
                                        rx="1"
                                    />
                                )}

                                {(isMax || isActive) && point.value > 0 && (
                                    <text
                                        className="chart-value-label"
                                        x={x + barW / 2}
                                        y={yOf(point.value) - 7}
                                        textAnchor="middle"
                                    >
                                        {formatValue(point.value)}
                                    </text>
                                )}

                                <text
                                    className={`chart-axis-label${isActive ? ' is-active' : ''}`}
                                    x={x + barW / 2}
                                    y={VIEW_H - 14}
                                    textAnchor="middle"
                                >
                                    {point.label}
                                </text>
                            </g>
                        );
                    })}

                    <line
                        className="chart-baseline"
                        x1={PAD.left}
                        x2={VIEW_W - PAD.right}
                        y1={yOf(0)}
                        y2={yOf(0)}
                    />
                </svg>
            </div>

            {!hasData && <p className="muted small chart-empty">{emptyMessage}</p>}

            <details className="chart-table">
                <summary>Show the data as a table</summary>
                <div className="table-wrap">
                    <table>
                        <caption className="sr-only">{label}</caption>
                        <thead>
                            <tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Transactions</th></tr>
                        </thead>
                        <tbody>
                            {points.map(point => (
                                <tr key={point.key || point.label}>
                                    <th scope="row">{point.label}</th>
                                    <td>{formatValue(point.value)}</td>
                                    <td>{point.transactions ?? 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
};

export default BarChart;
