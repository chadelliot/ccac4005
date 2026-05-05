import { useEffect, useMemo, useState } from "react";
import { getBook, getBooksMeta, type Book, type BookMeta, type Passage } from "@/lib/bible";
import { VerseText } from "@/components/bible/VerseText";
import { Button } from "@/components/ui/button";

export function PassageView({
  passage,
  showStrongs = true,
}: {
  passage: Passage;
  showStrongs?: boolean;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [books, setBooks] = useState<BookMeta[] | null>(null);

  useEffect(() => {
    getBooksMeta().then(setBooks);
  }, []);
  useEffect(() => {
    setBook(null);
    getBook(passage.book_abbr).then(setBook);
  }, [passage.book_abbr]);

  const chapter = useMemo(
    () => book?.chapters.find((c) => c.c === passage.chapter),
    [book, passage.chapter],
  );
  const verses = useMemo(() => {
    if (!chapter) return [];
    if (!passage.verse_start) return chapter.v;
    const end = passage.verse_end ?? passage.verse_start;
    return chapter.v.filter(([n]) => n >= passage.verse_start! && n <= end);
  }, [chapter, passage.verse_start, passage.verse_end]);

  if (!book) return <div className="text-sm text-muted-foreground">Loading passage…</div>;
  if (!chapter) return <div className="text-sm text-destructive">Chapter not found.</div>;

  const bookName = books?.find((b) => b.abbr === passage.book_abbr)?.name ?? book.name;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-2xl">
        {bookName} {passage.chapter}
        {passage.verse_start
          ? `:${passage.verse_start}${passage.verse_end && passage.verse_end !== passage.verse_start ? "-" + passage.verse_end : ""}`
          : ""}
      </h3>
      <div className="space-y-2 text-base">
        {verses.map(([n, t]) => (
          <p key={n} className="">
            <sup className="text-accent text-xs mr-1.5 font-semibold">{n}</sup>
            <VerseText text={t} showStrongs={showStrongs} />
          </p>
        ))}
      </div>
    </div>
  );
}

// Standalone Bible reader with book/chapter navigation
export function BibleReader() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [bookAbbr, setBookAbbr] = useState<string>("Gen");
  const [chapter, setChapter] = useState<number>(1);
  const [showStrongs, setShowStrongs] = useState(true);

  useEffect(() => {
    getBooksMeta().then(setBooks);
  }, []);

  const meta = books.find((b) => b.abbr === bookAbbr);
  const chapterCount = meta?.chapters ?? 1;

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-4">
        <div>
          <label className="eyebrow text-muted-foreground text-[10px]">Book</label>
          <select
            value={bookAbbr}
            onChange={(e) => {
              setBookAbbr(e.target.value);
              setChapter(1);
            }}
            className="w-full h-9 mt-1 border border-input bg-transparent px-2 text-sm rounded-sm"
          >
            {books.map((b) => (
              <option key={b.abbr} value={b.abbr}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow text-muted-foreground text-[10px]">Chapter</label>
          <div className="flex flex-wrap gap-1 mt-1 max-h-72 overflow-y-auto p-1 border border-border">
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setChapter(n)}
                className={`min-w-9 h-9 text-xs eyebrow ${
                  n === chapter ? "bg-night text-night-foreground" : "hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showStrongs}
            onChange={(e) => setShowStrongs(e.target.checked)}
          />
          Show Strong's (hover words)
        </label>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={chapter <= 1}
            onClick={() => setChapter((c) => Math.max(1, c - 1))}
            className="flex-1"
          >
            ← Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={chapter >= chapterCount}
            onClick={() => setChapter((c) => Math.min(chapterCount, c + 1))}
            className="flex-1"
          >
            Next →
          </Button>
        </div>
      </aside>
      <div className="bg-card border border-border p-6 lg:p-8">
        <PassageView passage={{ book_abbr: bookAbbr, chapter }} showStrongs={showStrongs} />
      </div>
    </div>
  );
}
