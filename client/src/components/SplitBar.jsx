import { useId } from 'react';

// Part-to-whole for two or three segments (take-home vs tax). A single
// horizontal segmented bar reads better than a pie at this size: the segments
// share one baseline, so their lengths are directly comparable. Two segments
// means a legend is required, and at this count every segment is also labelled
// directly, so identity never rests on colour alone.

const SplitBar = ({ segments = [], formatValue = (v) => v, label = 'Breakdown' }) => {
    const titleId = useId();
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

    const withShare = segments.map(segment => ({
        ...segment,
        value: Math.max(0, segment.value),
        share: total > 0 ? (Math.max(0, segment.value) / total) * 100 : 0
    }));

    return (
        <div className="split">
            <ul className="legend">
                {withShare.map(segment => (
                    <li key={segment.label}>
                        <span className="legend-swatch" style={{ background: segment.color }} aria-hidden="true" />
                        {segment.label}
                    </li>
                ))}
            </ul>

            <div
                className="split-bar"
                role="img"
                aria-labelledby={titleId}
            >
                <span id={titleId} className="sr-only">
                    {`${label}: ${withShare.map(s => `${s.label} ${formatValue(s.value)}`).join(', ')}.`}
                </span>
                {total === 0 ? (
                    <span className="split-segment is-empty" style={{ width: '100%' }} />
                ) : (
                    withShare
                        .filter(segment => segment.share > 0)
                        .map(segment => (
                            <span
                                key={segment.label}
                                className="split-segment"
                                style={{ width: `${segment.share.toFixed(2)}%`, background: segment.color }}
                                title={`${segment.label}: ${formatValue(segment.value)} (${segment.share.toFixed(1)}%)`}
                            />
                        ))
                )}
            </div>

            <dl className="split-values">
                {withShare.map(segment => (
                    <div key={segment.label}>
                        <dt>{segment.label}</dt>
                        <dd>
                            {formatValue(segment.value)}
                            <span className="muted small"> · {segment.share.toFixed(1)}%</span>
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};

export default SplitBar;
