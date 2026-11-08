import { useState } from 'react';
import FormField from './FormField';
import Alert from './Alert';
import { GIG_CATEGORIES } from '../utils/constants';
import { serverErrorsToMap, validateGig } from '../utils/validation';

const EMPTY_GIG = { title: '', description: '', category: '', price: '', deliveryDays: '' };

// Shared form for creating and editing gigs
const GigForm = ({ initialValues = EMPTY_GIG, submitLabel, onSubmit }) => {
    const [values, setValues] = useState({
        ...EMPTY_GIG,
        ...initialValues,
        price: String(initialValues.price ?? ''),
        deliveryDays: String(initialValues.deliveryDays ?? '')
    });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setValues(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');
        const validationErrors = validateGig(values);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({
                title: values.title.trim(),
                description: values.description.trim(),
                category: values.category,
                price: Number(values.price),
                deliveryDays: Number(values.deliveryDays)
            });
        } catch (error) {
            setErrors(serverErrorsToMap(error.errors));
            setFormError(error.message);
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="form">
            <Alert>{formError}</Alert>
            <FormField
                id="title" name="title" label="Title" maxLength={100}
                value={values.title} onChange={handleChange} error={errors.title}
            />
            <FormField
                id="description" name="description" label="Description" as="textarea" rows={5} maxLength={1000}
                value={values.description} onChange={handleChange} error={errors.description}
            />
            <FormField
                id="category" name="category" label="Category" as="select"
                value={values.category} onChange={handleChange} error={errors.category}
            >
                <option value="">Select a category</option>
                {GIG_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </FormField>
            <div className="form-row">
                <FormField
                    id="price" name="price" label="Price (ZAR)" type="number" min={50} max={100000} step="0.01"
                    value={values.price} onChange={handleChange} error={errors.price}
                />
                <FormField
                    id="deliveryDays" name="deliveryDays" label="Delivery time (days)" type="number" min={1} max={60}
                    value={values.deliveryDays} onChange={handleChange} error={errors.deliveryDays}
                />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : submitLabel}
            </button>
        </form>
    );
};

export default GigForm;
