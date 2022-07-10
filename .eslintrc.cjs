/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['svelte3', '@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    project: ['./packages/*/tsconfig.json'],
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    // To enable all rules in svelte files:
    extraFileExtensions: ['.svelte'],
  },
  env: { browser: true, es2017: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'plugin:unicorn/recommended',
    'xo',
    'xo-typescript',
    'prettier',
  ],
  settings: { 'svelte3/typescript': () => require('typescript') },
  rules: {
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    'capitalized-comments': 'off',
    'new-cap': 'off',
    'no-await-in-loop': 'off',
    'no-empty-pattern': 'off',
    'unicorn/no-abusive-eslint-disable': 'off',
    'unicorn/prevent-abbreviations': 'off',
  },
  overrides: [
    {
      files: ['*.svelte'],
      processor: 'svelte3/svelte3',
      rules: {
        // This is not yet possible to enable some typed rules, see
        // https://github.com/sveltejs/eslint-plugin-svelte3/issues/89
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
      },
    },
  ],
}