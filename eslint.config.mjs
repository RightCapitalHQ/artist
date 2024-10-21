import eslintConfigRightcapital from '@rightcapital/eslint-config';

const { config } = eslintConfigRightcapital.utils;

export default config(...eslintConfigRightcapital.configs.recommended, {
  files: ['**/*.{ts,cts,mts}'],
  rules: {
    // false positives
    'import-x/no-named-as-default': 'off',
  },
});
