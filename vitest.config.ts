import { defineConfig } from 'vitest/config'

// Config aislada para tests (no carga el plugin PWA del vite.config de la app).
// La logica testeada es pura (parser, edit, layout, promptgen, share) → node env.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
