import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="eyebrow text-gold mb-4">404</div>
        <h1 className="font-display text-5xl text-foreground">Page not found</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-night px-6 py-3 eyebrow text-night-foreground hover:bg-night/90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Social scrapers won't follow a relative path, so the share image has to be an
// absolute URL. Falls back to the church domain until VITE_PUBLIC_SITE_URL is set.
const SITE_URL =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://www.ccacbmore.com";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Christ Cathedral Apostolic Church — Baltimore, MD" },
      { name: "description", content: "A thriving ministry in the heart of Baltimore where lives are transformed by the power of Jesus Christ." },
      { name: "author", content: "CCAC" },
      { property: "og:title", content: "Christ Cathedral Apostolic Church — Baltimore, MD" },
      { property: "og:description", content: "A thriving ministry in the heart of Baltimore where lives are transformed by the power of Jesus Christ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Christ Cathedral Apostolic Church — Baltimore, MD" },
      { name: "twitter:description", content: "A thriving ministry in the heart of Baltimore where lives are transformed by the power of Jesus Christ." },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:site_name", content: "Christ Cathedral Apostolic Church" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  );
}
