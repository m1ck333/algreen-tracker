module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'i18next'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'i18next/no-literal-string': ['warn', {
      markupOnly: true,
      ignoreAttribute: [
        'className', 'style', 'type', 'name', 'id', 'key',
        'data-testid', 'to', 'href', 'icon', 'size', 'color',
        'placeholder', 'mode', 'theme', 'trigger', 'layout',
        'dataIndex', 'rowKey', 'htmlType', 'format',
      ],
      ignore: [
        '^[A-Z_]+$',
        '^\\d+$',
        '^[·|/\\-+*=<>]+$',
      ],
    }],
  },
};
