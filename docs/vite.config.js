import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

/*
 * BASE PATH — the single most common reason a deployed page shows a blank
 * screen with 404s on its JS/CSS:
 *   - Project page  https://<user>.github.io/<repo>/   needs base = "/<repo>/"
 *   - User/org page https://<user>.github.io/          needs base = "/"
 * The deploy workflow passes REPOSITORY=<repo> so the build gets the right
 * base automatically. Local `npm run dev` has no REPOSITORY, so base = "/".
 */
const repo = process.env.REPOSITORY;

export default defineConfig({
  base: repo ? `/${repo}/` : "/",
  plugins: [wasm(), topLevelAwait()],
  // Vite's dep pre-bundling relocates the package, which breaks its internal
  // `new URL("./re_viewer_bg.wasm", import.meta.url)` fetch in dev mode.
  optimizeDeps: { exclude: ["@rerun-io/web-viewer"] },
  build: {
    target: "esnext", // the viewer uses top-level await + wasm imports
  },
});
