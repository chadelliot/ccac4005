import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Public routes that should exist as real HTML files on static hosting.
// Dashboard routes are deliberately absent — they are auth-gated and have
// nothing useful to serve a crawler.
const PUBLIC_PAGES = [
  "/about",
  "/about/bishop-justin-marcus",
  "/about/brandi-marcus",
  "/plan-visit",
  "/events",
  "/find-us",
  "/give",
  "/live",
  "/invite-bishop",
];

export default defineConfig(({ mode }) => {
  // `vite build --mode mobile` emits a client-only bundle for the Capacitor
  // shell — no server, since none can run on-device. The website build is
  // unchanged.
  const isMobile = mode === "mobile";

  // Mirror VITE_* vars into import.meta.env for the client and SSR builds alike.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );

  return {
    define: envDefine,
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      // Keep a single copy of these so hooks and context don't break across chunks.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      // Must be registered before viteReact().
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
        ...(isMobile
          ? {
              spa: { enabled: true, prerender: { outputPath: "/index.html" } },
              // Give each public page its own HTML file. Without this, static
              // hosting falls back to 404.html for every deep link: the page
              // still renders, but it answers with a 404 status and its own
              // <title>/og tags never reach a crawler.
              pages: PUBLIC_PAGES.map((path) => ({
                path,
                prerender: { enabled: true },
              })),
            }
          : {}),
      }),
      viteReact(),
    ],
  };
});
