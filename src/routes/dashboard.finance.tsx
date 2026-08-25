import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Loader2, AlertTriangle, Download, Paperclip, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/dashboard/finance")({
  head: () => ({ meta: [{ title: "Finances — CCAC" }] }),
  component: FinancePage,
});

/** The threshold at which a payee's annual total may require a 1099-NEC. */
const NEC_THRESHOLD_CENTS = 60000;

type Category = { id: string; name: string; commonly_1099: boolean; sort_order: number };
type Payee = { id: string; name: string; kind: string; w9_on_file: boolean };
type Expense = {
  id: string;
  spent_on: string;
  amount_cents: number;
  category_id: string | null;
  payee_id: string | null;
  vendor: string | null;
  description: string | null;
  payment_method: string | null;
  receipt_path: string | null;
  reviewed: boolean;
};

/** Cents to a displayable amount. Never floats — see the migration's note. */
const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Accepts "45", "45.00", "$45", "1,234.56" and returns whole cents. */
function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Rounding the scaled value rather than multiplying a float: 19.99 * 100 is
  // 1998.9999999999998, which truncates to a cent short on every such row.
  return Math.round(Number(cleaned) * 100);
}

function FinancePage() {
  const { user } = useSession();
  const { has, loading: capLoading } = useCapabilities(user);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    const [c, p, e] = await Promise.all([
      supabase.from("expense_categories").select("id,name,commonly_1099,sort_order").order("sort_order"),
      supabase.from("payees").select("id,name,kind,w9_on_file").order("name"),
      supabase
        .from("expenses")
        .select("id,spent_on,amount_cents,category_id,payee_id,vendor,description,payment_method,receipt_path,reviewed")
        .order("spent_on", { ascending: false }),
    ]);
    setCategories((c.data as Category[] | null) ?? []);
    setPayees((p.data as Payee[] | null) ?? []);
    setExpenses((e.data as Expense[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!capLoading) load();
  }, [capLoading, load]);

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const payeeById = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees]);

  const forYear = useMemo(
    () => expenses.filter((x) => x.spent_on.slice(0, 4) === String(year)),
    [expenses, year],
  );

  const years = useMemo(() => {
    const set = new Set(expenses.map((x) => Number(x.spent_on.slice(0, 4))));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [expenses]);

  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const x of forYear) {
      const key = x.category_id ?? "uncategorised";
      totals[key] = (totals[key] ?? 0) + x.amount_cents;
    }
    return Object.entries(totals)
      .map(([id, cents]) => ({ id, name: categoryById[id]?.name ?? "Uncategorised", cents }))
      .sort((a, b) => b.cents - a.cents);
  }, [forYear, categoryById]);

  const total = forYear.reduce((n, x) => n + x.amount_cents, 0);
  const unreviewed = forYear.filter((x) => !x.reviewed).length;
  const missingReceipts = forYear.filter((x) => !x.receipt_path).length;

  // Anyone paid this much in a year may need a 1099-NEC. Surfaced as a prompt
  // to ask an accountant, not as a determination — whether one is actually
  // required depends on the working relationship and how they are incorporated.
  const necWatch = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const x of forYear) {
      if (!x.payee_id) continue;
      totals[x.payee_id] = (totals[x.payee_id] ?? 0) + x.amount_cents;
    }
    return Object.entries(totals)
      .filter(([, cents]) => cents >= NEC_THRESHOLD_CENTS)
      .map(([id, cents]) => ({ payee: payeeById[id], cents }))
      .filter((r) => r.payee)
      .sort((a, b) => b.cents - a.cents);
  }, [forYear, payeeById]);

  const exportCsv = () => {
    const rows = [
      ["Date", "Amount", "Category", "Payee/Vendor", "Description", "Method", "Receipt", "Reviewed"],
      ...forYear.map((x) => [
        x.spent_on,
        (x.amount_cents / 100).toFixed(2),
        x.category_id ? (categoryById[x.category_id]?.name ?? "") : "",
        x.payee_id ? (payeeById[x.payee_id]?.name ?? "") : (x.vendor ?? ""),
        x.description ?? "",
        x.payment_method ?? "",
        x.receipt_path ? "yes" : "no",
        x.reviewed ? "yes" : "no",
      ]),
    ];
    // Quote every field and double interior quotes: descriptions contain
    // commas, and an unquoted CSV silently shifts every later column.
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ccac-expenses-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (capLoading || loading) return <div className="eyebrow text-muted-foreground">Loading…</div>;

  if (!has("finance_management")) {
    return (
      <div className="max-w-lg">
        <div className="eyebrow text-accent mb-3">— Finances</div>
        <h1 className="font-display text-4xl mb-4">Restricted</h1>
        <p className="text-muted-foreground">
          Finance records are limited to those with the Finances permission. Ask an admin with
          Admin Settings access.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent mb-3 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />— Finances
          </div>
          <h1 className="font-display text-5xl">What We Spend</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Every expense with its receipt, categorised for the end of the year.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-border bg-background px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" onClick={exportCsv} disabled={forYear.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Export {year}
          </Button>
          <AddExpenseDialog categories={categories} payees={payees} onSaved={load} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={`Total spent in ${year}`} value={money(total)} />
        <Stat label="Missing a receipt" value={String(missingReceipts)} warn={missingReceipts > 0} />
        <Stat label="Not yet reviewed" value={String(unreviewed)} warn={unreviewed > 0} />
      </div>

      {necWatch.length > 0 && (
        <div className="border border-accent/40 bg-accent/5 p-5">
          <div className="eyebrow text-accent mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />— Worth asking your accountant about
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            These payees passed {money(NEC_THRESHOLD_CENTS)} in {year}. That is the point at which a
            1099-NEC often comes into it. Whether one is actually required depends on the working
            relationship and how they are set up — this is a prompt to ask, not an answer.
          </p>
          <ul className="space-y-1.5 text-sm">
            {necWatch.map(({ payee, cents }) => (
              <li key={payee!.id} className="flex flex-wrap items-center gap-x-3">
                <span className="font-medium">{payee!.name}</span>
                <span className="tabular-nums">{money(cents)}</span>
                {!payee!.w9_on_file && (
                  <span className="text-xs text-accent">no W-9 recorded</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="border border-border bg-card p-6">
        <div className="eyebrow text-muted-foreground mb-4">— By category, {year}</div>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded for {year} yet.</p>
        ) : (
          <div className="space-y-2">
            {byCategory.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-52 shrink-0 truncate text-sm">{c.name}</div>
                <div className="h-2 flex-1 bg-secondary">
                  <div
                    className="h-full bg-night"
                    style={{ width: `${total ? (c.cents / total) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right text-sm tabular-nums">{money(c.cents)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Paid to</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forYear.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No expenses recorded for {year}.
                </TableCell>
              </TableRow>
            ) : (
              forYear.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(x.spent_on + "T12:00:00").toLocaleDateString(undefined, {
                      month: "short", day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {money(x.amount_cents)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {x.category_id ? (categoryById[x.category_id]?.name ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {x.payee_id ? (payeeById[x.payee_id]?.name ?? "—") : (x.vendor ?? "—")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{x.description ?? "—"}</TableCell>
                  <TableCell>
                    {x.receipt_path ? (
                      <ReceiptLink path={x.receipt_path} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`border p-5 ${warn ? "border-accent bg-accent/5" : "border-border bg-card"}`}>
      <div className="font-display text-3xl tabular-nums">{value}</div>
      <div className="eyebrow mt-2 text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Receipts live in a private bucket, so they are reached through a short-lived
 * signed URL rather than a public link. A receipt can carry a card's last four
 * digits and an address; it should not be fetchable by anyone who guesses a
 * filename.
 */
function ReceiptLink({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    setBusy(false);
    if (error || !data?.signedUrl) {
      toast.error("Could not open that receipt.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
      View
    </button>
  );
}

function AddExpenseDialog({
  categories,
  payees,
  onSaved,
}: {
  categories: Category[];
  payees: Payee[];
  onSaved: () => void;
}) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("card");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  /**
   * Read the photo into the form, then stop.
   *
   * Everything it returns is a suggestion the person confirms — a misread total
   * on a tax return is worse than no reading at all. Fields it could not read
   * come back null and are left alone rather than filled with a guess, and
   * anything already typed is never overwritten.
   */
  const scanReceipt = async (file: File) => {
    setScanning(true);
    setScanNote(null);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        // readAsDataURL gives "data:image/jpeg;base64,AAAA…" — the API wants
        // only what follows the comma.
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read that file"));
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("receipt-scan", {
        body: {
          image_base64: base64,
          media_type: file.type || "image/jpeg",
          categories: categories.map((c) => c.name),
        },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; fields?: Record<string, string | null> };
      if (!res?.ok || !res.fields) {
        setScanNote(res?.error ?? "Could not read that receipt — fill it in below.");
        return;
      }

      const f = res.fields;
      if (f.spent_on) setSpentOn(f.spent_on);
      if (f.amount && parseAmountToCents(f.amount)) setAmount(f.amount);
      if (f.vendor && !vendor) setVendor(f.vendor);
      if (f.description && !description) setDescription(f.description);
      if (f.payment_method) setMethod(f.payment_method);
      if (f.category_hint) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === String(f.category_hint).toLowerCase(),
        );
        if (match) setCategoryId(match.id);
      }
      setScanNote(
        f.confidence === "low"
          ? "The photo was hard to read — please check every field."
          : "Read from the photo. Check it before saving.",
      );
    } catch {
      setScanNote("Could not read that receipt — fill it in below.");
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    const cents = parseAmountToCents(amount);
    if (!cents) {
      toast.error("Enter an amount like 45.00");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (receipt) {
        if (receipt.size > 10 * 1024 * 1024) {
          toast.error("Receipt must be under 10MB");
          setSaving(false);
          return;
        }
        const ext = receipt.name.split(".").pop() || "jpg";
        // Foldered by year so a year's receipts can be handed over as a unit.
        receipt_path = `${spentOn.slice(0, 4)}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("receipts").upload(receipt_path, receipt);
        if (error) throw error;
      }

      const { error } = await supabase.from("expenses").insert({
        spent_on: spentOn,
        amount_cents: cents,
        category_id: categoryId || null,
        payee_id: payeeId || null,
        vendor: vendor.trim() || null,
        description: description.trim() || null,
        payment_method: method,
        receipt_path,
        entered_by: user.id,
        // Typed in by a person who saw the receipt, so it counts as reviewed.
        reviewed: true,
      });
      if (error) throw error;

      toast.success("Expense recorded.");
      setOpen(false);
      setAmount(""); setVendor(""); setDescription(""); setReceipt(null);
      setCategoryId(""); setPayeeId("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1.5 h-4 w-4" /> Record an expense</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record an expense</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-date">Date</Label>
              <Input id="ex-date" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-amount">Amount</Label>
              <Input id="ex-amount" inputMode="decimal" placeholder="45.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-cat">Category</Label>
            <select
              id="ex-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-payee">Paid to</Label>
            <select
              id="ex-payee"
              value={payeeId}
              onChange={(e) => setPayeeId(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">A one-off vendor…</option>
              {payees.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!payeeId && (
              <Input placeholder="Vendor name, e.g. BGE" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            )}
            <p className="text-xs text-muted-foreground">
              Choose a payee for anyone paid repeatedly — musicians, ministers — so the year's total
              can be counted against them.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-method">Paid by</Label>
            <select
              id="ex-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="transfer">Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-desc">Description</Label>
            <Textarea id="ex-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-receipt">Receipt photo</Label>
            <Input
              id="ex-receipt"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setReceipt(f);
                // PDFs are stored but not read — this reads photographs.
                if (f && f.type.startsWith("image/")) scanReceipt(f);
              }}
            />
            {scanning && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Reading the receipt…
              </p>
            )}
            {scanNote && !scanning && (
              <p className="flex items-start gap-1.5 text-xs text-accent">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> {scanNote}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              On a phone this opens the camera. A photograph fills in the fields above for you to
              check. Receipts are stored privately and opened through a link that expires.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
