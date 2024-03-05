const config = require('@rubensworks/eslint-config');

module.exports = config([
  {
    files: [ '**/*.ts' ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [ './tsconfig.eslint.json' ],
      },
    },
  },
  {
    files: [ '**/*.ts' ],
    rules: {
      'import/no-nodejs-modules': 'off',
      'ts/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: [ 'PascalCase' ],
          custom: {
            regex: '^[A-Z]',
            match: true,
          },
        },
      ],
      // TODO: check if we can enable the following
      'ts/no-require-imports': 'off',
      'ts/no-unsafe-assignment': 'off',
      'ts/no-unsafe-argument': 'off',
      'ts/no-unsafe-return': 'off',
    },
  },
  {
    // Specific rules for NodeJS-specific files
    files: [
      '**/test/**/*.ts',
    ],
    rules: {
      'import/no-nodejs-modules': 'off',
      'unused-imports/no-unused-vars': 'off',
      'ts/no-require-imports': 'off',
      'ts/no-var-requires': 'off',
      'ts/no-extraneous-class': 'off',
      // TODO: check if we can enable the following
      'node/no-path-concat': 'off',
    },
  },
  {
    // Files that do not require linting
    ignores: [
      '**/file-invalid.d.ts',
    ],
  },
]);
