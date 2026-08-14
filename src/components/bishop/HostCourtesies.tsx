import { useRef, useState } from "react";
import { Banknote, Plane, Car, BedDouble, ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COURTESY_DISCLAIMER,
  COURTESY_HIGHLIGHTS,
  COURTESY_INTRO,
  COURTESY_SECTIONS,
} from "@/lib/hostCourtesies";

const ICONS: Record<string, React.ReactNode> = {
  honorarium: <Banknote className="h-5 w-5" />,
  travel: <Plane className="h-5 w-5" />,
  ground: <Car className="h-5 w-5" />,
  lodging: <BedDouble className="h-5 w-5" />,
};

/**
 * The courtesies, shown to a host church once their invitation is in.
 *
 * Two layers on purpose. The four highlight cards carry the things a host has
 * to *budget and plan* for — money, flights, a driver, a room — because those
 * are the decisions that need making before anyone reads prose. The full text
 * sits behind one button for when they sit down to arrange it properly.
 *
 * Deliberately not a separate page: these are the Bishop's terms, including
 * figures, and they belong with the request that prompted them rather than at
 * a URL that can be passed around. The print action is how a host keeps a copy.
 */
export function HostCourtesies() {
  const [open, setOpen] = useState(false);
  const fullRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Opening moves a lot of content in below the fold. Bring the start of it
    // into view so the reader is not left staring at the button they pressed.
    if (next) {
      requestAnimationFrame(() =>
        fullRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  return (
    <section className="courtesies mt-12 border-t border-border pt-10">
      <div className="eyebrow text-gold-deep">— While you wait</div>
      <h2 className="font-display text-3xl lg:text-4xl mt-3">Host Ministry Courtesies</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        For Bishop Dr. Justin Marcus
      </p>

      <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">{COURTESY_INTRO}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {COURTESY_HIGHLIGHTS.map((h) => (
          <div key={h.id} className="border border-border bg-secondary p-5">
            <div className="flex items-center gap-3">
              <span className="text-gold-deep">{ICONS[h.id]}</span>
              <h3 className="font-display text-xl">{h.title}</h3>
            </div>
            <ul className="mt-4 space-y-2">
              {h.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-deep" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 no-print">
        <Button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="courtesies-full"
          className="rounded-none eyebrow bg-night text-night-foreground hover:bg-night/90"
        >
          {open ? "Hide the full courtesies" : "Read the full courtesies"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>

        {open && (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="rounded-none eyebrow"
          >
            <Printer className="h-4 w-4" /> Print or save
          </Button>
        )}
      </div>

      {/* Rendered only when open: it is a long document, and keeping it in the
          DOM behind display:none would put every heading into the page's
          accessibility tree and its search results. */}
      {/* max-w-2xl caps the measure, matching the intro paragraph above. The confirmation card runs the full width
          of the page so the highlight cards can sit two-up, but long-form prose
          at the card width measured ~139 characters a line — roughly double what
          anyone reads comfortably. */}
      {open && (
        <div id="courtesies-full" ref={fullRef} className="mt-10 scroll-mt-8 max-w-2xl">
          {COURTESY_SECTIONS.map((s) => (
            <section key={s.id} className="mt-9 first:mt-0">
              <h3 className="font-display text-2xl">{s.title}</h3>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <p className="mt-10 border-l-2 border-gold-deep pl-4 text-sm text-foreground">
            {COURTESY_DISCLAIMER}
          </p>
        </div>
      )}
    </section>
  );
}
