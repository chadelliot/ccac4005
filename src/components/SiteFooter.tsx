import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="bg-night text-night-foreground">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-20 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-display text-3xl">Christ Cathedral Apostolic Church</div>
          <p className="mt-4 max-w-md text-night-foreground/70 leading-relaxed">
            A thriving ministry committed to preaching truth, building strong disciples,
            and creating an atmosphere where lives are transformed.
          </p>
        </div>
        <div>
          <div className="eyebrow text-gold mb-4">Visit</div>
          <p className="text-night-foreground/70 text-sm leading-relaxed">
            4005 Old York Road<br />Baltimore, MD<br /><br />Sunday Worship · 2:27 PM
          </p>
        </div>
        <div>
          <div className="eyebrow text-gold mb-4">Connect</div>
          <ul className="space-y-2 text-sm text-night-foreground/70">
            <li><Link to="/about" className="hover:text-gold">About Us</Link></li>
            <li><Link to="/plan-visit" className="hover:text-gold">Plan a Visit</Link></li>
            <li><Link to="/find-us" className="hover:text-gold">Find Us</Link></li>
            <li><Link to="/give" className="hover:text-gold">Give</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-night-foreground/50">
          <div>© {new Date().getFullYear()} Christ Cathedral Apostolic Church. All rights reserved.</div>
          <div className="eyebrow text-gold/60 mt-2 md:mt-0">Baltimore, Maryland · The Life Center</div>
        </div>
      </div>
    </footer>
  );
}
