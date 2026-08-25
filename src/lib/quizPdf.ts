import * as pdfjs from "pdfjs-dist";
// Vite resolves this to a hashed asset URL. pdf.js needs its worker on a
// separate thread; without this it either warns and runs on the main thread
// (freezing the tab on a large file) or fails outright in a bundled app.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type ParsedOption = { label: string; text: string };
export type ParsedQuestion = {
  number: string;
  text: string;
  options: ParsedOption[];
  /** Letter of the marked answer, when the PDF states one. */
  answer: string | null;
};

/** Every line of text in the PDF, in reading order. */
export async function extractPdfLines(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    // pdf.js returns positioned fragments, not lines. Group by vertical
    // position — a question and its options are separate lines on the page but
    // arrive as an undifferentiated stream of items.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str.trim()) continue;
      // Round the y coordinate: characters on one line vary by fractions of a
      // point, and an exact key would put every glyph on its own row.
      const y = Math.round(item.transform[5]);
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }

    // Descending y, because PDF coordinates start at the bottom of the page.
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const line = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((i) => i.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

const QUESTION_RE = /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)：:]\s*(.+)$/i;
const OPTION_RE = /^\(?([A-Ha-h])\)?\s*[.)：:]\s+(.+)$/;
const ANSWER_RE = /^answer\s*[:.]?\s*\(?([A-Ha-h])\)?/i;

/**
 * Turn extracted lines into questions.
 *
 * Pattern matching, not language understanding — it reads the numbering and
 * lettering a quiz already uses, so it costs nothing to run and works offline.
 * The trade is that it only recognises the conventional shapes: "1." or "Q1)"
 * for questions, "A." or "(b)" for options, "Answer: C" for a marked answer.
 * Anything else comes back unparsed, which is why the import screen shows every
 * question for correction before saving rather than writing them directly.
 */
export function parseQuestions(lines: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const answer = line.match(ANSWER_RE);
    if (answer && current) {
      current.answer = answer[1].toUpperCase();
      continue;
    }

    const option = line.match(OPTION_RE);
    // Only treat a lettered line as an option once a question is open —
    // otherwise a heading like "A. Introduction" starts eating the document.
    if (option && current) {
      current.options.push({ label: option[1].toUpperCase(), text: option[2].trim() });
      continue;
    }

    const question = line.match(QUESTION_RE);
    if (question) {
      if (current) questions.push(current);
      current = { number: question[1], text: question[2].trim(), options: [], answer: null };
      continue;
    }

    // A continuation line: either the tail of a wrapped question, or of the
    // option most recently opened.
    if (current) {
      if (current.options.length > 0) {
        current.options[current.options.length - 1].text += ` ${line}`;
      } else {
        current.text += ` ${line}`;
      }
    }
  }

  if (current) questions.push(current);
  return questions;
}

export async function parseQuizPdf(file: File): Promise<ParsedQuestion[]> {
  return parseQuestions(await extractPdfLines(file));
}
