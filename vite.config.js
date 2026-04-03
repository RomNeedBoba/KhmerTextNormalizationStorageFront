import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // ✅ listen on all network interfaces
    port: 5173,   // optional, default is 5173
  },
})