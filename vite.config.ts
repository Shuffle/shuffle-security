import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Map the published package name back to the in-repo source so the
      // host dev/build keeps working while Shuffle-Core uses the package
      // identifier in its imports (so it builds standalone for npm).
      "@shuffleio/shuffle-mcps": path.resolve(__dirname, "./src/Shuffle-MCPs/index.ts"),
    },
  },
}));
