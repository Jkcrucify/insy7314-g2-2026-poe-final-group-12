const js = require('@eslint/js');
const globals = require('globals');
const security = require('eslint-plugin-security');
const jest = require('eslint-plugin-jest');

// -----------------------------------------------------------------------------
// Static code analysis for the API
// -----------------------------------------------------------------------------
// Two layers run over every file:
//   1. ESLint's own recommended rules, which catch correctness bugs that would
//      otherwise only show up at runtime (unreachable code, unused variables,
//      shadowed declarations, forgotten awaits).
//   2. eslint-plugin-security, a static application security testing (SAST)
//      ruleset that flags dangerous patterns: non-literal regular expressions
//      (ReDoS), object injection through computed keys, child_process use,
//      unsafe buffer allocation, timing-unsafe comparisons and eval.
//
// The pipeline runs this with --max-warnings=0, so any finding fails the build.
// -----------------------------------------------------------------------------

module.exports = [
    {
        ignores: ['node_modules/**', 'tests/reports/**', 'tests/.tmp-logs/**', 'logs/**', 'certs/**']
    },
    js.configs.recommended,
    security.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            // Correctness
            'no-unused-vars': ['error', { argsIgnorePattern: '^(next|req|res)$', ignoreRestSiblings: true }],
            'no-console': 'error', // All output must go through the structured logger
            'no-return-await': 'error',
            'require-await': 'error',
            'no-throw-literal': 'error',
            eqeqeq: ['error', 'always'],

            // Security-relevant correctness
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-proto': 'error',
            'no-extend-native': 'error',

            // Consistency
            'prefer-const': 'error',
            'no-var': 'error',
            curly: ['error', 'multi-line']
        }
    },
    {
        // Operator-run command line scripts. These are never loaded by the server,
        // so their output belongs on the terminal rather than in the structured
        // log: printing to stdout is the whole point of running one.
        files: ['scripts/**/*.js'],
        rules: {
            'no-console': 'off'
        }
    },
    {
        // Tests deliberately build malicious payloads and index objects by key
        files: ['tests/**/*.js'],
        plugins: { jest },
        languageOptions: {
            globals: { ...globals.node, ...globals.jest }
        },
        rules: {
            'security/detect-object-injection': 'off',
            'security/detect-non-literal-regexp': 'off',
            'jest/no-focused-tests': 'error',
            'jest/no-identical-title': 'error',
            'jest/valid-expect': 'error'
        }
    }
];
