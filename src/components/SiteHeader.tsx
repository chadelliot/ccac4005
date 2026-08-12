import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
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
          {navItems.slice(0, 2).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`eyebrow transition-colors ${light ? "text-foreground/70 hover:text-foreground" : "text-night-foreground/80 hover:text-gold"}`}
              activeProps={{ className: light ? "text-foreground" : "text-gold" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}

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
            {navItems.slice(0, 2).map((item) => (
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
