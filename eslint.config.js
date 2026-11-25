'use strict';

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**', 'logs/**', 'uploads/**', 'uploads-test/**'],
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType : 'commonjs',
      globals    : {
        // Node.js globals
        __dirname  : 'readonly',
        __filename : 'readonly',
        Buffer     : 'readonly',
        console    : 'readonly',
        exports    : 'writable',
        global     : 'readonly',
        module     : 'writable',
        process    : 'readonly',
        require    : 'readonly',
        setTimeout : 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate   : 'readonly',
        URL            : 'readonly',
        URLSearchParams: 'readonly',
        fetch          : 'readonly',
        // Jest globals
        afterAll   : 'readonly',
        afterEach  : 'readonly',
        beforeAll  : 'readonly',
        beforeEach : 'readonly',
        describe   : 'readonly',
        expect     : 'readonly',
        it         : 'readonly',
        jest       : 'readonly',
        test       : 'readonly',
      },
    },
    rules: {
      'no-unused-vars'  : ['warn', { argsIgnorePattern: '^_|^next$' }],
      'no-undef'        : 'error',
      'no-var'          : 'error',
      'prefer-const'    : 'warn',
      'eqeqeq'          : ['error', 'always'],
      'no-console'      : 'off',
      'no-constant-condition': 'warn',
      'no-unreachable'  : 'error',
    },
  },
];

