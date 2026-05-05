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
            <PopoverContent className="w-96 max-h-[70vh] overflow-y-auto text-sm" align="start">
              <div className="space-y-3">
                {t.strongs.map((s) => {
                  const e = lex?.[s];
                  return (
                    <div key={s} className="border-b border-border last:border-0 pb-2 last:pb-0">
                      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                        <span className="eyebrow text-accent text-[10px]">{s}</span>
                        {e?.w && <span className="font-display text-lg" lang={s.startsWith("H") ? "he" : "el"}>{e.w}</span>}
                        {e?.tl && <span className="text-xs italic text-muted-foreground">{e.tl}</span>}
                        {e?.phonetic && <span className="text-[11px] text-muted-foreground">/{e.phonetic}/</span>}
                      </div>
                      {e?.pos && <div className="text-[11px] text-muted-foreground">{e.pos}</div>}
                      {e?.definition ? (
                        <div className="mt-2">
                          <div className="text-[10px] uppercase tracking-wide text-accent mb-1">
                            {e.definitionSource ?? "Definition"}
                          </div>
                          <ol className="list-decimal pl-4 space-y-1 text-xs">
                            {e.definition.map((d, di) => (
                              <li key={di}>
                                {d.t}
                                {d.s && d.s.length > 0 && (
                                  <ol className="list-[lower-alpha] pl-4 space-y-0.5 mt-0.5">
                                    {d.s.map((sd, sdi) => (
                                      <li key={sdi}>
                                        {sd.t}
                                        {sd.s && sd.s.length > 0 && (
                                          <ol className="list-decimal pl-4 mt-0.5">
                                            {sd.s.map((ssd: any, ssdi: number) => (
                                              <li key={ssdi}>{ssd.t ?? ssd}</li>
                                            ))}
                                          </ol>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : e?.def ? (
                        <div className="text-xs mt-1 whitespace-pre-line">{e.def}</div>
                      ) : (
                        !lex && <div className="text-xs text-muted-foreground italic">Loading…</div>
                      )}
                      {e?.strongsDef && (
                        <div className="mt-2">
                          <div className="text-[10px] uppercase tracking-wide text-accent mb-1">Strong's</div>
                          <div className="text-xs">{e.strongsDef}</div>
                        </div>
                      )}
                      {e?.origin && (
                        <div className="text-[11px] text-muted-foreground mt-1">Origin: {e.origin}</div>
                      )}
                      {e?.root && <div className="text-[11px] text-muted-foreground mt-1">Root: {e.root}</div>}
                      {e?.usageByWord && e.usageByWord.length > 0 && (
                        <div className="mt-2">
                          <div className="text-[10px] uppercase tracking-wide text-accent mb-1">
                            Usage by word{e.totalOccurrences ? ` (${e.totalOccurrences})` : ""}
                          </div>
                          <ul className="text-xs space-y-0.5">
                            {e.usageByWord.slice(0, 12).map((u) => (
                              <li key={u.word} className="flex justify-between gap-2">
                                <span className="truncate">{u.word}</span>
                                <span className="text-muted-foreground tabular-nums">{u.count}</span>
                              </li>
                            ))}
                            {e.usageByWord.length > 12 && (
                              <li className="text-[10px] text-muted-foreground italic">
                                +{e.usageByWord.length - 12} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {e?.usageByBook && e.usageByBook.length > 0 && (
                        <div className="mt-2">
                          <div className="text-[10px] uppercase tracking-wide text-accent mb-1">Usage by book</div>
                          <div className="flex flex-wrap gap-1">
                            {e.usageByBook.slice(0, 16).map((b) => (
                              <span
                                key={b.book}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {b.book} <span className="tabular-nums">{b.count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
