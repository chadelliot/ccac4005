// Bible data helpers — fetch per-book JSON files from /bible/ static assets.
// Each book file: { name, abbr, chapters: [{ c, v: [[verseNum, "text with [H123] tags"]] }] }
// Lexicon: { "H123": { w, tl, pos, def, root }, ... }

export type BookMeta = { name: string; abbr: string; chapters: number };
export type Verse = [number, string];
export type Chapter = { c: number; v: Verse[] };
export type Book = { name: string; abbr: string; chapters: Chapter[] };
export type LexEntry = { w: string; tl: string; pos: string; def: string; root: string };
export type Lexicon = Record<string, LexEntry>;

const bookCache = new Map<string, Promise<Book>>();
let booksMetaPromise: Promise<BookMeta[]> | null = null;
let lexiconPromise: Promise<Lexicon> | null = null;

export function getBooksMeta(): Promise<BookMeta[]> {
  if (!booksMetaPromise) {
    booksMetaPromise = fetch("/bible/books.json").then((r) => r.json());
  }
  return booksMetaPromise;
}

export function getBook(abbr: string): Promise<Book> {
  let p = bookCache.get(abbr);
  if (!p) {
    p = fetch(`/bible/${abbr}.json`).then((r) => {
      if (!r.ok) throw new Error(`Book ${abbr} not found`);
      return r.json();
    });
    bookCache.set(abbr, p);
  }
  return p;
}

export function getLexicon(): Promise<Lexicon> {
  if (!lexiconPromise) {
    lexiconPromise = fetch("/bible/lexicon.json").then((r) => r.json());
  }
  return lexiconPromise;
}

// A passage in a reading program day
export type Passage = {
  book_abbr: string;
  chapter: number;
  verse_start?: number;
  verse_end?: number;
};

export function passageLabel(p: Passage, books?: BookMeta[]): string {
  const name = books?.find((b) => b.abbr === p.book_abbr)?.name ?? p.book_abbr;
  let s = `${name} ${p.chapter}`;
  if (p.verse_start) {
    s += `:${p.verse_start}`;
    if (p.verse_end && p.verse_end !== p.verse_start) s += `-${p.verse_end}`;
  }
  return s;
}

// Tokenize a verse text into segments: words, Strong's tags, italics, punctuation.
// Source format: "In the beginning[H7225] God[H430] created[H1254][H853] the heaven[H8064]..."
// Italics use <em>...</em>
export type Token =
  | { kind: "text"; text: string }
  | { kind: "word"; text: string; strongs: string[] }
  | { kind: "italic"; text: string };

export function tokenize(verse: string): Token[] {
  // Split on <em>...</em> first, then within each chunk handle words+[Hxxx] tags.
  const out: Token[] = [];
  const emRegex = /<em>(.*?)<\/em>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  const chunks: { text: string; italic: boolean }[] = [];
  while ((m = emRegex.exec(verse))) {
    if (m.index > lastIdx) chunks.push({ text: verse.slice(lastIdx, m.index), italic: false });
    chunks.push({ text: m[1], italic: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < verse.length) chunks.push({ text: verse.slice(lastIdx), italic: false });

  for (const ch of chunks) {
    if (ch.italic) {
      // italic words may also have [Hxxx]; treat the whole as italic text + word
      out.push({ kind: "italic", text: ch.text });
      continue;
    }
    // Within a non-italic chunk: split into [word][Hxxx]... pattern
    // A "word" is a run of non-bracket, non-whitespace chars optionally followed by punctuation
    // Strategy: walk char by char.
    const s = ch.text;
    let i = 0;
    while (i < s.length) {
      // collect Strong's tags directly
      if (s[i] === "[") {
        // shouldn't happen at start of text (tags follow words), but be safe
        const end = s.indexOf("]", i);
        if (end === -1) {
          out.push({ kind: "text", text: s.slice(i) });
          break;
        }
        // attach to previous word if any
        const tag = s.slice(i + 1, end);
        const prev = out[out.length - 1];
        if (prev && prev.kind === "word") prev.strongs.push(tag);
        else out.push({ kind: "text", text: `[${tag}]` });
        i = end + 1;
        continue;
      }
      // collect leading whitespace as text token
      if (/\s/.test(s[i])) {
        let j = i;
        while (j < s.length && /\s/.test(s[j])) j++;
        out.push({ kind: "text", text: s.slice(i, j) });
        i = j;
        continue;
      }
      // collect a "word" up to next whitespace or '['
      let j = i;
      while (j < s.length && s[j] !== "[" && !/\s/.test(s[j])) j++;
      const wordText = s.slice(i, j);
      // collect any directly following [Hxxx]/[Gxxx] tags
      const strongs: string[] = [];
      let k = j;
      while (k < s.length && s[k] === "[") {
        const end = s.indexOf("]", k);
        if (end === -1) break;
        strongs.push(s.slice(k + 1, end));
        k = end + 1;
      }
      out.push({ kind: "word", text: wordText, strongs });
      i = k;
    }
  }
  return out;
}

// Reference parser: "Gen 1", "Gen 1:1", "Gen 1:1-5", "John 3:16-17"
export function parseRefInput(
  input: string,
  books: BookMeta[],
): Passage | null {
  const s = input.trim();
  const m = s.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!m) return null;
  const bookText = m[1].trim().toLowerCase();
  const chapter = parseInt(m[2], 10);
  const vs = m[3] ? parseInt(m[3], 10) : undefined;
  const ve = m[4] ? parseInt(m[4], 10) : vs;
  const book = books.find(
    (b) =>
      b.name.toLowerCase() === bookText ||
      b.abbr.toLowerCase() === bookText ||
      b.name.toLowerCase().replace(/\s+/g, "") === bookText.replace(/\s+/g, ""),
  );
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  return { book_abbr: book.abbr, chapter, verse_start: vs, verse_end: ve };
}
