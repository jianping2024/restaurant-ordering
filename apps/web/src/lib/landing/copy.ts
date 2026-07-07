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
      desc: '服务员开台确认人数，顾客扫码加餐，厨房实时协同，前台智能分单 — 专为自助餐厅打造。',
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
          problem: '顾客提前扫码加餐，与自助餐人头费混在一起，对账和纠纷成本高。',
          solution: '开台后方可加餐，人头费与加菜品分开统计，账目清晰可追溯。',
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
          title: '加餐与厨房协同',
          desc: '加餐订单实时推送厨房大屏，人头费与加菜品分开统计，高峰不丢单。',
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
          desc: '今日营业额、热销菜品实时掌握，辅助经营决策。',
        },
        {
          title: '打印与厨打',
          desc: '厨房单、结账单按站点自动打印，减少沟通成本。',
        },
      ],
    },
    preview: {
      title: '产品界面预览',
      subtitle: '以下为 MesaGo 实际系统界面（演示数据）。',
      remoteDemo: '想亲自操作？通过 WhatsApp 预约远程演示',
      screens: [
        { id: 'waiter-open' as const, label: '开台', caption: '服务员确认成人 / 儿童人数' },
        { id: 'menu' as const, label: '加餐', caption: '顾客扫码浏览菜单并下单' },
        { id: 'kitchen' as const, label: '厨房', caption: '订单实时显示，状态一目了然' },
        { id: 'bill' as const, label: '分单', caption: '多种分单模式，结账更轻松' },
        { id: 'dashboard' as const, label: '看板', caption: '营业额与热销菜品实时统计' },
      ],
    },
    caseStudy: {
      title: '客户案例',
      name: 'Restaurante Pirata',
      location: '葡萄牙 · 中餐自助',
      quote: 'MesaGo 试点客户，使用系统管理自助餐开台计费与加餐流程。',
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
      desc: 'Staff confirm headcount at open table, guests order add-ons by QR, kitchen stays in sync, and checkout supports smart bill split — built for buffet restaurants.',
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
          problem: 'Add-ons placed before headcount is confirmed blur buffet vs. menu revenue.',
          solution: 'Ordering unlocks after open table; buffet base and add-ons stay separate.',
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
          desc: 'Staff verify headcount before guests can order add-ons.',
        },
        {
          title: 'Add-ons & kitchen',
          desc: 'Add-on tickets hit the kitchen display in real time; reporting stays clear.',
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
        { title: 'Business insights', desc: 'Today’s revenue and top dishes at a glance.' },
        { title: 'Print routing', desc: 'Kitchen and receipt printing by station.' },
      ],
    },
    preview: {
      title: 'Product screens',
      subtitle: 'Actual MesaGo UI with demo data.',
      remoteDemo: 'Want a live walkthrough? Book a remote demo via WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Open table', caption: 'Staff confirm adult / child count' },
        { id: 'menu' as const, label: 'Add-ons', caption: 'Guests browse and order by QR' },
        { id: 'kitchen' as const, label: 'Kitchen', caption: 'Live tickets and dish status' },
        { id: 'bill' as const, label: 'Split bill', caption: 'Flexible split modes at checkout' },
        { id: 'dashboard' as const, label: 'Dashboard', caption: 'Revenue and top sellers' },
      ],
    },
    caseStudy: {
      title: 'Customer story',
      name: 'Restaurante Pirata',
      location: 'Portugal · Chinese buffet',
      quote: 'MesaGo pilot customer using the system for buffet open-table billing and add-on orders.',
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
      desc: 'Equipa confirma pessoas na abertura de mesa, clientes pedem extras por QR, cozinha em sincronia e conta dividida com inteligencia — feito para buffet.',
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
          problem: 'Extras antes da confirmacao misturam receitas e geram disputas.',
          solution: 'Pedidos so apos abertura; base buffet e extras separados.',
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
          desc: 'Equipa confirma pessoas antes de permitir extras.',
        },
        {
          title: 'Extras e cozinha',
          desc: 'Pedidos extras em tempo real na cozinha; relatorios claros.',
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
        { title: 'Dados do negocio', desc: 'Faturamento e pratos mais vendidos.' },
        { title: 'Impressao', desc: 'Cozinha e recibos por estacao.' },
      ],
    },
    preview: {
      title: 'Interfaces do produto',
      subtitle: 'UI real MesaGo com dados de demonstracao.',
      remoteDemo: 'Quer ver ao vivo? Marque demo remota por WhatsApp',
      screens: [
        { id: 'waiter-open' as const, label: 'Abertura', caption: 'Confirmar adultos e criancas' },
        { id: 'menu' as const, label: 'Extras', caption: 'Clientes pedem por QR' },
        { id: 'kitchen' as const, label: 'Cozinha', caption: 'Pedidos e estados em tempo real' },
        { id: 'bill' as const, label: 'Divisao', caption: 'Modos de divisao na conta' },
        { id: 'dashboard' as const, label: 'Painel', caption: 'Faturamento e top pratos' },
      ],
    },
    caseStudy: {
      title: 'Cliente',
      name: 'Restaurante Pirata',
      location: 'Portugal · Buffet chines',
      quote: 'Cliente piloto MesaGo para abertura buffet e pedidos extras.',
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
};

export function getLandingCopy(lang: LandingLanguage): LandingCopy {
  return LANDING_COPY[lang];
}
