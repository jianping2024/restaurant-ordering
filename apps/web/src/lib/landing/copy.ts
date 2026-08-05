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
      tag: '葡萄牙大型中餐自助 · 本地运营系统',
      titleA: '少投入 · 不断网',
      titleB: '流程可追溯',
      desc: '不必每桌平板；系统装在店里，外网断了也能营业。权限清晰、价目自动切换、订单历史可查 — 专为大型自助打造。',
      whatsappCta: 'WhatsApp 咨询',
      wechatCta: '微信咨询',
      agentCta: '诚招代理',
      previewHint: '向下查看产品界面',
    },
    pillars: {
      title: '经济 · 安全 · 稳定 · 便捷',
      items: [
        {
          id: 'economy',
          title: '经济',
          body: '百桌不必四万欧平板墙，顾客手机扫码即可。',
        },
        {
          id: 'security',
          title: '安全',
          body: '角色权限清晰，开台到结账全程可追溯。',
        },
        {
          id: 'stability',
          title: '稳定',
          body: '本地部署，外网中断仍可下单、结账、出票。',
        },
        {
          id: 'convenience',
          title: '便捷',
          body: '顾客自用网络；手机电脑协同；价目到点自动切换。',
        },
      ],
    },
    pain: {
      title: '大型自助常遇到的问题',
      items: [
        {
          title: '平板墙成本高',
          problem: '每桌一台专用平板，采购、充电、损坏与更换持续烧钱。',
          solution: '顾客扫码点单，无需每桌专用平板，大幅降低设备投入。',
        },
        {
          title: '依赖外网怕停业',
          problem: '纯云端系统一旦断网，下单结账一起停。',
          solution: '系统装在店里，外网挂了店照常营业。',
        },
        {
          title: '权限与追溯不清',
          problem: '谁开台、谁改单、谁结账说不清，纠纷难查。',
          solution: '按角色授权，订单历史完整留痕，责任清楚。',
        },
      ],
    },
    buffet: {
      title: '为大型自助而生',
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
          title: '订单历史可追溯',
          desc: '开台、点单、转台、结账随时可查，责任清楚。',
        },
        {
          title: '开台与人头计费',
          desc: '确认人数后开台，成人儿童与日类型规则自动计价；未开台不可点单。',
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
    preview: {
      title: '产品界面预览',
      subtitle: `${PRODUCT_NAME} 实际系统界面（演示数据）。`,
      remoteDemo: '想亲自操作？通过 WhatsApp 预约远程演示',
      screens: [
        { id: 'waiter-open' as const, label: '开台', caption: '服务员确认成人 / 儿童人数' },
        { id: 'menu' as const, label: '点酒水', caption: '饮料与水果酒分类菜单，订单直达吧台' },
        { id: 'bar' as const, label: '吧台', caption: '酒水订单直达吧台，出单状态清晰' },
        { id: 'bill' as const, label: '分单', caption: '多种分单模式，结账更轻松' },
        { id: 'dashboard' as const, label: '看板', caption: '营业额与热销统计' },
      ],
    },
    caseStudy: {
      title: '客户案例',
      name: '葡萄牙大型中餐自助',
      location: '已落地 · 稳定使用中',
      quote: `${PRODUCT_NAME} 帮助大型自助少投入上线：本地运行、权限清晰、价目自动执行。`,
      tags: [
        '本地部署',
        '大型自助',
        '已落地',
      ],
    },
    contact: {
      title: '了解方案 · 预约演示',
      subtitle: '价格与配置请直接联系我们。正式开通由专人一对一配置，无需自助注册。',
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
        subtitle: '区域合作 · 本地部署支持',
        note: '与预约演示使用同一套 WhatsApp / 微信联系方式。',
      },
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
      tag: 'Large Chinese buffet in Portugal · On-prem operations',
      titleA: 'Lower spend · Offline-ready',
      titleB: 'Full audit trail',
      desc: 'No tablet per table. Run in-store so service continues when the WAN drops. Clear roles, auto price rules, and order history — built for large buffets.',
      whatsappCta: 'Chat on WhatsApp',
      wechatCta: 'WeChat',
      agentCta: 'Become a partner',
      previewHint: 'See product screens below',
    },
    pillars: {
      title: 'Economy · Security · Stability · Convenience',
      items: [
        {
          id: 'economy',
          title: 'Economy',
          body: 'Skip a €40k tablet wall — guests order on their phones.',
        },
        {
          id: 'security',
          title: 'Security',
          body: 'Role-based access with a clear trail from open to pay.',
        },
        {
          id: 'stability',
          title: 'Stability',
          body: 'On-prem install — order, pay, and print when the internet fails.',
        },
        {
          id: 'convenience',
          title: 'Convenience',
          body: 'Guest mobile data; phone + desktop ops; prices switch on schedule.',
        },
      ],
    },
    pain: {
      title: 'What large buffet owners struggle with',
      items: [
        {
          title: 'Tablet fleet cost',
          problem: 'One device per table means purchase, charging, breakage, and replacement forever.',
          solution: 'QR ordering on guest phones — no dedicated tablet per seat.',
        },
        {
          title: 'Cloud outages stop service',
          problem: 'Cloud-only stacks freeze ordering and checkout when the WAN drops.',
          solution: 'Local install keeps the floor running offline.',
        },
        {
          title: 'Unclear accountability',
          problem: 'Hard to see who opened, changed, or closed a table.',
          solution: 'Permissions by role and complete order history.',
        },
      ],
    },
    buffet: {
      title: 'Built for large buffets',
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
          title: 'Order history',
          desc: 'Open, order, transfer, and pay — always reviewable.',
        },
        {
          title: 'Open table & per-guest billing',
          desc: 'Confirm headcount before guests order; adult/child rules apply automatically.',
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
    preview: {
      title: 'Product screens',
      subtitle: `Actual ${PRODUCT_NAME} UI with demo data.`,
      remoteDemo: 'Want a live walkthrough? Book a remote demo via WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Open table', caption: 'Staff confirm adult / child count' },
        { id: 'menu' as const, label: 'Drinks', caption: 'Beverages and fruit wine — orders to the bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Drink orders with clear status' },
        { id: 'bill' as const, label: 'Split bill', caption: 'Flexible split modes at checkout' },
        { id: 'dashboard' as const, label: 'Dashboard', caption: 'Revenue and top sellers' },
      ],
    },
    caseStudy: {
      title: 'Customer story',
      name: 'Large Chinese buffet (Portugal)',
      location: 'Live · in stable use',
      quote: `${PRODUCT_NAME} helps large buffets go live with lower hardware spend, on-prem stability, and clear operations.`,
      tags: [
        'On-prem',
        'Large buffet',
        'Live',
      ],
    },
    contact: {
      title: 'Book a demo',
      subtitle: 'Pricing and setup are tailored. Onboarding is personal — no self-signup.',
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
        subtitle: 'Regional partnership · on-prem support',
        note: 'Same WhatsApp / WeChat channels as demo requests.',
      },
    },
    footer: {
      login: 'Already have an account? Sign in',
      copyright: 'Operations platform for Chinese buffet restaurants in Portugal',
    },
  },
  pt: {
    nav: {
      solutions: 'Soluções',
      preview: 'Interface',
      caseStudy: 'Clientes',
      contact: 'Contacto',
      login: 'Entrar',
    },
    hero: {
      tag: 'Grande buffet chinês em Portugal · Operação local',
      titleA: 'Menos investimento · Sem depender da net',
      titleB: 'Rasto completo',
      desc: 'Sem tablet por mesa. Sistema na loja: com a WAN em baixo a operação continua. Papéis claros, preços automáticos e histórico — feito para buffet de grande escala.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      agentCta: 'Torne-se parceiro',
      previewHint: 'Veja as interfaces abaixo',
    },
    pillars: {
      title: 'Economia · Segurança · Estabilidade · Conveniência',
      items: [
        {
          id: 'economy',
          title: 'Economia',
          body: 'Evite uma parede de tablets a ~€40k — o cliente pede no telemóvel.',
        },
        {
          id: 'security',
          title: 'Segurança',
          body: 'Permissões por papel e rasto claro da abertura ao pagamento.',
        },
        {
          id: 'stability',
          title: 'Estabilidade',
          body: 'Instalação local — pedir, pagar e imprimir sem internet.',
        },
        {
          id: 'convenience',
          title: 'Conveniência',
          body: 'Dados móveis do cliente; telemóvel e PC; preços mudam sozinhos.',
        },
      ],
    },
    pain: {
      title: 'Desafios de buffets grandes',
      items: [
        {
          title: 'Custo da frota de tablets',
          problem: 'Um dispositivo por mesa: compra, carga, avarias e substituição.',
          solution: 'Pedidos por QR no telemóvel do cliente — sem tablet por lugar.',
        },
        {
          title: 'Queda de rede para o serviço',
          problem: 'Só na cloud, a WAN cai e o pedido/pagamento param.',
          solution: 'Instalação local mantém a sala a funcionar.',
        },
        {
          title: 'Responsabilidade pouco clara',
          problem: 'Difícil saber quem abriu, alterou ou fechou a mesa.',
          solution: 'Papéis com permissão e histórico completo.',
        },
      ],
    },
    buffet: {
      title: 'Feito para buffet de grande escala',
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
          title: 'Histórico de pedidos',
          desc: 'Abertura, pedido, transferência e pagamento — sempre consultável.',
        },
        {
          title: 'Abertura e preço por pessoa',
          desc: 'Confirme pessoas antes de pedir; regras adulto/criança automáticas.',
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
    preview: {
      title: 'Interfaces do produto',
      subtitle: `UI real ${PRODUCT_NAME} com dados de demonstração.`,
      remoteDemo: 'Quer ver ao vivo? Marque demo remota por WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Abertura', caption: 'Confirmar adultos e crianças' },
        { id: 'menu' as const, label: 'Bebidas', caption: 'Menu de bebidas — pedidos ao balcão' },
        { id: 'bar' as const, label: 'Balcão', caption: 'Pedidos com estado claro' },
        { id: 'bill' as const, label: 'Divisão', caption: 'Modos de divisão na conta' },
        { id: 'dashboard' as const, label: 'Painel', caption: 'Faturação e tops' },
      ],
    },
    caseStudy: {
      title: 'Cliente',
      name: 'Buffet chinês de grande porte',
      location: 'Em uso estável',
      quote: `${PRODUCT_NAME} ajuda buffets grandes a entrar em produção com menos hardware, estabilidade local e operação clara.`,
      tags: [
        'Local',
        'Buffet grande',
        'Em uso',
      ],
    },
    contact: {
      title: 'Marcar demonstração',
      subtitle: 'Preço e configuração à medida. Onboarding pessoal — sem auto-registo.',
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
        subtitle: 'Parceria regional · suporte a instalação local',
        note: 'Os mesmos canais WhatsApp / WeChat da demonstração.',
      },
    },
    footer: {
      login: 'Já tem conta? Entrar',
      copyright: 'Plataforma para buffet chinês em Portugal',
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
      tag: 'Gran buffet chino en Portugal · Operación local',
      titleA: 'Menos gasto · Sin depender de la red',
      titleB: 'Rastro completo',
      desc: 'Sin tablet por mesa. Sistema en el local: si cae la WAN, el servicio sigue. Roles claros, precios automáticos e historial — para buffets grandes.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      agentCta: 'Sé partner',
      previewHint: 'Ver pantallas abajo',
    },
    pillars: {
      title: 'Economía · Seguridad · Estabilidad · Comodidad',
      items: [
        {
          id: 'economy',
          title: 'Economía',
          body: 'Evita un muro de tablets de ~€40k — el cliente pide en el móvil.',
        },
        {
          id: 'security',
          title: 'Seguridad',
          body: 'Permisos por rol y rastro claro de apertura a cobro.',
        },
        {
          id: 'stability',
          title: 'Estabilidad',
          body: 'Instalación local — pedir, cobrar e imprimir sin internet.',
        },
        {
          id: 'convenience',
          title: 'Comodidad',
          body: 'Datos móviles del cliente; móvil y PC; precios que cambian solos.',
        },
      ],
    },
    pain: {
      title: 'Retos de buffets grandes',
      items: [
        {
          title: 'Coste de la flota de tablets',
          problem: 'Un dispositivo por mesa: compra, carga, roturas y reemplazo.',
          solution: 'Pedidos por QR en el móvil del cliente.',
        },
        {
          title: 'Caídas de red paran el servicio',
          problem: 'Solo en la nube, sin WAN se detienen pedidos y cobro.',
          solution: 'Instalación local mantiene la sala operativa.',
        },
        {
          title: 'Responsabilidad poco clara',
          problem: 'Difícil saber quién abrió, cambió o cerró la mesa.',
          solution: 'Roles con permiso e historial completo.',
        },
      ],
    },
    buffet: {
      title: 'Hecho para buffets grandes',
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
          title: 'Historial de pedidos',
          desc: 'Apertura, pedido, traslado y cobro — siempre consultable.',
        },
        {
          title: 'Apertura y precio por persona',
          desc: 'Confirma comensales antes de pedir; reglas adulto/niño automáticas.',
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
    preview: {
      title: 'Pantallas del producto',
      subtitle: `Interfaz real de ${PRODUCT_NAME} con datos de demostración.`,
      remoteDemo: '¿Quieres una demo en vivo? Reserva por WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Abrir mesa', caption: 'Confirmar adultos / niños' },
        { id: 'menu' as const, label: 'Bebidas', caption: 'Menú de bebidas — pedidos al bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Pedidos con estado claro' },
        { id: 'bill' as const, label: 'Dividir cuenta', caption: 'Modos flexibles al cobrar' },
        { id: 'dashboard' as const, label: 'Panel', caption: 'Ingresos y más vendidos' },
      ],
    },
    caseStudy: {
      title: 'Historia de cliente',
      name: 'Gran buffet chino (Portugal)',
      location: 'En uso estable',
      quote: `${PRODUCT_NAME} ayuda a buffets grandes a arrancar con menos hardware, estabilidad local y operación clara.`,
      tags: [
        'Local',
        'Buffet grande',
        'En uso',
      ],
    },
    contact: {
      title: 'Reservar una demo',
      subtitle: 'Precio y configuración a medida. Onboarding personal — sin auto-registro.',
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
        subtitle: 'Colaboración regional · soporte de instalación local',
        note: 'Los mismos canales WhatsApp / WeChat que para la demo.',
      },
    },
    footer: {
      login: '¿Ya tienes cuenta? Iniciar sesión',
      copyright: 'Plataforma para restaurantes buffet chinos en Portugal',
    },
  },
  fr: {
    nav: {
      solutions: 'Solutions',
      preview: 'Interface',
      caseStudy: 'Clients',
      contact: 'Contact',
      login: 'Connexion',
    },
    hero: {
      tag: 'Grand buffet chinois au Portugal · Exploitation locale',
      titleA: 'Moins de dépenses · Hors ligne',
      titleB: 'Traçabilité complète',
      desc: 'Pas de tablette par table. Système en magasin : si le WAN tombe, le service continue. Rôles clairs, prix auto et historique — pour les grands buffets.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      agentCta: 'Devenir partenaire',
      previewHint: 'Voir les écrans ci-dessous',
    },
    pillars: {
      title: 'Économie · Sécurité · Stabilité · Commodité',
      items: [
        {
          id: 'economy',
          title: 'Économie',
          body: 'Évitez un mur de tablettes à ~€40k — le client commande sur son téléphone.',
        },
        {
          id: 'security',
          title: 'Sécurité',
          body: 'Droits par rôle et piste claire de l’ouverture au paiement.',
        },
        {
          id: 'stability',
          title: 'Stabilité',
          body: 'Installation locale — commander, payer et imprimer sans internet.',
        },
        {
          id: 'convenience',
          title: 'Commodité',
          body: 'Données mobiles du client ; téléphone et PC ; prix qui changent seuls.',
        },
      ],
    },
    pain: {
      title: 'Défis des grands buffets',
      items: [
        {
          title: 'Coût de la flotte de tablettes',
          problem: 'Un appareil par table : achat, charge, casse et remplacement.',
          solution: 'Commande QR sur le téléphone du client.',
        },
        {
          title: 'Panne réseau = service arrêté',
          problem: '100 % cloud : sans WAN, commandes et caisse s’arrêtent.',
          solution: 'L’install locale maintient la salle.',
        },
        {
          title: 'Responsabilité floue',
          problem: 'Difficile de savoir qui a ouvert, modifié ou clôturé.',
          solution: 'Rôles + historique complet.',
        },
      ],
    },
    buffet: {
      title: 'Conçu pour les grands buffets',
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
          title: 'Historique des commandes',
          desc: 'Ouverture, commande, transfert et paiement — toujours consultable.',
        },
        {
          title: 'Ouverture et prix par personne',
          desc: 'Confirmez les convives avant commande ; règles adulte/enfant auto.',
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
    preview: {
      title: 'Écrans produit',
      subtitle: `UI réelle ${PRODUCT_NAME} avec données de démo.`,
      remoteDemo: 'Démo en direct ? Réservez via WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Ouverture', caption: 'Confirmer adultes / enfants' },
        { id: 'menu' as const, label: 'Boissons', caption: 'Menu boissons — commandes au bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Commandes avec statut clair' },
        { id: 'bill' as const, label: 'Partage', caption: 'Modes de partage à l’addition' },
        { id: 'dashboard' as const, label: 'Tableau', caption: 'CA et best-sellers' },
      ],
    },
    caseStudy: {
      title: 'Témoignage',
      name: 'Grand buffet chinois (Portugal)',
      location: 'En production stable',
      quote: `${PRODUCT_NAME} aide les grands buffets à démarrer avec moins de matériel, une stabilité locale et une exploitation claire.`,
      tags: [
        'Local',
        'Grand buffet',
        'En production',
      ],
    },
    contact: {
      title: 'Réserver une démo',
      subtitle: 'Tarifs et configuration sur mesure. Onboarding personnel — pas d’auto-inscription.',
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
        subtitle: 'Partenariat régional · support d’installation locale',
        note: 'Mêmes canaux WhatsApp / WeChat que pour la démo.',
      },
    },
    footer: {
      login: 'Déjà un compte ? Connexion',
      copyright: 'Plateforme pour buffets chinois au Portugal',
    },
  },
  de: {
    nav: {
      solutions: 'Lösungen',
      preview: 'Oberfläche',
      caseStudy: 'Kunden',
      contact: 'Kontakt',
      login: 'Anmelden',
    },
    hero: {
      tag: 'Großes China-Buffet in Portugal · Lokaler Betrieb',
      titleA: 'Weniger Kosten · Offline-fähig',
      titleB: 'Volle Nachverfolgung',
      desc: 'Kein Tablet pro Tisch. System vor Ort: Bei WAN-Ausfall läuft der Betrieb weiter. Klare Rollen, Auto-Preise und Historie — für große Buffets.',
      whatsappCta: 'WhatsApp',
      wechatCta: 'WeChat',
      agentCta: 'Partner werden',
      previewHint: 'Produktbildschirme unten',
    },
    pillars: {
      title: 'Wirtschaftlichkeit · Sicherheit · Stabilität · Komfort',
      items: [
        {
          id: 'economy',
          title: 'Wirtschaftlichkeit',
          body: 'Keine €40k-Tablet-Wand — Gäste bestellen am eigenen Handy.',
        },
        {
          id: 'security',
          title: 'Sicherheit',
          body: 'Rollenrechte und klarer Verlauf von Öffnen bis Zahlen.',
        },
        {
          id: 'stability',
          title: 'Stabilität',
          body: 'Lokale Installation — Bestellen, Zahlen, Drucken ohne Internet.',
        },
        {
          id: 'convenience',
          title: 'Komfort',
          body: 'Gast-Mobilfunk; Handy + Desktop; Preise wechseln automatisch.',
        },
      ],
    },
    pain: {
      title: 'Herausforderungen großer Buffets',
      items: [
        {
          title: 'Kosten der Tablet-Flotte',
          problem: 'Ein Gerät pro Tisch: Kauf, Laden, Bruch und Ersatz.',
          solution: 'QR-Bestellung auf dem Gästehandy.',
        },
        {
          title: 'Netzausfall stoppt den Service',
          problem: 'Nur Cloud: ohne WAN stehen Bestellung und Kasse.',
          solution: 'Lokale Installation hält den Saal am Laufen.',
        },
        {
          title: 'Unklare Verantwortung',
          problem: 'Schwer zu sehen, wer öffnete, änderte oder schloss.',
          solution: 'Rollenrechte und vollständige Bestellhistorie.',
        },
      ],
    },
    buffet: {
      title: 'Für große Buffets gebaut',
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
          title: 'Bestellhistorie',
          desc: 'Öffnen, Bestellen, Transfer, Zahlen — jederzeit einsehbar.',
        },
        {
          title: 'Öffnen und Preis pro Gast',
          desc: 'Kopfzahl bestätigen vor Bestellung; Erwachsene/Kinder automatisch.',
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
    preview: {
      title: 'Produktbildschirme',
      subtitle: `Echte ${PRODUCT_NAME}-Oberfläche mit Demo-Daten.`,
      remoteDemo: 'Live-Demo? Per WhatsApp buchen',
      screens: [
        { id: 'waiter-open' as const, label: 'Tisch öffnen', caption: 'Erwachsene / Kinder bestätigen' },
        { id: 'menu' as const, label: 'Getränke', caption: 'Getränkekarte — an die Bar' },
        { id: 'bar' as const, label: 'Bar', caption: 'Bestellungen mit klarem Status' },
        { id: 'bill' as const, label: 'Teilen', caption: 'Flexible Teilungsmodi' },
        { id: 'dashboard' as const, label: 'Dashboard', caption: 'Umsatz und Topseller' },
      ],
    },
    caseStudy: {
      title: 'Kundengeschichte',
      name: 'Großes China-Buffet (Portugal)',
      location: 'Stabil im Einsatz',
      quote: `${PRODUCT_NAME} hilft großen Buffets mit weniger Hardware, lokaler Stabilität und klarer Operation.`,
      tags: [
        'Lokal',
        'Großes Buffet',
        'Live',
      ],
    },
    contact: {
      title: 'Demo buchen',
      subtitle: 'Preis und Setup maßgeschneidert. Persönliches Onboarding — keine Selbstregistrierung.',
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
        subtitle: 'Regionale Partnerschaft · lokaler Installations-Support',
        note: 'Dieselben WhatsApp-/WeChat-Kanäle wie für die Demo.',
      },
    },
    footer: {
      login: 'Bereits ein Konto? Anmelden',
      copyright: 'Betriebsplattform für China-Buffets in Portugal',
    },
  },
};

export function getLandingCopy(lang: LandingLanguage): LandingCopy {
  return LANDING_COPY[lang];
}
