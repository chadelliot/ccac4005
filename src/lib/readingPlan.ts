// Deterministic Bible reading plan generator.
// Splits the canonical 66 books / 1189 chapters across N days, grouping
// consecutive chapters of the same book into a single reading per day.

import type { BookMeta } from "@/lib/bible";

export type GeneratedDay = {
  day_number: number;
  assigned_date?: string; // ISO yyyy-mm-dd
  title: string;
  scripture_reference: string;
  book_name: string;
  chapter_start: number;
  chapter_end: number;
  passages: { book_abbr: string; chapter: number }[];
};

type ChapterRef = { book: BookMeta; chapter: number };

export function flattenChapters(books: BookMeta[]): ChapterRef[] {
  const out: ChapterRef[] = [];
  for (const b of books) {
    for (let c = 1; c <= b.chapters; c++) out.push({ book: b, chapter: c });
  }
  return out;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function generateReadingPlan({
  books,
  days,
  startDate,
}: {
  books: BookMeta[];
  days: number;
  startDate?: string;
}): GeneratedDay[] {
  const flat = flattenChapters(books);
  const total = flat.length;
  const perDayBase = Math.floor(total / days);
  const remainder = total - perDayBase * days;

  const result: GeneratedDay[] = [];
  let idx = 0;
  const start = startDate ? new Date(startDate + "T00:00:00") : null;

  for (let d = 0; d < days; d++) {
    const count = perDayBase + (d < remainder ? 1 : 0);
    const slice = flat.slice(idx, idx + count);
    idx += count;
    if (slice.length === 0) continue;

    // Group consecutive chapters per book
    const groups: { book: BookMeta; chapters: number[] }[] = [];
    for (const ch of slice) {
      const last = groups[groups.length - 1];
      if (last && last.book.abbr === ch.book.abbr) last.chapters.push(ch.chapter);
      else groups.push({ book: ch.book, chapters: [ch.chapter] });
    }

    const refParts = groups.map((g) => {
      const first = g.chapters[0];
      const lastCh = g.chapters[g.chapters.length - 1];
      return `${g.book.name} ${first}${lastCh !== first ? "-" + lastCh : ""}`;
    });
    const ref = refParts.join("; ");

    const head = groups[0];
    const headFirst = head.chapters[0];
    const headLast = head.chapters[head.chapters.length - 1];

    const passages = slice.map((c) => ({ book_abbr: c.book.abbr, chapter: c.chapter }));

    let assigned_date: string | undefined;
    if (start) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + d);
      assigned_date = fmtDate(dt);
    }

    result.push({
      day_number: d + 1,
      assigned_date,
      title: ref,
      scripture_reference: ref,
      book_name: head.book.name,
      chapter_start: headFirst,
      chapter_end: headLast,
      passages,
    });
  }
  return result;
}
