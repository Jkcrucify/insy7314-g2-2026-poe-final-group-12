const { estimateTax, getTaxYear, AGE_GROUPS, TAX_TABLE } = require('../../utils/tax');

describe('getTaxYear', () => {
    it('starts the tax year on 1 March', () => {
        const year = getTaxYear(new Date('2025-03-01T00:00:00Z'));
        expect(year.label).toBe('2025/2026');
        expect(year.start.toISOString()).toBe('2025-03-01T00:00:00.000Z');
        expect(year.end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('places dates in January and February in the previous tax year', () => {
        expect(getTaxYear(new Date('2026-02-28T23:59:59Z')).label).toBe('2025/2026');
        expect(getTaxYear(new Date('2026-01-15T00:00:00Z')).label).toBe('2025/2026');
    });

    it('rolls over on the first day of the new tax year', () => {
        expect(getTaxYear(new Date('2026-03-01T00:00:00Z')).label).toBe('2026/2027');
    });
});

describe('estimateTax', () => {
    it('charges no tax on zero income', () => {
        const result = estimateTax({ grossIncome: 0 });
        expect(result.taxPayable).toBe(0);
        expect(result.effectiveRate).toBe(0);
        expect(result.marginalRate).toBe(0);
        expect(result.belowThreshold).toBe(true);
    });

    it('charges no tax exactly at the under-65 threshold', () => {
        // R95 750 x 18% = R17 235, which is cancelled out exactly by the primary rebate
        const result = estimateTax({ grossIncome: 95750 });
        expect(result.grossTax).toBe(17235);
        expect(result.rebate).toBe(17235);
        expect(result.taxPayable).toBe(0);
    });

    it('charges 18% less the rebate inside the first bracket', () => {
        const result = estimateTax({ grossIncome: 120000 });
        // 120 000 x 18% = 21 600; 21 600 - 17 235 = 4 365
        expect(result.grossTax).toBe(21600);
        expect(result.taxPayable).toBe(4365);
        expect(result.marginalRate).toBe(18);
    });

    it('applies the cumulative base plus the marginal slice in a higher bracket', () => {
        const result = estimateTax({ grossIncome: 500000 });
        // 121 475 is the base at 512 800, so 500 000 sits in the 31% bracket:
        // 77 362 + (500 000 - 370 500) x 31% = 117 507
        expect(result.grossTax).toBe(117507);
        expect(result.taxPayable).toBe(100272);
        expect(result.marginalRate).toBe(31);
        expect(result.effectiveRate).toBeCloseTo(20.05, 2);
    });

    it('taxes the top bracket at 45%', () => {
        const result = estimateTax({ grossIncome: 2000000 });
        // 644 489 + (2 000 000 - 1 817 000) x 45% = 726 839, less the rebate
        expect(result.grossTax).toBe(726839);
        expect(result.taxPayable).toBe(709604);
        expect(result.marginalRate).toBe(45);
    });

    it('deducts expenses before calculating tax', () => {
        const withoutExpenses = estimateTax({ grossIncome: 300000 });
        const withExpenses = estimateTax({ grossIncome: 300000, expenses: 50000 });

        expect(withExpenses.taxableIncome).toBe(250000);
        expect(withExpenses.taxPayable).toBeLessThan(withoutExpenses.taxPayable);
    });

    it('never lets expenses push taxable income below zero', () => {
        const result = estimateTax({ grossIncome: 10000, expenses: 999999 });
        expect(result.taxableIncome).toBe(0);
        expect(result.expenses).toBe(10000);
        expect(result.taxPayable).toBe(0);
    });

    it('gives older taxpayers a larger rebate and a higher threshold', () => {
        const under65 = estimateTax({ grossIncome: 200000, ageGroup: AGE_GROUPS.UNDER_65 });
        const over65 = estimateTax({ grossIncome: 200000, ageGroup: AGE_GROUPS.AGE_65_TO_74 });
        const over75 = estimateTax({ grossIncome: 200000, ageGroup: AGE_GROUPS.AGE_75_PLUS });

        expect(over65.taxPayable).toBeLessThan(under65.taxPayable);
        expect(over75.taxPayable).toBeLessThan(over65.taxPayable);
        expect(over75.threshold).toBeGreaterThan(under65.threshold);
    });

    it('splits income across the brackets so the bands add up to the gross tax', () => {
        const result = estimateTax({ grossIncome: 900000 });
        const bandTotal = result.bands.reduce((sum, band) => sum + band.taxInBand, 0);

        expect(bandTotal).toBeCloseTo(result.grossTax, 2);
        expect(result.bands.reduce((sum, b) => sum + b.incomeInBand, 0)).toBeCloseTo(900000, 2);
    });

    it('splits the tax into two provisional payments', () => {
        const result = estimateTax({ grossIncome: 500000 });
        expect(result.provisionalPayment * 2).toBeCloseTo(result.taxPayable, 2);
    });

    it('take-home plus tax always equals taxable income', () => {
        for (const income of [0, 50000, 95750, 237100, 400000, 1000000, 5000000]) {
            const result = estimateTax({ grossIncome: income });
            expect(result.netIncome + result.taxPayable).toBeCloseTo(result.taxableIncome, 2);
        }
    });

    it('treats missing, negative and non-numeric input as zero income', () => {
        expect(estimateTax().taxPayable).toBe(0);
        expect(estimateTax({ grossIncome: -5000 }).taxableIncome).toBe(0);
        expect(estimateTax({ grossIncome: 'not a number' }).taxableIncome).toBe(0);
        expect(estimateTax({ grossIncome: 120000, expenses: -100 }).expenses).toBe(0);
    });

    it('falls back to the under-65 tables for an unknown age group', () => {
        const result = estimateTax({ grossIncome: 200000, ageGroup: 'wizard' });
        expect(result.ageGroup).toBe(AGE_GROUPS.UNDER_65);
        expect(result.rebate).toBe(TAX_TABLE.rebates[AGE_GROUPS.UNDER_65]);
    });

    it('increases tax monotonically with income', () => {
        let previous = -1;
        for (let income = 0; income <= 2000000; income += 25000) {
            const { taxPayable } = estimateTax({ grossIncome: income });
            expect(taxPayable).toBeGreaterThanOrEqual(previous);
            previous = taxPayable;
        }
    });
});
