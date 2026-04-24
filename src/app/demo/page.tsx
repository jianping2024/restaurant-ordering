import Link from 'next/link';

export const metadata = {
  title: 'Mesa Demo Hub',
};

const ROLE_CARDS = [
  {
    title: 'Customer Flow',
    desc: 'Scan table QR, place order, and request bill.',
    href: '/demo/menu',
    emoji: '📱',
    step: 'Step 1',
  },
  {
    title: 'Kitchen Interface',
    desc: 'Receive incoming tickets and update dish status.',
    href: '/demo/kitchen',
    emoji: '👨‍🍳',
    step: 'Step 2',
  },
  {
    title: 'Waiter Dashboard',
    desc: 'Track ready-to-serve tables and service priorities.',
    href: '/demo/waiter',
    emoji: '🧑‍💼',
    step: 'Step 3',
  },
];

export default function DemoHubPage() {
  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-brand-border bg-brand-card p-5 sm:p-7">
          <p className="text-[13px] uppercase tracking-[0.18em] text-brand-gold">Live demo</p>
          <h1 className="mt-2 font-heading text-3xl text-brand-text sm:text-4xl">
            Showcase the full service flow
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-brand-text-muted">
            Use this guided route to demonstrate how one order moves across customer, kitchen, and waiter views.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className="rounded-xl bg-brand-gold px-4 py-2 text-[15px] font-semibold text-brand-bg hover:bg-brand-gold-light transition-colors"
            >
              Start Demo
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-brand-border px-4 py-2 text-[15px] text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              Back to Landing
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ROLE_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl border border-brand-border bg-brand-card p-5 hover:border-brand-gold/45 transition-colors"
            >
              <p className="text-[13px] text-brand-gold">{card.step}</p>
              <p className="mt-2 text-3xl">{card.emoji}</p>
              <h2 className="mt-3 font-heading text-2xl text-brand-text">{card.title}</h2>
              <p className="mt-1 text-[15px] text-brand-text-muted">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
