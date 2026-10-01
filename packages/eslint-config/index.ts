import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default function createConfig(tsconfigRootDir: string) {
  return defineConfig([
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
        parserOptions: {
          tsconfigRootDir,
        },
      },
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        'react-hooks/set-state-in-effect': 'warn',
      },
    },
  ])
}