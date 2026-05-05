import { useEffect, useState } from "react";
import { tokenize, getLexicon, type LexEntry } from "@/lib/bible";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

let lexiconCache: Record<string, LexEntry> | null = null;

export function VerseText({ text, showStrongs = true }: { text: string; showStrongs?: boolean }) {
  const tokens = tokenize(text);
  const [lex, setLex] = useState<Record<string, LexEntry> | null>(lexiconCache);

  useEffect(() => {
    if (!showStrongs || lex) return;
    getLexicon().then((l) => {
      lexiconCache = l;
      setLex(l);
    });
  }, [showStrongs, lex]);

  return (
    <span className="leading-relaxed">
      {tokens.map((t, i) => {
        if (t.kind === "text") return <span key={i}>{t.text}</span>;
        if (t.kind === "italic") return <em key={i} className="italic text-muted-foreground">{t.text}</em>;
        // word
        if (!showStrongs || t.strongs.length === 0) {
          return <span key={i}>{t.text}</span>;
        }
        return (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="underline decoration-dotted decoration-accent/40 underline-offset-2 hover:decoration-accent hover:text-accent-foreground transition-colors"
              >
                {t.text}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm" align="start">
              <div className="space-y-3">
                {t.strongs.map((s) => {
                  const e = lex?.[s];
                  return (
                    <div key={s} className="border-b border-border last:border-0 pb-2 last:pb-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="eyebrow text-accent text-[10px]">{s}</span>
                        {e?.w && <span className="font-display text-lg" lang={s.startsWith("H") ? "he" : "el"}>{e.w}</span>}
                        {e?.tl && <span className="text-xs italic text-muted-foreground">{e.tl}</span>}
                      </div>
                      {e?.pos && <div className="text-[11px] text-muted-foreground capitalize">{e.pos}</div>}
                      {e?.def ? (
                        <div className="text-xs mt-1">{e.def}</div>
                      ) : (
                        !lex && <div className="text-xs text-muted-foreground italic">Loading…</div>
                      )}
                      {e?.root && <div className="text-[11px] text-muted-foreground mt-1">Root: {e.root}</div>}
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </span>
  );
}
