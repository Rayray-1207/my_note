
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to avoid TS error "Property 'cwd' does not exist on type 'Process'"
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Priority: Vercel System Env (process.env) -> .env file (env) -> Empty string
  // This ensures that even if loadEnv misses the system var, we grab it directly from the process
  const apiKey = process.env.API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // This ensures process.env.API_KEY works in the client-side code by replacing it with the string value
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});
