"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  PhoneCall,
  Percent,
  Landmark,
  FileSpreadsheet,
  ShieldCheck,
  History,
  ArrowRight,
  CheckCircle2,
  Building2,
  UserCog,
  Headphones,
  BadgeCheck,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: PhoneCall,
    title: "Calling queue that prioritizes itself",
    body: "Every assigned debtor sorted into Overdue, Due today, and Upcoming - automatically rescheduled the moment you log an outcome.",
  },
  {
    icon: Percent,
    title: "Commission that calculates itself",
    body: "Ageing-based commission tiers pre-fill on every invoice and compute automatically the moment a payment lands.",
  },
  {
    icon: Landmark,
    title: "Cheque & PDC tracking",
    body: "Post-dated cheques surface on the dashboard seven days before they mature - nothing slips through.",
  },
  {
    icon: FileSpreadsheet,
    title: "Spreadsheet import, validated first",
    body: "Load a debtor portfolio or a prospect list in two clicks - dry-run validation catches errors before anything is committed.",
  },
  {
    icon: ShieldCheck,
    title: "Real role-based access",
    body: "Five roles, one permission model - enforced on every request server-side, not just hidden in the sidebar.",
  },
  {
    icon: History,
    title: "A full audit trail",
    body: "Every payment, correction, and status change is recorded: who, what, and when - the source of truth when it matters.",
  },
];

const STEPS = [
  { title: "Import your portfolio", body: "Upload a spreadsheet of debtors and invoices, or add them by hand." },
  { title: "Work the queue", body: "Call in priority order, log outcomes, follow-ups schedule themselves." },
  { title: "Get paid", body: "Record cheques and payments the moment money arrives." },
  { title: "Track commission", body: "Watch what your agency earned, automatically, on the dashboard." },
];

const ROLES = [
  { icon: BadgeCheck, label: "Owner", body: "Full control of the workspace" },
  { icon: UserCog, label: "Operations Manager", body: "Runs day-to-day operations" },
  { icon: Headphones, label: "Collector", body: "Works the assigned book" },
  { icon: Users, label: "Sales Rep", body: "Owns their own pipeline" },
  { icon: Building2, label: "Client Portal", body: "Read-only view of their portfolio" },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center justify-between">
          <span className="font-semibold text-brand-dark tracking-tight">Recoupa</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-brand-dark transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-brand-dark transition-colors">How it works</a>
            <Link href="/handbook" className="hover:text-brand-dark transition-colors">Handbook</Link>
          </nav>
          <Link
            href="/login"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-brand-light/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-0 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 md:px-8 pt-16 md:pt-24 pb-20 grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
              Collection &amp; Sales Operations
            </span>
            <h1 className="mt-5 text-4xl md:text-[2.75rem] font-semibold tracking-tight text-slate-900 leading-[1.1]">
              Run recovery and sales<br className="hidden md:block" /> from one clean workspace.
            </h1>
            <p className="mt-5 text-base text-slate-600 max-w-md leading-relaxed">
              Principal clients, debtors, invoices, cheques, and commission on one side. Prospects,
              outreach, and conversions on the other. One login, one source of truth, built for a
              small recovery agency that's outgrown spreadsheets.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
              >
                Sign in <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/handbook"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Read the handbook
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              {["Multi-tenant", "Role-based by design", "Full audit trail"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" /> {t}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <DashboardMockup />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 md:px-8 py-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="max-w-xl"
        >
          <h2 className="text-2xl font-semibold text-slate-900">
            Everything one agency needs, nothing it doesn't
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Built around how a real recovery desk actually works day to day.
          </p>
        </motion.div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <div className="mt-3 font-medium text-sm text-slate-800">{f.title}</div>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-20">
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-2xl font-semibold text-slate-900 text-center"
          >
            How it works
          </motion.h2>
          <div className="mt-12 flex flex-col md:flex-row md:items-start">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex md:flex-1 md:flex-col items-start md:items-center gap-4 md:gap-0">
                <motion.div
                  custom={i}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="flex md:flex-col items-center md:items-center gap-4 md:gap-0 md:w-full"
                >
                  <div className="h-10 w-10 shrink-0 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </div>
                  <div className="md:mt-4 md:text-center">
                    <div className="font-medium text-sm text-slate-800">{s.title}</div>
                    <p className="mt-1 text-xs text-slate-500 max-w-[180px] md:mx-auto leading-relaxed">{s.body}</p>
                  </div>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block flex-1 h-px bg-slate-200 mt-5 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-4 md:px-8 py-20">
        <motion.h2
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-2xl font-semibold text-slate-900"
        >
          One login, the right slice of the workspace
        </motion.h2>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.label}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeUp}
              className="rounded-xl border border-slate-200 bg-white p-4 text-center"
            >
              <r.icon className="h-5 w-5 mx-auto text-brand" />
              <div className="mt-2 text-sm font-medium text-slate-800">{r.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{r.body}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-4 md:px-8 pb-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="rounded-2xl bg-brand-dark px-8 py-12 md:py-14 text-center"
        >
          <h2 className="text-2xl font-semibold text-white">Ready to get your portfolio under control?</h2>
          <p className="mt-2 text-sm text-white/70">Sign in to pick up right where your team left off.</p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-medium text-brand-dark hover:bg-slate-100 transition-colors"
          >
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>Recoupa - Collection &amp; Sales Operations</span>
          <Link href="/handbook" className="hover:text-slate-600">Operator Handbook</Link>
        </div>
      </footer>
    </div>
  );
}

function DashboardMockup() {
  const bars = [40, 65, 35, 80, 55, 90, 60];
  return (
    <div className="relative mx-auto max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { l: "Collected", v: "$48,200" },
          { l: "Balance", v: "$112,900" },
          { l: "Commission", v: "$5,180" },
        ].map((t) => (
          <div key={t.l} className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <div className="text-[10px] text-slate-400">{t.l}</div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5">{t.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-100 p-3 mb-3">
        <div className="flex items-end gap-1.5 h-20">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-brand/70" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {[
          { n: "Al Marwan Trading", s: "PROMISED", c: "bg-amber-100 text-amber-700" },
          { n: "Falcon Retail LLC", s: "OVERDUE", c: "bg-rose-100 text-rose-700" },
          { n: "Horizon Traders", s: "RESOLVED", c: "bg-emerald-100 text-emerald-700" },
        ].map((row) => (
          <div key={row.n} className="flex items-center justify-between rounded-md px-2.5 py-1.5 bg-slate-50">
            <span className="text-xs text-slate-600">{row.n}</span>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${row.c}`}>{row.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
