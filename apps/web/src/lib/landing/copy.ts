import type { LandingCopy, LandingLanguage } from '@/lib/landing/types';

const LANDING_COPY: Record<LandingLanguage, LandingCopy> = {
  zh: {
    nav: {
      solutions: '解决方案',
      caseStudy: '客户案例',
      contact: '联系开通',
      login: '登录',
    },
    hero: {
      tag: '葡萄牙堂食扫码点餐 · 中餐与寿司自助',
      titleA: '少投入 · 断网不停业',
      titleB: '权限清晰 · 全程可追溯',
      desc: '顾客手机扫码点餐，不必每桌平板。云端 + 门店部署：外网中断仍可下单、结账、出票。开台到结账全程留痕。堂食按菜点餐与自助人头计费，同一套流程 — 覆盖中餐、寿司自助等业态。',
      whatsappCta: 'WhatsApp 咨询',
      wechatCta: '微信咨询',
      proofs: ['扫码点餐', '云端 + 门店部署', '少平板 · 省投入'],
      agentLead: '渠道合作？',
      agentCta: '诚招代理',
    },
    pain: {
      title: '堂食扫码常遇到的问题',
      items: [
        {
          title: '平板墙成本高',
          problem: '每桌一台专用平板，采购、充电、损坏与更换持续烧钱。',
          solution: '顾客扫码点餐，无需每桌专用平板，大幅降低设备投入。',
        },
        {
          title: '依赖外网怕停业',
          problem: '纯云端系统一旦断网，下单结账一起停。',
          solution: '云端 + 门店部署，外网挂了店照常营业。',
        },
        {
          title: '权限与追溯不清',
          problem: '谁开台、谁改单、谁结账说不清，纠纷难查。',
          solution: '按角色授权，订单历史完整留痕，责任清楚。',
        },
      ],
    },
    buffet: {
      title: '为堂食与自助而生',
      subtitle: '从开台到结账，核心场景完整覆盖。',
      items: [
        {
          title: '价目自动切换',
          desc: '工作日、周末、节假日与分时段价格提前设好，到点自动执行，不用每天手改。',
        },
        {
          title: '手机电脑协同',
          desc: '服务员与收银按权限在手机或电脑处理，不用反复跑前台。',
        },
        {
          title: '开台后扫码点餐',
          desc: '服务员开台后顾客扫码点餐；堂食按菜计价，自助可加人头规则。',
        },
      ],
    },
    support: {
      title: '全面支撑日常运营',
      items: [
        {
          title: '多语菜单',
          desc: '葡语、英语、中文等一键切换，服务多元客群。',
        },
        {
          title: '经营数据',
          desc: '今日营业额、热销品一目了然。',
        },
        {
          title: '吧台打印',
          desc: '酒水单、结账单按站点自动打印。',
        },
      ],
    },
    caseStudy: {
      title: '客户案例',
      hours: '午餐 12:00–15:00 · 晚餐 19:00–23:00',
    },
    contact: {
      title: '了解方案 · 预约演示',
      subtitle: '价格与配置请直接联系我们。正式开通由专人一对一配置，无需自行注册。',
      pricingNote: '联系获取定制方案',
      whatsappLabel: 'WhatsApp',
      wechatLabel: '微信',
      wechatScanHint: '扫码或搜索微信号添加',
      wechatCopy: '复制微信号',
      wechatCopied: '已复制',
      stepsTitle: '开通流程',
      steps: [
        {
          title: '联系咨询',
          desc: '通过 WhatsApp 或微信说明餐厅情况',
        },
        {
          title: '了解方案',
          desc: '根据规模与需求介绍配置与报价',
        },
        {
          title: '专人开通',
          desc: '管理员配置账号、菜单与打印',
        },
        {
          title: '培训上线',
          desc: '远程或现场指导，顺利投入使用',
        },
      ],
      agent: {
        title: '诚招代理',
        subtitle: '区域合作 · 云端 + 门店部署支持',
        note: '与预约演示使用同一套 WhatsApp / 微信联系方式。',
      },
    },
    footer: {
      login: '已有账号？登录后台',
      copyright: '葡萄牙堂食扫码点餐与自助运营系统',
    },
  },
  en: {
    nav: {
      solutions: 'Solutions',
      caseStudy: 'Customers',
      contact: 'Contact',
      login: 'Sign in',
    },
    hero: {
      tag: 'Dine-in QR ordering in Portugal · Chinese & sushi buffet',
      titleA: 'Lower spend · Offline-ready',
      titleB: 'Clear roles · Full audit trail',
      desc: 'Guests order on their phones — no tablet per table. Cloud + in-store deployment: ordering, checkout, and printing continue if the WAN drops. One flow for à la carte dine-in and buffet headcount — Chinese and sushi buffets included.',
      whatsappCta: 'Chat on WhatsApp',
      wechatCta: 'WeChat',
      proofs: ['QR order', 'Cloud + in-store', 'Fewer tablets · Lower cost'],
      agentLead: 'Channel partner?',
      agentCta: 'Become a partner',
    },
    pain: {
      title: 'What dine-in operators struggle with',
      items: [
        {
          title: 'Tablet fleet cost',
          problem: 'One device per table means purchase, charging, breakage, and replacement forever.',
          solution: 'QR ordering on guest phones — no dedicated tablet per seat.',
        },
        {
          title: 'Cloud outages stop service',
          problem: 'Cloud-only stacks freeze ordering and checkout when the WAN drops.',
          solution: 'Cloud + in-store deployment keeps the floor running when the WAN drops.',
        },
        {
          title: 'Unclear accountability',
          problem: 'Hard to see who opened, changed, or closed a table.',
          solution: 'Permissions by role and complete order history.',
        },
      ],
    },
    buffet: {
      title: 'Built for dine-in and buffet',
      subtitle: 'End-to-end coverage from open table to checkout.',
      items: [
        {
          title: 'Auto price switching',
          desc: 'Weekday, weekend, holiday, and time-slot prices run themselves.',
        },
        {
          title: 'Phone + desktop',
          desc: 'Waiters and cashiers work on phone or PC by permission.',
        },
        {
          title: 'Open table, then QR order',
          desc: 'Staff open the table; guests scan to order. À la carte by dish; buffet can add headcount rules.',
        },
      ],
    },
    support: {
      title: 'Everything else you need',
      items: [
        {
          title: 'Multilingual menu',
          desc: 'Portuguese, English, Chinese, and more in one tap.',
        },
        {
          title: 'Business insights',
          desc: 'Today’s revenue and top sellers at a glance.',
        },
        {
          title: 'Bar printing',
          desc: 'Tickets and receipts by station.',
        },
      ],
    },
    caseStudy: {
      title: 'Customer story',
      hours: 'Lunch 12:00–15:00 · Dinner 19:00–23:00',
    },
    contact: {
      title: 'Book a demo',
      subtitle: 'Pricing and setup are tailored. Onboarding is personal — no self-registration.',
      pricingNote: 'Contact us for a tailored quote',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Scan or search WeChat ID',
      wechatCopy: 'Copy WeChat ID',
      wechatCopied: 'Copied',
      stepsTitle: 'How onboarding works',
      steps: [
        {
          title: 'Reach out',
          desc: 'Tell us about your restaurant on WhatsApp or WeChat',
        },
        {
          title: 'Plan',
          desc: 'We recommend setup and pricing',
        },
        {
          title: 'Provision',
          desc: 'We configure accounts, menu, and printing',
        },
        {
          title: 'Go live',
          desc: 'Training until you run smoothly',
        },
      ],
      agent: {
        title: 'Partners wanted',
        subtitle: 'Regional partnership · Cloud + in-store support',
        note: 'Same WhatsApp / WeChat channels as demo requests.',
      },
    },
    footer: {
      login: 'Already have an account? Sign in',
      copyright: 'Dine-in QR ordering and buffet operations for Portugal',
    },
  },
  pt: {
    nav: {
      solutions: 'Soluções',
      caseStudy: 'Clientes',
      contact: 'Contacto',
      login: 'Entrar',
    },
    hero: {
      tag: 'Pedidos por QR no salão · Buffet chinês e sushi',
      titleA: 'Menos investimento · Sem depender da net',
      titleB: 'Papéis claros · Rasto completo',
      desc: 'O cliente pede no telemóvel — sem tablet por mesa. Cloud + instalação na loja: pedir, pagar e imprimir mesmo sem WAN. Um fluxo para à la carte e buffet por pessoa — chinês e sushi incluídos.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      proofs: ['Pedido por QR', 'Cloud + loja', 'Menos tablets · Menos custo'],
      agentLead: 'Parceiro de canal?',
      agentCta: 'Torne-se parceiro',
    },
    pain: {
      title: 'Desafios do salão com QR',
      items: [
        {
          title: 'Custo da frota de tablets',
          problem: 'Um dispositivo por mesa: compra, carga, avarias e substituição.',
          solution: 'Pedidos por QR no telemóvel do cliente — sem tablet por lugar.',
        },
        {
          title: 'Queda de rede para o serviço',
          problem: 'Só na cloud, a WAN cai e o pedido/pagamento param.',
          solution: 'Cloud + instalação na loja mantém a sala a funcionar.',
        },
        {
          title: 'Responsabilidade pouco clara',
          problem: 'Difícil saber quem abriu, alterou ou fechou a mesa.',
          solution: 'Papéis com permissão e histórico completo.',
        },
      ],
    },
    buffet: {
      title: 'Feito para salão e buffet',
      subtitle: 'Da abertura de mesa ao pagamento.',
      items: [
        {
          title: 'Preços automáticos',
          desc: 'Dias úteis, fim de semana, feriados e franjas — aplicam-se sozinhos.',
        },
        {
          title: 'Telemóvel e computador',
          desc: 'Empregados e caixa trabalham no telemóvel ou PC conforme a permissão.',
        },
        {
          title: 'Abrir mesa, depois pedido por QR',
          desc: 'A equipa abre a mesa; o cliente faz scan para pedir. À la carte por prato; buffet pode acrescentar regras por pessoa.',
        },
      ],
    },
    support: {
      title: 'Tudo o resto que precisa',
      items: [
        {
          title: 'Menu multilingue',
          desc: 'Português, inglês, chinês e mais num toque.',
        },
        {
          title: 'Dados do negócio',
          desc: 'Faturação e tops do dia.',
        },
        {
          title: 'Impressão no balcão',
          desc: 'Talões e recibos por estação.',
        },
      ],
    },
    caseStudy: {
      title: 'Cliente',
      hours: 'Almoço 12:00–15:00 · Jantar 19:00–23:00',
    },
    contact: {
      title: 'Marcar demonstração',
      subtitle: 'Preço e configuração à medida. Onboarding pessoal — sem registo por conta própria.',
      pricingNote: 'Contacte-nos para proposta',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Digitalize ou pesquise o ID WeChat',
      wechatCopy: 'Copiar ID WeChat',
      wechatCopied: 'Copiado',
      stepsTitle: 'Como funciona o onboarding',
      steps: [
        {
          title: 'Contacto',
          desc: 'Fale connosco por WhatsApp ou WeChat',
        },
        {
          title: 'Plano',
          desc: 'Proposta conforme o seu restaurante',
        },
        {
          title: 'Configuração',
          desc: 'Contas, menu e impressão',
        },
        {
          title: 'Arranque',
          desc: 'Formação até estar operacional',
        },
      ],
      agent: {
        title: 'Recrutamos parceiros',
        subtitle: 'Parceria regional · suporte Cloud + loja',
        note: 'Os mesmos canais WhatsApp / WeChat da demonstração.',
      },
    },
    footer: {
      login: 'Já tem conta? Entrar',
      copyright: 'Pedidos por QR no salão e buffet em Portugal',
    },
  },
  es: {
    nav: {
      solutions: 'Soluciones',
      caseStudy: 'Clientes',
      contact: 'Contacto',
      login: 'Iniciar sesión',
    },
    hero: {
      tag: 'Pedidos QR en sala · Buffet chino y sushi',
      titleA: 'Menos gasto · Sin depender de la red',
      titleB: 'Roles claros · Rastro completo',
      desc: 'El cliente pide en el móvil — sin tablet por mesa. Nube + instalación en el local: pedir, cobrar e imprimir si cae la WAN. Un flujo para carta y buffet por persona — chino y sushi incluidos.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      proofs: ['Pedido por QR', 'Nube + local', 'Menos tablets · Menos coste'],
      agentLead: '¿Canal partner?',
      agentCta: 'Sé partner',
    },
    pain: {
      title: 'Retos del salón con QR',
      items: [
        {
          title: 'Coste de la flota de tablets',
          problem: 'Un dispositivo por mesa: compra, carga, roturas y reemplazo.',
          solution: 'Pedidos por QR en el móvil del cliente.',
        },
        {
          title: 'Caídas de red paran el servicio',
          problem: 'Solo en la nube, sin WAN se detienen pedidos y cobro.',
          solution: 'Nube + instalación en el local mantiene la sala operativa.',
        },
        {
          title: 'Responsabilidad poco clara',
          problem: 'Difícil saber quién abrió, cambió o cerró la mesa.',
          solution: 'Roles con permiso e historial completo.',
        },
      ],
    },
    buffet: {
      title: 'Hecho para sala y buffet',
      subtitle: 'De abrir mesa al cobro.',
      items: [
        {
          title: 'Precios automáticos',
          desc: 'Laborables, fin de semana, festivos y franjas se aplican solos.',
        },
        {
          title: 'Móvil y escritorio',
          desc: 'Camareros y caja en móvil o PC según permiso.',
        },
        {
          title: 'Abrir mesa, luego pedido por QR',
          desc: 'El personal abre la mesa; el cliente escanea para pedir. Carta por plato; el buffet puede añadir reglas por persona.',
        },
      ],
    },
    support: {
      title: 'Todo lo demás que necesitas',
      items: [
        {
          title: 'Menú multilingüe',
          desc: 'Portugués, inglés, chino y más en un toque.',
        },
        {
          title: 'Datos del negocio',
          desc: 'Ingresos y más vendidos del día.',
        },
        {
          title: 'Impresión de bar',
          desc: 'Tickets y recibos por estación.',
        },
      ],
    },
    caseStudy: {
      title: 'Historia de cliente',
      hours: 'Comida 12:00–15:00 · Cena 19:00–23:00',
    },
    contact: {
      title: 'Reservar una demo',
      subtitle: 'Precio y configuración a medida. Onboarding personal — sin registro por su cuenta.',
      pricingNote: 'Contáctanos para un presupuesto',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Escanea o busca ID de WeChat',
      wechatCopy: 'Copiar ID de WeChat',
      wechatCopied: 'Copiado',
      stepsTitle: 'Cómo funciona el onboarding',
      steps: [
        {
          title: 'Contacta',
          desc: 'Cuéntanos por WhatsApp o WeChat',
        },
        {
          title: 'Planifica',
          desc: 'Recomendamos configuración y precios',
        },
        {
          title: 'Provisiona',
          desc: 'Configuramos cuentas, menú e impresión',
        },
        {
          title: 'En vivo',
          desc: 'Formación hasta que funcione bien',
        },
      ],
      agent: {
        title: 'Buscamos partners',
        subtitle: 'Colaboración regional · soporte Nube + local',
        note: 'Los mismos canales WhatsApp / WeChat que para la demo.',
      },
    },
    footer: {
      login: '¿Ya tienes cuenta? Iniciar sesión',
      copyright: 'Pedidos QR en sala y buffet en Portugal',
    },
  },
  fr: {
    nav: {
      solutions: 'Solutions',
      caseStudy: 'Clients',
      contact: 'Contact',
      login: 'Connexion',
    },
    hero: {
      tag: 'Commande QR en salle · Buffet chinois et sushi',
      titleA: 'Moins de dépenses · Hors ligne',
      titleB: 'Rôles clairs · Traçabilité complète',
      desc: 'Le client commande sur son téléphone — pas de tablette par table. Cloud + installation en magasin : commander, payer et imprimer si le WAN tombe. Un flux pour la carte et le buffet par tête — chinois et sushi inclus.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      proofs: ['Commande QR', 'Cloud + magasin', 'Moins de tablettes · Moins de coût'],
      agentLead: 'Partenaire canal ?',
      agentCta: 'Devenir partenaire',
    },
    pain: {
      title: 'Défis de la salle en QR',
      items: [
        {
          title: 'Coût de la flotte de tablettes',
          problem: 'Un appareil par table : achat, charge, casse et remplacement.',
          solution: 'Commande QR sur le téléphone du client.',
        },
        {
          title: 'Panne réseau = service arrêté',
          problem: '100 % cloud : sans WAN, commandes et caisse s’arrêtent.',
          solution: 'Cloud + installation en magasin maintient la salle.',
        },
        {
          title: 'Responsabilité floue',
          problem: 'Difficile de savoir qui a ouvert, modifié ou clôturé.',
          solution: 'Rôles + historique complet.',
        },
      ],
    },
    buffet: {
      title: 'Conçu pour la salle et le buffet',
      subtitle: 'De l’ouverture de table au paiement.',
      items: [
        {
          title: 'Prix automatiques',
          desc: 'Semaine, week-end, fériés et créneaux s’appliquent seuls.',
        },
        {
          title: 'Téléphone et bureau',
          desc: 'Serveurs et caisse sur téléphone ou PC selon les droits.',
        },
        {
          title: 'Ouvrir la table, puis commande QR',
          desc: 'Le personnel ouvre la table ; le client scanne pour commander. Carte par plat ; le buffet peut ajouter des règles par tête.',
        },
      ],
    },
    support: {
      title: 'Tout le reste dont vous avez besoin',
      items: [
        {
          title: 'Menu multilingue',
          desc: 'Portugais, anglais, chinois et plus en un geste.',
        },
        {
          title: 'Indicateurs',
          desc: 'CA du jour et best-sellers.',
        },
        {
          title: 'Impression bar',
          desc: 'Tickets et reçus par station.',
        },
      ],
    },
    caseStudy: {
      title: 'Témoignage',
      hours: 'Déjeuner 12:00–15:00 · Dîner 19:00–23:00',
    },
    contact: {
      title: 'Réserver une démo',
      subtitle: 'Tarifs et configuration sur mesure. Onboarding personnel — pas d’inscription par vous-même.',
      pricingNote: 'Contactez-nous pour un devis',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Scannez ou recherchez l’ID WeChat',
      wechatCopy: 'Copier l’ID WeChat',
      wechatCopied: 'Copié',
      stepsTitle: 'Comment se passe l’onboarding',
      steps: [
        {
          title: 'Contact',
          desc: 'Parlez-nous via WhatsApp ou WeChat',
        },
        {
          title: 'Plan',
          desc: 'Nous proposons config et tarifs',
        },
        {
          title: 'Provision',
          desc: 'Comptes, menu et impression',
        },
        {
          title: 'Mise en service',
          desc: 'Formation jusqu’à un fonctionnement fluide',
        },
      ],
      agent: {
        title: 'Partenaires recherchés',
        subtitle: 'Partenariat régional · support Cloud + magasin',
        note: 'Mêmes canaux WhatsApp / WeChat que pour la démo.',
      },
    },
    footer: {
      login: 'Déjà un compte ? Connexion',
      copyright: 'Commande QR en salle et buffet au Portugal',
    },
  },
  de: {
    nav: {
      solutions: 'Lösungen',
      caseStudy: 'Kunden',
      contact: 'Kontakt',
      login: 'Anmelden',
    },
    hero: {
      tag: 'QR-Bestellung im Saal · China- & Sushi-Buffet',
      titleA: 'Weniger Kosten · Offline-fähig',
      titleB: 'Klare Rollen · Volle Nachverfolgung',
      desc: 'Gäste bestellen am Handy — kein Tablet pro Tisch. Cloud + Installation vor Ort: Bestellen, Zahlen und Drucken bei WAN-Ausfall. Ein Ablauf für à la carte und Buffet pro Kopf — China und Sushi inklusive.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      proofs: ['QR-Bestellung', 'Cloud + vor Ort', 'Weniger Tablets · Weniger Kosten'],
      agentLead: 'Channel-Partner?',
      agentCta: 'Partner werden',
    },
    pain: {
      title: 'Herausforderungen im QR-Saal',
      items: [
        {
          title: 'Kosten der Tablet-Flotte',
          problem: 'Ein Gerät pro Tisch: Kauf, Laden, Bruch und Ersatz.',
          solution: 'QR-Bestellung auf dem Gästehandy.',
        },
        {
          title: 'Netzausfall stoppt den Service',
          problem: 'Nur Cloud: ohne WAN stehen Bestellung und Kasse.',
          solution: 'Cloud + Installation vor Ort hält den Saal am Laufen.',
        },
        {
          title: 'Unklare Verantwortung',
          problem: 'Schwer zu sehen, wer öffnete, änderte oder schloss.',
          solution: 'Rollenrechte und vollständige Bestellhistorie.',
        },
      ],
    },
    buffet: {
      title: 'Für Saal und Buffet gebaut',
      subtitle: 'Vom Tischöffnen bis zur Kasse.',
      items: [
        {
          title: 'Automatischer Preiswechsel',
          desc: 'Werktag, Wochenende, Feiertag und Zeitslots gelten von selbst.',
        },
        {
          title: 'Handy und Desktop',
          desc: 'Service und Kasse am Handy oder PC gemäß Recht.',
        },
        {
          title: 'Tisch öffnen, dann QR-Bestellung',
          desc: 'Personal öffnet den Tisch; Gäste scannen zum Bestellen. À la carte nach Gericht; Buffet kann Kopfzahl-Regeln ergänzen.',
        },
      ],
    },
    support: {
      title: 'Alles Weitere, was Sie brauchen',
      items: [
        {
          title: 'Mehrsprachiges Menü',
          desc: 'Portugiesisch, Englisch, Chinesisch und mehr.',
        },
        {
          title: 'Kennzahlen',
          desc: 'Tagesumsatz und Topseller.',
        },
        {
          title: 'Bar-Druck',
          desc: 'Tickets und Belege je Station.',
        },
      ],
    },
    caseStudy: {
      title: 'Kundengeschichte',
      hours: 'Mittag 12:00–15:00 · Abendessen 19:00–23:00',
    },
    contact: {
      title: 'Demo buchen',
      subtitle: 'Preis und Setup maßgeschneidert. Persönliches Onboarding — keine eigenständige Registrierung.',
      pricingNote: 'Kontakt für ein Angebot',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'QR scannen oder WeChat-ID suchen',
      wechatCopy: 'WeChat-ID kopieren',
      wechatCopied: 'Kopiert',
      stepsTitle: 'So läuft das Onboarding',
      steps: [
        {
          title: 'Kontakt',
          desc: 'Per WhatsApp oder WeChat melden',
        },
        {
          title: 'Planen',
          desc: 'Setup und Preise empfehlen',
        },
        {
          title: 'Bereitstellen',
          desc: 'Konten, Menü und Druck',
        },
        {
          title: 'Go-live',
          desc: 'Schulung bis zum reibungslosen Lauf',
        },
      ],
      agent: {
        title: 'Partner gesucht',
        subtitle: 'Regionale Partnerschaft · Cloud + vor Ort',
        note: 'Dieselben WhatsApp-/WeChat-Kanäle wie für die Demo.',
      },
    },
    footer: {
      login: 'Bereits ein Konto? Anmelden',
      copyright: 'QR-Bestellung im Saal und Buffet-Betrieb in Portugal',
    },
  },
};

export function getLandingCopy(lang: LandingLanguage): LandingCopy {
  return LANDING_COPY[lang];
}
