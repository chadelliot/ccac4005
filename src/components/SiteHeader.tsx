import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Bell, LogOut, User as UserIcon } from "lucide-react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/events", label: "Events" },
  { to: "/plan-visit", label: "Plan a Visit" },
  { to: "/find-us", label: "Find Us" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className="group flex items-center gap-3 text-night-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-gold/40 text-gold font-display text-lg leading-none">
            C
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl tracking-tight">CCAC</div>
            <div className="eyebrow text-[10px] text-gold/80">Christ Cathedral Apostolic</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-10">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="eyebrow text-night-foreground/80 transition-colors hover:text-gold"
              activeProps={{ className: "text-gold" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <>
              <NotificationsBell />
              <Button asChild variant="ghost" size="sm" className="text-night-foreground hover:bg-white/10 hover:text-gold">
                <Link to="/dashboard">
                  <UserIcon className="h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button onClick={handleSignOut} size="sm" variant="outline" className="border-white/20 bg-transparent text-night-foreground hover:bg-white/10">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90 rounded-none px-6 tracking-wider uppercase text-xs">
              <Link to="/auth">Member Login</Link>
            </Button>
          )}
          <Button asChild size="sm" className="bg-night-foreground text-night hover:bg-white/90 rounded-none px-6 tracking-wider uppercase text-xs">
            <Link to="/give">Give</Link>
          </Button>
        </div>

        <button onClick={() => setOpen(!open)} className="lg:hidden text-night-foreground" aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-night text-night-foreground border-t border-white/10">
          <div className="flex flex-col gap-1 px-6 py-6">
            {navItems.map((item) => (
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
            <a href="https://www.paypal.me/christchurchap" target="_blank" rel="noreferrer" className="eyebrow py-3 text-gold">Give Online</a>
          </div>
        </div>
      )}
    </header>
  );
}
