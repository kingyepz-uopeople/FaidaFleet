import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    // Next 16 ships eslint-plugin-react-hooks v7 with React Compiler
    // diagnostics enabled. This React 18 app does not run the compiler, and
    // those three rules flag existing, working patterns (effects reading a
    // function declared below, setState in mount effects, Date.now() in
    // render). All other Next, React, hooks and TypeScript rules stay on.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
