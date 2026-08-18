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
  "/privacy-policy",
  "/terms",
];

/**
 * Every approved public event, as a route to prerender.
 *
 * Share previews are the reason this exists. A crawler does not run
 * JavaScript, so an event page that resolves client-side has no title, no
 * description and no flyer to show — and on GitHub Pages an unprerendered
 * path returns 404 outright, which most scrapers refuse to preview at all.
 * Emitting one HTML file per event fixes both: real meta tags, real 200.
 *
 * Read with the publishable key through RLS, so this sees exactly what an
 * anonymous visitor sees and can never bake a private event into the build.
 *
 * Never fails the build. If Supabase is unreachable the site still ships,
 * just without per-event pages — a missing share preview is a far smaller
 * problem than a deployment that cannot go out.
 */
async function fetchEventPages(env: Record<string, string>): Promise<string[]> {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("[prerender] Supabase env missing — skipping per-event pages");
    return [];
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/events?select=id&status=eq.approved&is_public=eq.true`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const rows = (await res.json()) as { id: string }[];
    console.log(`[prerender] ${rows.length} event page(s)`);
    return rows.map((r) => `/events/${r.id}`);
  } catch (err) {
    console.warn(`[prerender] could not list events — skipping: ${String(err)}`);
    return [];
  }
}

export default defineConfig(async ({ mode }) => {
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
              pages: [...PUBLIC_PAGES, ...(await fetchEventPages(env))].map((path) => ({
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
