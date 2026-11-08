import { passwordProblems, serverErrorsToMap, validateGig, validateRegister } from '../utils/validation';

describe('validation utilities', () => {
    it('accepts a strong password and lists problems with a weak one', () => {
        expect(passwordProblems('Str0ng!Pass')).toEqual([]);
        expect(passwordProblems('weak')).toEqual(
            expect.arrayContaining(['8-64 characters', 'an uppercase letter', 'a number', 'a symbol'])
        );
    });

    it('rejects roles other than Client and Freelancer', () => {
        const errors = validateRegister({
            username: 'attacker', email: 'a@test.com', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', role: 'Admin'
        });
        expect(errors.role).toBeDefined();
    });

    it('rejects usernames with special characters', () => {
        const errors = validateRegister({
            username: '<script>', email: 'a@test.com', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', role: 'Client'
        });
        expect(errors.username).toBe('Use only letters, numbers and underscores.');
    });

    it('validates gig fields', () => {
        expect(validateGig({
            title: 'Logo Design', description: 'A professional logo for your brand.', category: 'Design', price: '1500', deliveryDays: '5'
        })).toEqual({});

        const errors = validateGig({ title: 'x', description: 'short', category: 'Hacking', price: '-1', deliveryDays: '0' });
        expect(Object.keys(errors).sort()).toEqual(['category', 'deliveryDays', 'description', 'price', 'title']);
    });

    it('maps server validation errors by field', () => {
        expect(serverErrorsToMap([{ field: 'email', message: 'Bad email' }])).toEqual({ email: 'Bad email' });
    });
});
