import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// -----------------------------------------------------------------------------
// Static code analysis for the React client
// -----------------------------------------------------------------------------
// Three rulesets run over every file:
//   1. ESLint recommended - correctness bugs (unused variables, unreachable code).
//   2. react + react-hooks - component correctness, and the rules of hooks, which
//      catch stale closures and conditional hook calls that cause subtle, hard to
//      reproduce bugs in production.
//   3. jsx-a11y - accessibility defects such as inputs without labels and
//      interactive elements that cannot be reached from the keyboard.
//
// Two rules below are specifically about cross-site scripting in the frontend:
// react/no-danger and react/jsx-no-script-url are errors, so no one can
// reintroduce dangerouslySetInnerHTML or a javascript: URL.
// The pipeline runs this with --max-warnings=0, so any finding fails the build.
// -----------------------------------------------------------------------------

export default [
    { ignores: ['dist/**', 'node_modules/**', 'test-report/**', 'coverage/**'] },
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.browser },
            parserOptions: {
                ecmaFeatures: { jsx: true }
            }
        },
        settings: { react: { version: 'detect' } },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'jsx-a11y': jsxA11y
        },
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.flatConfigs.recommended.rules,

            // Cross-site scripting: both of these inject unescaped markup or URLs
            'react/no-danger': 'error',
            'react/jsx-no-script-url': 'error',
            'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],

            // Correctness
            'no-console': 'error',
            eqeqeq: ['error', 'always'],
            'prefer-const': 'error',
            'no-var': 'error',

            // Prop types are not used in this project; the API contract is covered by tests
            'react/prop-types': 'off',

            // Off by deliberate decision, not because it was noisy: this project
            // loads data on mount with useEffect + a loading flag, which is the
            // documented React pattern for fetching on render. The rule exists to
            // discourage cascading renders from derived state, which is a different
            // thing. Every other rule of hooks stays an error.
            'react-hooks/set-state-in-effect': 'off'
        }
    },
    {
        files: ['**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
        languageOptions: {
            // Vitest is configured with globals: true, so the test API is ambient
            globals: {
                ...globals.browser,
                ...globals.node,
                vi: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly'
            }
        }
    },
    {
        files: ['vite.config.js', 'eslint.config.js'],
        languageOptions: {
            globals: { ...globals.node }
        }
    }
];
