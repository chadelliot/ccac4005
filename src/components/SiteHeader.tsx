import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useLiveStream } from "@/hooks/useLiveStream";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";
import logo from "@/assets/ccac-logo.webp";

/**
 * The three grouped sections, written out rather than mapped over an array.
 *
 * A `to` union defeats the router's link type checking — the Bishop's page is
 * the parameterised /about/$slug route, and a typo in a slug would otherwise
 * compile. Each group is one component so the desktop dropdown and the mobile
 * list cannot drift apart.
 */
type GroupLinkProps = {
  className: string;
  activeClassName: string;
  onNavigate?: () => void;
};

function AboutLinks({ className, activeClassName, onNavigate }: GroupLinkProps) {
  const shared = { className, onClick: onNavigate, activeProps: { className: activeClassName } };
  return (
    <>
      <Link to="/about" activeOptions={{ exact: true }} {...shared}>
        Our Story
      </Link>
      <Link to="/about/$slug" params={{ slug: "bishop-justin-marcus" }} {...shared}>
        Our Pastor
      </Link>
    </>
  );
}

function EventsLinks({ className, activeClassName, onNavigate }: GroupLinkProps) {
  const shared = { className, onClick: onNavigate, activeProps: { className: activeClassName } };
  return (
    <>
      <Link to="/events" activeOptions={{ exact: true }} {...shared}>
        Upcoming Events
      </Link>
      <Link to="/invite-bishop" {...shared}>
        Invite Bishop
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

  const linkTone = light
    ? "text-foreground/70 hover:text-foreground"
    : "text-night-foreground/80 hover:text-gold";
  const activeTone = light ? "text-foreground" : "text-gold";

  return (
    <header className="absolute top-0 left-0 right-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className={`group flex items-center gap-3 ${light ? "text-foreground" : "text-night-foreground"}`}>
          <img src={logo} alt="" width={600} height={600} className="h-11 w-11 shrink-0 object-contain" />
          <div className="leading-tight">
            <div className="font-display text-xl tracking-tight">CCAC</div>
            <div className={`eyebrow text-[10px] ${light ? "text-muted-foreground" : "text-gold/80"}`}>
              Christ Cathedral Apostolic
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          <Link to="/" className={`eyebrow transition-colors ${linkTone}`} activeProps={{ className: activeTone }} activeOptions={{ exact: true }}>
            Home
          </Link>

          <NavMenu label="About" light={light}>
            {(p) => <AboutLinks {...p} />}
          </NavMenu>

          <NavMenu label="Events" light={light}>
            {(p) => <EventsLinks {...p} />}
          </NavMenu>

          <Link
            to="/plan-visit"
            className={`eyebrow transition-colors ${linkTone}`}
            activeProps={{ className: activeTone }}
          >
            Plan a Visit
          </Link>

          <Link to="/give" className={`eyebrow transition-colors ${linkTone}`} activeProps={{ className: activeTone }}>
            Give
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user && <NotificationsBell />}

          {/* Watch Live is the primary action. Gold normally; when a service is
              actually streaming it switches to --live, because "we are on air
              right now" is worth more than brand consistency for those hours. */}
          <Button
            asChild
            size="sm"
            className={`rounded-none px-6 tracking-wider uppercase text-xs ${
              status.isLive
                ? "bg-live text-night-foreground hover:bg-live/90"
                : "bg-gold text-gold-foreground hover:bg-gold/90"
            }`}
          >
            <Link to="/live">
              {status.isLive && <span className="h-2 w-2 rounded-full bg-night-foreground animate-pulse" />}
              {status.isLive ? "Live Now" : "Watch Live"}
            </Link>
          </Button>

          {/* Icon rather than a "Member Login" button: the nav grew by two
              items and the label was the least valuable thing competing for
              the space. */}
          <Button
            asChild
            size="sm"
            variant="outline"
            aria-label={user ? "Your dashboard" : "Member login"}
            title={user ? "Your dashboard" : "Member login"}
            className={`rounded-none h-9 w-9 p-0 ${
              light
                ? "border-border bg-transparent text-foreground hover:bg-foreground/5"
                : "border-white/25 bg-transparent text-night-foreground hover:bg-white/10 hover:text-gold"
            }`}
          >
            <Link to={user ? "/dashboard" : "/auth"}>
              <UserIcon className="h-4 w-4" />
            </Link>
          </Button>

          {user && (
            <Button
              onClick={handleSignOut}
              size="sm"
              variant="ghost"
              aria-label="Sign out"
              title="Sign out"
              className={`rounded-none h-9 w-9 p-0 ${light ? "text-foreground hover:bg-foreground/5" : "text-night-foreground hover:bg-white/10"}`}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`lg:hidden ${light ? "text-foreground" : "text-night-foreground"}`}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
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

            <MobileGroup label="About">
              <AboutLinks {...mobileGroupProps(() => setOpen(false))} />
            </MobileGroup>

            <MobileGroup label="Events">
              <EventsLinks {...mobileGroupProps(() => setOpen(false))} />
            </MobileGroup>

            <Link
              to="/plan-visit"
              onClick={() => setOpen(false)}
              className="eyebrow py-3 border-b border-white/5"
              activeProps={{ className: "text-gold" }}
            >
              Plan a Visit
            </Link>

            <Link
              to="/give"
              onClick={() => setOpen(false)}
              className="eyebrow py-3 border-b border-white/5"
              activeProps={{ className: "text-gold" }}
            >
              Give
            </Link>

            <Link
              to="/live"
              onClick={() => setOpen(false)}
              className={`eyebrow py-3 flex items-center gap-2 ${status.isLive ? "text-live-bright" : "text-gold"}`}
              activeProps={{ className: status.isLive ? "text-live-bright" : "text-gold" }}
            >
              {status.isLive && <span className="h-2 w-2 rounded-full bg-live animate-pulse" />}
              {status.isLive ? "Live Now" : "Watch Live"}
            </Link>

            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="eyebrow py-3 border-t border-white/5">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="eyebrow py-3 text-left">
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="eyebrow py-3 border-t border-white/5">
                Member Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const mobileGroupProps = (close: () => void): GroupLinkProps => ({
  className: "eyebrow py-2 pl-4 text-night-foreground/85 hover:text-gold",
  activeClassName: "text-gold",
  onNavigate: close,
});

/**
 * Collapsed by default on mobile. Showing every sub-item at once made the menu
 * a wall of eleven links; the top level is five, which is scannable.
 */
function MobileGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3 eyebrow text-night-foreground"
      >
        {label}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="pb-2 flex flex-col">{children}</div>}
    </div>
  );
}

/**
 * A desktop dropdown. Opens on hover for mouse users and on click for everyone
 * else — hover alone would leave it unreachable by keyboard and unusable on
 * touch, which has no hover state at all.
 */
function NavMenu({
  label,
  light,
  children,
}: {
  label: string;
  light: boolean;
  children: (props: GroupLinkProps) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A hard close on mouseleave makes the diagonal trip from trigger to panel
  // snap the menu shut. A short grace period fixes that without needing a full
  // safe-triangle implementation.
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
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 top-full pt-4 z-50" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <div className="min-w-[13rem] border border-white/10 bg-night text-night-foreground shadow-elevated">
            {children({
              className:
                "block px-5 py-3 eyebrow text-night-foreground/80 hover:bg-white/10 hover:text-gold transition-colors border-b border-white/5 last:border-b-0",
              activeClassName: "text-gold",
              onNavigate: () => setOpen(false),
            })}
          </div>
        </div>
      )}
    </div>
  );
}
