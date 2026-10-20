import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativo: funciona en GitHub Pages sea cual sea el nombre del repo (usamos rutas con #)
export default defineConfig({
  base: './',
  plugins: [react()],
})
