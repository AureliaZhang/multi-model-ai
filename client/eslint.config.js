import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks v7 flags every synchronous setState inside an
      // effect (fetch-on-mount, syncing derived defaults, etc.) as an error.
      // Those are valid React patterns here, so keep the signal as a warning
      // instead of a hard error. Genuine hook bugs (purity, static-components,
      // rules-of-hooks) stay errors.
      'react-hooks/set-state-in-effect': 'warn',
      // Honour the `_`-prefix convention already used across the codebase to
      // mark intentionally-unused bindings (e.g. store `_get`, tuple slots).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
])
