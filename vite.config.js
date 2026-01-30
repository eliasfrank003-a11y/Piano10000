import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Ensure 'Piano10000' matches your GitHub repository name exactly.
  base: '/Piano10000/', 
})
