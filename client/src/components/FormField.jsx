// Label + input + inline error message, wired up for accessibility
const FormField = ({ id, label, error, as = 'input', children, ...inputProps }) => {
    const Component = as;
    const errorId = `${id}-error`;
    return (
        <div className="form-field">
            <label htmlFor={id}>{label}</label>
            <Component
                id={id}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                {...inputProps}
            >
                {children}
            </Component>
            {error && <p id={errorId} className="field-error">{error}</p>}
        </div>
    );
};

export default FormField;
