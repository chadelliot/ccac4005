import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/give")({
  head: () => ({
    meta: [
      { title: "Give — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "Support the ministry of Christ Cathedral Apostolic Church through PayPal, Cash App, or Zelle.",
      },
      { property: "og:title", content: "Give — Christ Cathedral Apostolic Church" },
      {
        property: "og:description",
        content: "Give securely via PayPal, Cash App, or Zelle.",
      },
    ],
  }),
  component: GivePage,
});

type Option = {
  key: string;
  label: string;
  eyebrow: string;
  handle: string;
  copyValue: string;
  href?: string;
  hrefLabel?: string;
  note?: string;
};

const OPTIONS: Option[] = [
  {
    key: "paypal",
    label: "PayPal",
    eyebrow: "— Online",
    handle: "paypal.me/christchurchap",
    copyValue: "https://www.paypal.me/christchurchap",
    href: "https://www.paypal.me/christchurchap",
    hrefLabel: "Give with PayPal",
    note: "Opens PayPal in a new tab. Choose any amount and complete checkout securely.",
  },
  {
    key: "cashapp",
    label: "Cash App",
    eyebrow: "— Mobile",
    handle: "$ChristCathedralAP",
    copyValue: "$ChristCathedralAP",
    href: "https://cash.app/$ChristCathedralAP",
    hrefLabel: "Open in Cash App",
    note: "Send to our $Cashtag from the Cash App on your phone.",
  },
  {
    key: "zelle",
    label: "Zelle",
    eyebrow: "— Bank transfer",
    handle: "CCACFinancial@gmail.com",
    copyValue: "CCACFinancial@gmail.com",
    note: "Send through your bank's Zelle feature using the email above. Please add a memo if your gift is for a specific purpose (tithe, offering, missions, etc.).",
  },
];

function GivePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-night text-night-foreground">
        <SiteHeader />
      </div>

      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 lg:px-10 py-20">
            <div className="eyebrow text-accent mb-4">— Giving</div>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05] max-w-3xl">
              Partner with the ministry of Christ Cathedral.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl leading-relaxed">
              Every gift fuels worship, outreach, discipleship, and missions. Choose the method that
              works best for you — PayPal, Cash App, or Zelle.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 lg:px-10 py-16">
          <div className="grid md:grid-cols-3 gap-5">
            {OPTIONS.map((o) => (
              <GivingCard key={o.key} option={o} />
            ))}
          </div>

          <div className="mt-16 border-t border-border pt-10 text-sm text-muted-foreground space-y-2 max-w-2xl">
            <p>
              <span className="font-medium text-foreground">Questions about giving?</span> Reach our
              finance team at{" "}
              <a href="mailto:CCACFinancial@gmail.com" className="text-foreground hover:underline">
                CCACFinancial@gmail.com
              </a>
              .
            </p>
            <p>
              Christ Cathedral Apostolic Church is a registered religious organization. Thank you
              for your generosity.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function GivingCard({ option }: { option: Option }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(option.copyValue);
      setCopied(true);
      toast.success(`${option.label} info copied`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy — please copy manually");
    }
  };

  return (
    <div className="flex flex-col border border-border bg-card p-6 hover:border-foreground/30 transition-colors">
      <div className="eyebrow text-accent text-[10px]">{option.eyebrow}</div>
      <div className="font-display text-2xl mt-2">{option.label}</div>

      <button
        type="button"
        onClick={handleCopy}
        className="group mt-5 flex items-center justify-between gap-3 border border-border bg-background px-3 py-2.5 text-left hover:border-foreground/40"
      >
        <span className="font-mono text-sm truncate">{option.handle}</span>
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
        )}
      </button>

      {option.note && (
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed flex-1">{option.note}</p>
      )}

      {option.href && (
        <Button asChild className="mt-5 w-full">
          <a href={option.href} target="_blank" rel="noreferrer">
            {option.hrefLabel} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}
