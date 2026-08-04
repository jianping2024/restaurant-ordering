import { PRODUCT_NAME } from '@mesa/shared';
import type { LandingCopy, LandingLanguage } from '@/lib/landing/types';

const LANDING_COPY: Record<LandingLanguage, LandingCopy> = {
  zh: {
    nav: {
      solutions: '解决方案',
      preview: '产品界面',
      caseStudy: '客户案例',
      contact: '联系开通',
      login: '登录',
    },
    hero: {
      tag: '葡萄牙中餐自助 · 专业运营系统',
      titleA: '让人头计费更精准',
      titleB: '让餐厅运营更从容',
      desc: '服务员开台确认人数，顾客扫码点酒水，订单直达吧台，前台智能分单 — 专为自助餐厅打造。',
      whatsappCta: 'WhatsApp 咨询',
      wechatCta: '微信咨询',
      previewHint: '向下查看产品界面',
    },
    pain: {
      title: '自助餐厅的日常难题',
      items: [
        {
          title: '高峰人数难核对',
          problem: '成人、儿童混在一起，周末与节假日价格不同，人工核算容易出错。',
          solution: '服务员开台确认人数，系统按规则自动计价，改人数只更新人头费。',
        },
        {
          title: '未开台就点单乱账',
          problem: '顾客提前扫码点酒水，与自助餐人头费混在一起，对账和纠纷成本高。',
          solution: '开台后方可点单，人头费与酒水消费分开统计，账目清晰可追溯。',
        },
        {
          title: '多国籍顾客沟通难',
          problem: '华人老板、葡语员工、国际客人，菜单与沟通需要多语言支持。',
          solution: '葡语、英语、中文三语菜单一键切换，服务更专业得体。',
        },
      ],
    },
    buffet: {
      title: '为自助餐厅而生',
      subtitle: '从开台到结账，核心业务场景完整覆盖。',
      items: [
        {
          title: '智能人头计费',
          desc: '成人与儿童分开计价，支持工作日、周末与节假日差异化定价，规则清晰可配置。',
        },
        {
          title: '开台管控',
          desc: '服务员核对人数后确认开台，未开台前顾客端无法下单，降低漏单与纠纷风险。',
        },
        {
          title: '酒水点单与吧台协同',
          desc: '酒水订单实时推送到吧台看板，人头费与酒水消费分开统计，高峰不丢单。',
        },
        {
          title: '前台结账与分单',
          desc: '均摊、按菜分配、自定义三种分单模式，自助餐人头费纳入分单计算。',
        },
      ],
    },
    support: {
      title: '全面支撑日常运营',
      items: [
        {
          title: '三语菜单',
          desc: '葡语、英语、中文一键切换，轻松服务多元客群。',
        },
        {
          title: '经营数据',
          desc: '今日营业额、热销酒水实时掌握，辅助经营决策。',
        },
        {
          title: '吧台打印',
          desc: '酒水单、结账单按站点自动打印，减少沟通成本。',
        },
      ],
    },
    preview: {
      title: '产品界面预览',
      subtitle: `以下为 ${PRODUCT_NAME} 实际系统界面（演示数据）。`,
      remoteDemo: '想亲自操作？通过 WhatsApp 预约远程演示',
      screens: [
        { id: 'waiter-open' as const, label: '开台', caption: '服务员确认成人 / 儿童人数' },
        { id: 'menu' as const, label: '点酒水', caption: '饮料与水果酒分类菜单，订单直达吧台' },
        { id: 'bar' as const, label: '吧台', caption: '酒水订单直达吧台，出单状态清晰' },
        { id: 'bill' as const, label: '分单', caption: '多种分单模式，结账更轻松' },
        { id: 'dashboard' as const, label: '看板', caption: '营业额与热销酒水实时统计' },
      ],
    },
    caseStudy: {
      title: '客户案例',
      name: 'Restaurante Pirata',
      location: '葡萄牙 · 中餐自助',
      quote: `${PRODUCT_NAME} 试点客户，使用系统管理自助餐开台计费与酒水点单流程。`,
      tags: ['中餐自助', '人头计费', '三语菜单'],
    },
    contact: {
      title: '了解方案 · 预约演示',
      subtitle: '价格与配置方案请直接联系我们。正式开通由专人一对一配置，无需自助注册。',
      pricingNote: '联系获取定制方案',
      whatsappLabel: 'WhatsApp',
      wechatLabel: '微信',
      wechatScanHint: '扫码或搜索微信号添加',
      wechatCopy: '复制微信号',
      wechatCopied: '已复制',
      stepsTitle: '开通流程',
      steps: [
        { title: '联系咨询', desc: '通过 WhatsApp 或微信说明餐厅情况' },
        { title: '了解方案', desc: '根据规模与需求介绍配置与报价' },
        { title: '专人开通', desc: '管理员配置账号、菜单与打印' },
        { title: '培训上线', desc: '远程或现场指导，顺利投入使用' },
      ],
    },
    footer: {
      login: '已有账号？登录后台',
      copyright: '葡萄牙中餐自助餐厅运营系统',
    },
  },
  en: {
    nav: {
      solutions: 'Solutions',
      preview: 'Product UI',
      caseStudy: 'Customers',
      contact: 'Contact',
      login: 'Sign in',
    },
    hero: {
      tag: 'Chinese buffet in Portugal · Professional operations',
      titleA: 'Accurate per-guest billing',
      titleB: 'Calmer restaurant operations',
      desc: 'Staff confirm headcount at open table, guests order drinks by QR, tickets go straight to the bar, and checkout supports smart bill split — built for buffet restaurants.',
      whatsappCta: 'Chat on WhatsApp',
      wechatCta: 'WeChat',
      previewHint: 'See product screens below',
    },
    pain: {
      title: 'Daily challenges buffet owners face',
      items: [
        {
          title: 'Peak-hour headcount',
          problem: 'Adult and child pricing differs by day; manual counts are error-prone.',
          solution: 'Staff confirm guests at open table; pricing rules apply automatically.',
        },
        {
          title: 'Orders before open table',
          problem: 'Drink orders placed before headcount is confirmed blur buffet vs. bar revenue.',
          solution: 'Ordering unlocks after open table; buffet base and drink orders stay separate.',
        },
        {
          title: 'Multilingual guests',
          problem: 'Owners, staff, and guests often need more than one language.',
          solution: 'Portuguese, English, and Chinese menus in one tap.',
        },
      ],
    },
    buffet: {
      title: 'Built for buffet restaurants',
      subtitle: 'End-to-end coverage from open table to checkout.',
      items: [
        {
          title: 'Smart per-guest pricing',
          desc: 'Adult and child rates with weekday, weekend, and holiday rules.',
        },
        {
          title: 'Open-table control',
          desc: 'Staff verify headcount before guests can order drinks.',
        },
        {
          title: 'Drinks & bar',
          desc: 'Drink orders hit the bar display in real time; reporting stays clear.',
        },
        {
          title: 'Checkout & split',
          desc: 'Even, by-item, or custom splits — buffet base included.',
        },
      ],
    },
    support: {
      title: 'Everything else you need',
      items: [
        { title: 'Trilingual menu', desc: 'Portuguese, English, and Chinese for diverse guests.' },
        { title: 'Business insights', desc: 'Today’s revenue and top drinks at a glance.' },
        { title: 'Bar printing', desc: 'Bar tickets and receipts by station.' },
      ],
    },
    preview: {
      title: 'Product screens',
      subtitle: `Actual ${PRODUCT_NAME} UI with demo data.`,
      remoteDemo: 'Want a live walkthrough? Book a remote demo via WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Open table', caption: 'Staff confirm adult / child count' },
        { id: 'menu' as const, label: 'Drinks', caption: 'Beverages and fruit wine menu — orders to the bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Drink orders routed to the bar with clear status' },
        { id: 'bill' as const, label: 'Split bill', caption: 'Flexible split modes at checkout' },
        { id: 'dashboard' as const, label: 'Dashboard', caption: 'Revenue and top sellers' },
      ],
    },
    caseStudy: {
      title: 'Customer story',
      name: 'Restaurante Pirata',
      location: 'Portugal · Chinese buffet',
      quote: `${PRODUCT_NAME} pilot customer using the system for buffet open-table billing and drink orders.`,
      tags: ['Chinese buffet', 'Per-guest billing', 'Trilingual menu'],
    },
    contact: {
      title: 'Get in touch',
      subtitle: 'Pricing and setup are tailored to your restaurant. Onboarding is handled personally — no self-signup.',
      pricingNote: 'Contact us for a tailored quote',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Scan or search WeChat ID',
      wechatCopy: 'Copy WeChat ID',
      wechatCopied: 'Copied',
      stepsTitle: 'How onboarding works',
      steps: [
        { title: 'Reach out', desc: 'Tell us about your restaurant on WhatsApp or WeChat' },
        { title: 'Plan', desc: 'We recommend setup and pricing for your needs' },
        { title: 'Provision', desc: 'We configure accounts, menu, and printing' },
        { title: 'Go live', desc: 'Training and support until you are running smoothly' },
      ],
    },
    footer: {
      login: 'Already have an account? Sign in',
      copyright: 'Operations platform for Chinese buffet restaurants in Portugal',
    },
  },
  pt: {
    nav: {
      solutions: 'Solucoes',
      preview: 'Interface',
      caseStudy: 'Clientes',
      contact: 'Contacto',
      login: 'Entrar',
    },
    hero: {
      tag: 'Buffet chines em Portugal · Operacao profissional',
      titleA: 'Cobranca por pessoa mais precisa',
      titleB: 'Operacao mais tranquila',
      desc: 'Equipa confirma pessoas na abertura de mesa, clientes pedem bebidas por QR, pedidos vao ao balcao e conta dividida com inteligencia — feito para buffet.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      previewHint: 'Veja as interfaces abaixo',
    },
    pain: {
      title: 'Desafios do dia a dia',
      items: [
        {
          title: 'Contagem em hora de ponta',
          problem: 'Precos adulto/crianca e dias especiais complicam a contagem manual.',
          solution: 'Confirmacao na abertura de mesa com regras automaticas.',
        },
        {
          title: 'Pedidos antes da mesa aberta',
          problem: 'Bebidas antes da confirmacao misturam receitas e geram disputas.',
          solution: 'Pedidos so apos abertura; base buffet e bebidas separados.',
        },
        {
          title: 'Clientes multilingues',
          problem: 'Donos, equipa e clientes precisam de varios idiomas.',
          solution: 'Menu em portugues, ingles e chines num toque.',
        },
      ],
    },
    buffet: {
      title: 'Feito para buffet',
      subtitle: 'Da abertura de mesa ao pagamento.',
      items: [
        {
          title: 'Preco por pessoa',
          desc: 'Adulto e crianca com regras para dias da semana e feriados.',
        },
        {
          title: 'Controlo de abertura',
          desc: 'Equipa confirma pessoas antes de permitir pedidos de bebidas.',
        },
        {
          title: 'Bebidas e balcao',
          desc: 'Pedidos de bebidas em tempo real no balcao; relatorios claros.',
        },
        {
          title: 'Conta e divisao',
          desc: 'Divisao igual, por prato ou personalizada — inclui base buffet.',
        },
      ],
    },
    support: {
      title: 'Suporte completo',
      items: [
        { title: 'Menu trilingue', desc: 'Portugues, ingles e chines.' },
        { title: 'Dados do negocio', desc: 'Faturamento e bebidas mais vendidas.' },
        { title: 'Impressao no balcao', desc: 'Taloes de bebidas e recibos por estacao.' },
      ],
    },
    preview: {
      title: 'Interfaces do produto',
      subtitle: `UI real ${PRODUCT_NAME} com dados de demonstracao.`,
      remoteDemo: 'Quer ver ao vivo? Marque demo remota por WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Abertura', caption: 'Confirmar adultos e criancas' },
        { id: 'menu' as const, label: 'Bebidas', caption: 'Menu de bebidas e frutos — pedidos ao balcao' },
        { id: 'bar' as const, label: 'Balcao', caption: 'Pedidos de bebidas no balcao com estado claro' },
        { id: 'bill' as const, label: 'Divisao', caption: 'Modos de divisao na conta' },
        { id: 'dashboard' as const, label: 'Painel', caption: 'Faturamento e top pratos' },
      ],
    },
    caseStudy: {
      title: 'Cliente',
      name: 'Restaurante Pirata',
      location: 'Portugal · Buffet chines',
      quote: `Cliente piloto ${PRODUCT_NAME} para abertura buffet e pedidos de bebidas.`,
      tags: ['Buffet chines', 'Por pessoa', 'Menu trilingue'],
    },
    contact: {
      title: 'Contacte-nos',
      subtitle: 'Preco e configuracao sob medida. Ativacao feita pela nossa equipa — sem registo publico.',
      pricingNote: 'Contacte para proposta personalizada',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Digitalize ou pesquise o ID WeChat',
      wechatCopy: 'Copiar ID WeChat',
      wechatCopied: 'Copiado',
      stepsTitle: 'Como comecar',
      steps: [
        { title: 'Contacto', desc: 'Fale connosco por WhatsApp ou WeChat' },
        { title: 'Plano', desc: 'Proposta conforme o seu restaurante' },
        { title: 'Configuracao', desc: 'Contas, menu e impressao' },
        { title: 'Arranque', desc: 'Formacao ate estar operacional' },
      ],
    },
    footer: {
      login: 'Ja tem conta? Entrar',
      copyright: 'Plataforma para buffet chines em Portugal',
    },
  },
  es: {
    nav: {
      solutions: 'Soluciones',
      preview: 'Interfaz',
      caseStudy: 'Clientes',
      contact: 'Contacto',
      login: 'Iniciar sesión',
    },
    hero: {
      tag: 'Buffet chino en Portugal · Operaciones profesionales',
      titleA: 'Facturación por persona más precisa',
      titleB: 'Operaciones de restaurante más tranquilas',
      desc: 'El personal confirma el número de personas al abrir mesa, los clientes piden bebidas por QR, los pedidos van directo al bar, y el pago admite división inteligente — creado para restaurantes buffet.',
      whatsappCta: 'Chat por WhatsApp',
      wechatCta: 'WeChat',
      previewHint: 'Ver pantallas del producto abajo',
    },
    pain: {
      title: 'Desafíos diarios que enfrentan los propietarios de buffet',
      items: [
        {
          title: 'Conteo en horas pico',
          problem: 'Los precios de adulto y niño difieren según el día; los recuentos manuales son propensos a errores.',
          solution: 'El personal confirma huéspedes al abrir mesa; las reglas de precios se aplican automáticamente.',
        },
        {
          title: 'Pedidos antes de abrir mesa',
          problem: 'Los pedidos de bebidas realizados antes de confirmar el número de personas mezclan los ingresos del buffet y del bar.',
          solution: 'Los pedidos se desbloquean después de abrir mesa; la base del buffet y los pedidos de bebidas permanecen separados.',
        },
        {
          title: 'Huéspedes multilingües',
          problem: 'Propietarios, personal y huéspedes a menudo necesitan más de un idioma.',
          solution: 'Menús en portugués, inglés y chino con un toque.',
        },
      ],
    },
    buffet: {
      title: 'Creado para restaurantes buffet',
      subtitle: 'Cobertura de extremo a extremo desde abrir mesa hasta el pago.',
      items: [
        {
          title: 'Precios inteligentes por huésped',
          desc: 'Tarifas de adulto y niño con reglas de días laborables, fines de semana y días festivos.',
        },
        {
          title: 'Control de apertura de mesa',
          desc: 'El personal verifica el número de personas antes de que los huéspedes puedan pedir bebidas.',
        },
        {
          title: 'Bebidas y bar',
          desc: 'Los pedidos de bebidas llegan a la pantalla del bar en tiempo real; los informes permanecen claros.',
        },
        {
          title: 'Pago y división',
          desc: 'División equitativa, por artículo o personalizada — base del buffet incluida.',
        },
      ],
    },
    support: {
      title: 'Todo lo demás que necesitas',
      items: [
        { title: 'Menú trilingüe', desc: 'Portugués, inglés y chino para huéspedes diversos.' },
        { title: 'Insights de negocio', desc: 'Ingresos de hoy y bebidas más vendidas de un vistazo.' },
        { title: 'Impresión de bar', desc: 'Tickets de bar y recibos por estación.' },
      ],
    },
    preview: {
      title: 'Pantallas del producto',
      subtitle: `Interfaz real de ${PRODUCT_NAME} con datos de demostración.`,
      remoteDemo: '¿Quieres una demostración en vivo? Reserva una demo remota por WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Abrir mesa', caption: 'El personal confirma conteo de adultos / niños' },
        { id: 'menu' as const, label: 'Bebidas', caption: 'Menú de bebidas y vino de frutas — pedidos al bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Pedidos de bebidas enrutados al bar con estado claro' },
        { id: 'bill' as const, label: 'División de cuenta', caption: 'Modos flexibles de división al pagar' },
        { id: 'dashboard' as const, label: 'Panel', caption: 'Ingresos y más vendidos' },
      ],
    },
    caseStudy: {
      title: 'Historia de cliente',
      name: 'Restaurante Pirata',
      location: 'Portugal · Buffet chino',
      quote: `Cliente piloto de ${PRODUCT_NAME} usando el sistema para facturación de apertura de buffet y pedidos de bebidas.`,
      tags: ['Buffet chino', 'Facturación por huésped', 'Menú trilingüe'],
    },
    contact: {
      title: 'Ponte en contacto',
      subtitle: 'Los precios y la configuración están adaptados a tu restaurante. La incorporación se maneja personalmente — sin auto-registro.',
      pricingNote: 'Contáctanos para un presupuesto personalizado',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Escanea o busca ID de WeChat',
      wechatCopy: 'Copiar ID de WeChat',
      wechatCopied: 'Copiado',
      stepsTitle: 'Cómo funciona la incorporación',
      steps: [
        { title: 'Contacta', desc: 'Cuéntanos sobre tu restaurante por WhatsApp o WeChat' },
        { title: 'Planifica', desc: 'Recomendamos configuración y precios para tus necesidades' },
        { title: 'Provisiona', desc: 'Configuramos cuentas, menú e impresión' },
        { title: 'En vivo', desc: 'Capacitación y soporte hasta que funciones sin problemas' },
      ],
    },
    footer: {
      login: '¿Ya tienes una cuenta? Iniciar sesión',
      copyright: 'Plataforma de operaciones para restaurantes buffet chinos en Portugal',
    },
  },
  fr: {
    nav: {
      solutions: 'Solutions',
      preview: 'Interface',
      caseStudy: 'Clients',
      contact: 'Contact',
      login: 'Se connecter',
    },
    hero: {
      tag: 'Buffet chinois au Portugal · Opérations professionnelles',
      titleA: 'Facturation par personne plus précise',
      titleB: 'Opérations de restaurant plus calmes',
      desc: 'Le personnel confirme le nombre de convives à l\'ouverture de table, les clients commandent des boissons par QR, les commandes vont directement au bar, et le paiement prend en charge la division intelligente — conçu pour les restaurants buffet.',
      whatsappCta: 'Chat sur WhatsApp',
      wechatCta: 'WeChat',
      previewHint: 'Voir les écrans du produit ci-dessous',
    },
    pain: {
      title: 'Défis quotidiens des propriétaires de buffet',
      items: [
        {
          title: 'Décompte aux heures de pointe',
          problem: 'Les tarifs adulte et enfant diffèrent selon le jour ; les décomptes manuels sont sujets aux erreurs.',
          solution: 'Le personnel confirme les invités à l\'ouverture de table ; les règles de tarification s\'appliquent automatiquement.',
        },
        {
          title: 'Commandes avant ouverture de table',
          problem: 'Les commandes de boissons passées avant confirmation du nombre de personnes mélangent les revenus buffet et bar.',
          solution: 'Les commandes se débloquent après ouverture de table ; la base buffet et les commandes de boissons restent séparées.',
        },
        {
          title: 'Invités multilingues',
          problem: 'Propriétaires, personnel et invités ont souvent besoin de plus d\'une langue.',
          solution: 'Menus en portugais, anglais et chinois d\'un simple toucher.',
        },
      ],
    },
    buffet: {
      title: 'Conçu pour les restaurants buffet',
      subtitle: 'Couverture de bout en bout de l\'ouverture de table au paiement.',
      items: [
        {
          title: 'Tarification intelligente par invité',
          desc: 'Tarifs adulte et enfant avec règles de jours de semaine, week-end et jours fériés.',
        },
        {
          title: 'Contrôle d\'ouverture de table',
          desc: 'Le personnel vérifie le nombre de personnes avant que les invités puissent commander des boissons.',
        },
        {
          title: 'Boissons et bar',
          desc: 'Les commandes de boissons arrivent sur l\'écran du bar en temps réel ; les rapports restent clairs.',
        },
        {
          title: 'Paiement et division',
          desc: 'Division équitable, par article ou personnalisée — base buffet incluse.',
        },
      ],
    },
    support: {
      title: 'Tout le reste dont vous avez besoin',
      items: [
        { title: 'Menu trilingue', desc: 'Portugais, anglais et chinois pour des invités diversifiés.' },
        { title: 'Insights métier', desc: 'Revenus du jour et boissons populaires en un coup d\'œil.' },
        { title: 'Impression bar', desc: 'Tickets de bar et reçus par station.' },
      ],
    },
    preview: {
      title: 'Écrans du produit',
      subtitle: `Interface réelle ${PRODUCT_NAME} avec données de démonstration.`,
      remoteDemo: 'Vous voulez une présentation en direct ? Réservez une démo à distance via WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Ouvrir table', caption: 'Le personnel confirme le décompte adultes / enfants' },
        { id: 'menu' as const, label: 'Boissons', caption: 'Menu boissons et vin de fruits — commandes au bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Commandes de boissons acheminées au bar avec statut clair' },
        { id: 'bill' as const, label: 'Division note', caption: 'Modes de division flexibles au paiement' },
        { id: 'dashboard' as const, label: 'Tableau de bord', caption: 'Revenus et meilleures ventes' },
      ],
    },
    caseStudy: {
      title: 'Histoire client',
      name: 'Restaurante Pirata',
      location: 'Portugal · Buffet chinois',
      quote: `Client pilote ${PRODUCT_NAME} utilisant le système pour la facturation d\'ouverture de buffet et les commandes de boissons.`,
      tags: ['Buffet chinois', 'Facturation par invité', 'Menu trilingue'],
    },
    contact: {
      title: 'Entrer en contact',
      subtitle: 'Les prix et la configuration sont adaptés à votre restaurant. L\'intégration est gérée personnellement — pas d\'auto-inscription.',
      pricingNote: 'Contactez-nous pour un devis personnalisé',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'Scannez ou recherchez l\'ID WeChat',
      wechatCopy: 'Copier l\'ID WeChat',
      wechatCopied: 'Copié',
      stepsTitle: 'Comment fonctionne l\'intégration',
      steps: [
        { title: 'Contactez', desc: 'Parlez-nous de votre restaurant sur WhatsApp ou WeChat' },
        { title: 'Planifiez', desc: 'Nous recommandons configuration et tarifs pour vos besoins' },
        { title: 'Provisionnez', desc: 'Nous configurons comptes, menu et impression' },
        { title: 'En direct', desc: 'Formation et support jusqu\'à ce que vous fonctionniez sans problème' },
      ],
    },
    footer: {
      login: 'Vous avez déjà un compte ? Se connecter',
      copyright: 'Plateforme d\'opérations pour restaurants buffet chinois au Portugal',
    },
  },
  de: {
    nav: {
      solutions: 'Lösungen',
      preview: 'Benutzeroberfläche',
      caseStudy: 'Kunden',
      contact: 'Kontakt',
      login: 'Anmelden',
    },
    hero: {
      tag: 'Chinesisches Buffet in Portugal · Professionelle Abläufe',
      titleA: 'Genauere Abrechnung pro Person',
      titleB: 'Ruhigere Restaurantabläufe',
      desc: 'Personal bestätigt Personenzahl beim Tisch öffnen, Gäste bestellen Getränke per QR, Bestellungen gehen direkt an die Bar, und Zahlung unterstützt intelligente Rechnungsaufteilung — für Buffet-Restaurants entwickelt.',
      whatsappCta: 'Chat über WhatsApp',
      wechatCta: 'WeChat',
      previewHint: 'Produktbildschirme unten ansehen',
    },
    pain: {
      title: 'Tägliche Herausforderungen für Buffet-Besitzer',
      items: [
        {
          title: 'Zählung zu Stoßzeiten',
          problem: 'Erwachsenen- und Kinderpreise unterscheiden sich je nach Tag; manuelle Zählungen sind fehleranfällig.',
          solution: 'Personal bestätigt Gäste beim Tisch öffnen; Preisregeln werden automatisch angewendet.',
        },
        {
          title: 'Bestellungen vor Tisch öffnen',
          problem: 'Getränkebestellungen vor Personenzahl-Bestätigung vermischen Buffet- und Bar-Umsätze.',
          solution: 'Bestellungen werden nach Tisch öffnen freigeschaltet; Buffet-Basis und Getränkebestellungen bleiben getrennt.',
        },
        {
          title: 'Mehrsprachige Gäste',
          problem: 'Besitzer, Personal und Gäste benötigen oft mehr als eine Sprache.',
          solution: 'Menüs auf Portugiesisch, Englisch und Chinesisch mit einem Tippen.',
        },
      ],
    },
    buffet: {
      title: 'Für Buffet-Restaurants entwickelt',
      subtitle: 'Ende-zu-Ende-Abdeckung vom Tisch öffnen bis zur Zahlung.',
      items: [
        {
          title: 'Intelligente Pro-Gast-Preisgestaltung',
          desc: 'Erwachsenen- und Kindertarife mit Wochentags-, Wochenend- und Feiertagsregeln.',
        },
        {
          title: 'Tisch-Öffnungs-Kontrolle',
          desc: 'Personal überprüft Personenzahl bevor Gäste Getränke bestellen können.',
        },
        {
          title: 'Getränke und Bar',
          desc: 'Getränkebestellungen erreichen das Bar-Display in Echtzeit; Berichte bleiben klar.',
        },
        {
          title: 'Zahlung und Aufteilung',
          desc: 'Gleichmäßige, artikelweise oder benutzerdefinierte Aufteilungen — Buffet-Basis inbegriffen.',
        },
      ],
    },
    support: {
      title: 'Alles andere was Sie brauchen',
      items: [
        { title: 'Dreisprachiges Menü', desc: 'Portugiesisch, Englisch und Chinesisch für vielfältige Gäste.' },
        { title: 'Geschäftseinsichten', desc: 'Heutige Umsätze und Top-Getränke auf einen Blick.' },
        { title: 'Bar-Druck', desc: 'Bar-Tickets und Belege nach Station.' },
      ],
    },
    preview: {
      title: 'Produktbildschirme',
      subtitle: `Echte ${PRODUCT_NAME} Benutzeroberfläche mit Demo-Daten.`,
      remoteDemo: 'Möchten Sie eine Live-Präsentation? Buchen Sie eine Remote-Demo über WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Tisch öffnen', caption: 'Personal bestätigt Erwachsenen- / Kinderzahl' },
        { id: 'menu' as const, label: 'Getränke', caption: 'Getränke- und Fruchtwein-Menü — Bestellungen an die Bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Getränkebestellungen an die Bar mit klarem Status geleitet' },
        { id: 'bill' as const, label: 'Rechnung teilen', caption: 'Flexible Aufteilungsmodi beim Bezahlen' },
        { id: 'dashboard' as const, label: 'Dashboard', caption: 'Umsätze und Bestseller' },
      ],
    },
    caseStudy: {
      title: 'Kundengeschichte',
      name: 'Restaurante Pirata',
      location: 'Portugal · Chinesisches Buffet',
      quote: `${PRODUCT_NAME} Pilotkunde, der das System für Buffet-Tisch-Öffnungs-Abrechnung und Getränkebestellungen verwendet.`,
      tags: ['Chinesisches Buffet', 'Pro-Gast-Abrechnung', 'Dreisprachiges Menü'],
    },
    contact: {
      title: 'Kontakt aufnehmen',
      subtitle: 'Preise und Einrichtung sind auf Ihr Restaurant zugeschnitten. Das Onboarding wird persönlich durchgeführt — keine Selbstregistrierung.',
      pricingNote: 'Kontaktieren Sie uns für ein maßgeschneidertes Angebot',
      whatsappLabel: 'WhatsApp',
      wechatLabel: 'WeChat',
      wechatScanHint: 'QR scannen oder WeChat-ID suchen',
      wechatCopy: 'WeChat-ID kopieren',
      wechatCopied: 'Kopiert',
      stepsTitle: 'Wie das Onboarding funktioniert',
      steps: [
        { title: 'Kontaktaufnahme', desc: 'Erzählen Sie uns über Ihr Restaurant über WhatsApp oder WeChat' },
        { title: 'Planen', desc: 'Wir empfehlen Einrichtung und Preise für Ihre Bedürfnisse' },
        { title: 'Bereitstellung', desc: 'Wir konfigurieren Konten, Menü und Druck' },
        { title: 'Live gehen', desc: 'Schulung und Support bis Sie reibungslos laufen' },
      ],
    },
    footer: {
      login: 'Haben Sie bereits ein Konto? Anmelden',
      copyright: 'Betriebsplattform für chinesische Buffet-Restaurants in Portugal',
    },
  },
};

export function getLandingCopy(lang: LandingLanguage): LandingCopy {
  return LANDING_COPY[lang];
}
