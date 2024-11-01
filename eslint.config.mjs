import rcPreset from '@rightcapital/eslint-config';

const { config } = rcPreset.utils;

export default config(...rcPreset.configs.recommended, {
  files: ['**/*.{ts,cts,mts}'],
  rules: {
    // false positives
    'import-x/no-named-as-default': 'off',
  },
});
