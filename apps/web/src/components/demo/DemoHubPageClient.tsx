'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { UILanguage } from '@/lib/i18n';

const DEMO_HUB_TEXT = {
  zh: {
    tag: '实时演示',
    title: '完整展示餐厅服务闭环',
    desc: '通过这个引导流程，演示同一笔订单如何在顾客、后厨、服务员三端流转。',
    start: '开始演示',
    back: '返回首页',
    cards: [
      { title: '顾客流程', desc: '扫码下单并发起结账请求。', step: '第 1 步' },
      { title: '后厨界面', desc: '接收新单并更新出餐状态。', step: '第 2 步' },
      { title: '服务员看板', desc: '查看可端菜桌台与服务优先级。', step: '第 3 步' },
    ],
  },
  en: {
    tag: 'live demo',
    title: 'Showcase the full service flow',
    desc: 'Use this guided path to show how one order moves across customer, kitchen, and waiter views.',
    start: 'Start demo',
    back: 'Back to landing',
    cards: [
      { title: 'Customer flow', desc: 'Scan table QR, place order, and request bill.', step: 'Step 1' },
      { title: 'Kitchen interface', desc: 'Receive incoming tickets and update dish status.', step: 'Step 2' },
      { title: 'Waiter dashboard', desc: 'Track ready-to-serve tables and service priorities.', step: 'Step 3' },
    ],
  },
  pt: {
    tag: 'demo ao vivo',
    title: 'Mostre o fluxo completo de servico',
    desc: 'Use esta rota guiada para demonstrar como um pedido passa por cliente, cozinha e garcom.',
    start: 'Iniciar demo',
    back: 'Voltar ao inicio',
    cards: [
      { title: 'Fluxo do cliente', desc: 'Escanear QR da mesa, pedir e solicitar conta.', step: 'Passo 1' },
      { title: 'Interface da cozinha', desc: 'Receber pedidos e atualizar status dos pratos.', step: 'Passo 2' },
      { title: 'Painel do garcom', desc: 'Ver mesas prontas para servir e prioridades.', step: 'Passo 3' },
    ],
  },
  es: {
    tag: 'demo en vivo',
    title: 'Muestre el flujo completo del servicio',
    desc: 'Use esta ruta guiada para mostrar como un pedido pasa por cliente, cocina y camarero.',
    start: 'Iniciar demo',
    back: 'Volver al inicio',
    cards: [
      { title: 'Flujo del cliente', desc: 'Escanear QR de mesa, pedir y solicitar la cuenta.', step: 'Paso 1' },
      { title: 'Interfaz de cocina', desc: 'Recibir pedidos y actualizar el estado de los platos.', step: 'Paso 2' },
      { title: 'Panel del camarero', desc: 'Ver mesas listas para servir y prioridades.', step: 'Paso 3' },
    ],
  },
  fr: {
    tag: 'demo en direct',
    title: 'Montrez le flux complet du service',
    desc: 'Utilisez ce parcours guide pour montrer comment une commande traverse client, cuisine et serveur.',
    start: 'Demarrer la demo',
    back: "Retour a l'accueil",
    cards: [
      { title: 'Parcours client', desc: 'Scanner le QR de table, commander et demander l addition.', step: 'Etape 1' },
      { title: 'Interface cuisine', desc: 'Recevoir les tickets et mettre a jour le statut des plats.', step: 'Etape 2' },
      { title: 'Tableau serveur', desc: 'Suivre les tables pretes a servir et les priorites.', step: 'Etape 3' },
    ],
  },
  de: {
    tag: 'Live-Demo',
    title: 'Den gesamten Serviceablauf zeigen',
    desc: 'Mit diesem gefuhrten Pfad zeigen, wie eine Bestellung uber Gast, Kuche und Service lauft.',
    start: 'Demo starten',
    back: 'Zuruck zur Startseite',
    cards: [
      { title: 'Gastablauf', desc: 'Tisch-QR scannen, bestellen und Rechnung anfordern.', step: 'Schritt 1' },
      { title: 'Kuchenansicht', desc: 'Neue Tickets empfangen und Gerichtstatus aktualisieren.', step: 'Schritt 2' },
      { title: 'Service-Board', desc: 'Servierbereite Tische und Prioritaten verfolgen.', step: 'Schritt 3' },
    ],
  },
} as const satisfies Record<
  UILanguage,
  {
    tag: string;
    title: string;
    desc: string;
    start: string;
    back: string;
    cards: { title: string; desc: string; step: string }[];
  }
>;

export function DemoHubPageClient() {
  const { lang } = useLanguage();
  const text = DEMO_HUB_TEXT[lang];
  const roleCards = [
    { href: '/demo/menu', emoji: '📱', ...text.cards[0] },
    { href: '/demo/kitchen', emoji: '👨‍🍳', ...text.cards[1] },
    { href: '/demo/waiter', emoji: '🧑‍💼', ...text.cards[2] },
  ];

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-brand-border bg-brand-card p-5 sm:p-7">
          <p className="text-[13px] uppercase tracking-[0.18em] text-brand-gold">{text.tag}</p>
          <h1 className="mt-2 font-heading text-3xl text-brand-text sm:text-4xl">
            {text.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-brand-text-muted">
            {text.desc}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className="rounded-xl bg-brand-gold px-4 py-2 text-[15px] font-semibold text-brand-on-gold hover:bg-brand-gold-light transition-colors"
            >
              {text.start}
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-brand-border px-4 py-2 text-[15px] text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {text.back}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {roleCards.map((card) => (
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
