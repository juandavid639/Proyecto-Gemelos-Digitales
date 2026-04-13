import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
       // Todo lo que sea API va al backend local
      "/gemelo": "http://localhost:8000",
      "/brightspace": "http://localhost:8000",
      "/auth": "http://localhost:8000",
      "/lti": "http://localhost:8000",
      "/health": "http://localhost:8000",
      "/debug": "http://localhost:8000",
      "/.well-known": "http://localhost:8000",
      "/speech": "http://localhost:8000",
    },
    // SPA fallback: redirect all non-API routes to index.html for BrowserRouter
    historyApiFallback: true,
  },
})
