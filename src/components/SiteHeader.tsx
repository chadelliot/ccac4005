import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useLiveStream } from "@/hooks/useLiveStream";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";
import logo from "@/assets/ccac-logo.webp";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/events", label: "Events" },
  { to: "/plan-visit", label: "Plan a Visit" },
  { to: "/find-us", label: "Find Us" },
];

/**
 * The items under "About", rendered once and shared by the desktop dropdown and
 * the mobile menu so the two cannot drift apart.
 *
 * Written out rather than mapped over an array: the Bishop's page is the
 * parameterised /about/$slug route, and a `to` union defeats the router's link
 * type checking — a typo in a slug would compile.
 */
function AboutLinks({
  className,
  activeClassName,
  onNavigate,
}: {
  className: string;
  activeClassName: string;
  onNavigate?: () => void;
}) {
  const shared = {
    className,
    onClick: onNavigate,
    activeProps: { className: activeClassName },
  };
  return (
    <>
      <Link to="/about" activeOptions={{ exact: true }} {...shared}>
        Our Story
      </Link>
      <Link to="/about/$slug" params={{ slug: "bishop-justin-marcus" }} {...shared}>
        Our Pastor
      </Link>
      <Link to="/invite-bishop" {...shared}>
        Booking Details
      </Link>
    </>
  );
}

/**
 * `tone` matches the header to what sits behind it. The header is absolutely
 * positioned, so on pages whose hero is light (Give, event detail) the cream
 * text would otherwise land on a cream background and vanish.
 */
export function SiteHeader({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const { status } = useLiveStream();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className={`group flex items-center gap-3 ${light ? "text-foreground" : "text-night-foreground"}`}>
          <img
            src={logo}
            alt=""
            width={600}
            height={600}
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div className="leading-tight">
            <div className="font-display text-xl tracking-tight">CCAC</div>
            <div className={`eyebrow text-[10px] ${light ? "text-muted-foreground" : "text-gold/80"}`}>Christ Cathedral Apostolic</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-10">
          <Link
            to="/"
            className={`eyebrow transition-colors ${light ? "text-foreground/70 hover:text-foreground" : "text-night-foreground/80 hover:text-gold"}`}
            activeProps={{ className: light ? "text-foreground" : "text-gold" }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>

          <AboutMenu light={light} />

          <Link
            to="/live"
            className={`eyebrow inline-flex items-center gap-2 transition-colors ${
              status.isLive
                ? "text-red-500"
                : light
                  ? "text-foreground/70 hover:text-foreground"
                  : "text-night-foreground/80 hover:text-gold"
            }`}
            activeProps={{ className: status.isLive ? "text-red-500" : light ? "text-foreground" : "text-gold" }}
          >
            {status.isLive && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
            {status.isLive ? "Live Now" : "Watch Live"}
          </Link>

          {navItems.slice(2).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`eyebrow transition-colors ${light ? "text-foreground/70 hover:text-foreground" : "text-night-foreground/80 hover:text-gold"}`}
              activeProps={{ className: light ? "text-foreground" : "text-gold" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <>
              <NotificationsBell />
              <Button asChild variant="ghost" size="sm" className={light ? "text-foreground hover:bg-foreground/5" : "text-night-foreground hover:bg-white/10 hover:text-gold"}>
                <Link to="/dashboard">
                  <UserIcon className="h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button onClick={handleSignOut} size="sm" variant="outline" className={light ? "border-border bg-transparent text-foreground hover:bg-foreground/5" : "border-white/20 bg-transparent text-night-foreground hover:bg-white/10"}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90 rounded-none px-6 tracking-wider uppercase text-xs">
              <Link to="/auth">Member Login</Link>
            </Button>
          )}
          <Button asChild size="sm" className={`rounded-none px-6 tracking-wider uppercase text-xs ${light ? "bg-night text-night-foreground hover:bg-night/90" : "bg-night-foreground text-night hover:bg-white/90"}`}>
            <Link to="/give">Give</Link>
          </Button>
        </div>

        <button onClick={() => setOpen(!open)} className={`lg:hidden ${light ? "text-foreground" : "text-night-foreground"}`} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-night text-night-foreground border-t border-white/10">
          <div className="flex flex-col gap-1 px-6 py-6">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="eyebrow py-3 border-b border-white/5"
              activeProps={{ className: "text-gold" }}
              activeOptions={{ exact: true }}
            >
              Home
            </Link>

            <div className="border-b border-white/5 py-3">
              <div className="eyebrow text-night-foreground/50 text-[10px]">About</div>
              <div className="mt-2 flex flex-col">
                <AboutLinks
                  className="eyebrow py-2 pl-4 text-night-foreground/85 hover:text-gold"
                  activeClassName="text-gold"
                  onNavigate={() => setOpen(false)}
                />
              </div>
            </div>

            <Link
              to="/live"
              onClick={() => setOpen(false)}
              className={`eyebrow py-3 border-b border-white/5 flex items-center gap-2 ${status.isLive ? "text-red-400" : ""}`}
              activeProps={{ className: status.isLive ? "text-red-400" : "text-gold" }}
            >
              {status.isLive && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              {status.isLive ? "Live Now" : "Watch Live"}
            </Link>

            {navItems.slice(2).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="eyebrow py-3 border-b border-white/5"
                activeProps={{ className: "text-gold" }}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="eyebrow py-3 border-b border-white/5">Dashboard</Link>
                <button onClick={handleSignOut} className="eyebrow py-3 text-left">Sign Out</button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="eyebrow py-3 text-gold">Member Login</Link>
            )}
            <Link to="/give" onClick={() => setOpen(false)} className="eyebrow py-3 text-gold">Give</Link>
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * The "About" dropdown. Opens on hover for mouse users and on click for
 * everyone else — hover alone would make it unreachable by keyboard and
 * unusable on a touch screen that has no hover state at all.
 *
 * Styling is taken wholesale from the nav links around it; nothing new is
 * introduced beyond the panel itself, which reuses the mobile menu's
 * bg-night / border-white/10 treatment.
 */
function AboutMenu({ light }: { light: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A hard close on mouseleave makes the diagonal trip from trigger to panel
  // snap the menu shut. A short grace period fixes that without needing a
  // full safe-triangle implementation.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  const trigger = light
    ? "text-foreground/70 hover:text-foreground"
    : "text-night-foreground/80 hover:text-gold";

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`eyebrow inline-flex items-center gap-1.5 transition-colors ${trigger}`}
      >
        About
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full pt-4 z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="min-w-[13rem] border border-white/10 bg-night text-night-foreground shadow-elevated">
            <AboutLinks
              className="block px-5 py-3 eyebrow text-night-foreground/80 hover:bg-white/10 hover:text-gold transition-colors border-b border-white/5 last:border-b-0"
              activeClassName="text-gold"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
