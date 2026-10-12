import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Minimal config: recommended JS + TS rules without type-checking.
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.tanstack/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
)
