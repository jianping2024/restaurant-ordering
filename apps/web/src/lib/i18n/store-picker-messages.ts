import type { Language } from '@/types';

/** Copy for the store picker page, top-bar switcher and «切换店铺» entry (plan §8.1–8.2). */
export type StorePickerMessages = {
  pageTitle: string;
  /** `{count}` = stores linked to the account. */
  pageSubtitle: string;
  noEnterable: string;
  searchPlaceholder: string;
  favorites: string;
  recent: string;
  /** `{count}` */
  all: string;
  /** `{count}` */
  results: string;
  noMatch: string;
  unknownCity: string;
  suspended: string;
  /** `{role}` */
  myRole: string;
  lastVisited: string;
  favorite: string;
  unfavorite: string;
  favoriteFailed: string;
  switchStore: string;
  logout: string;
};

export const STORE_PICKER_MESSAGES: Record<Language, StorePickerMessages> = {
  zh: {
    pageTitle: '选择要进入的店铺',
    pageSubtitle: '你的账号关联了 {count} 家店。每家店的权限由那家店设置；进店后点顶栏店名可以随时切换。',
    noEnterable: '暂时没有可进入的店铺：下列店铺已暂停营业。',
    searchPlaceholder: '搜索店名或城市（↑↓ 选择，回车进入）',
    favorites: '★ 收藏',
    recent: '最近进过',
    all: '全部 {count} 家（按城市）',
    results: '搜索结果（{count}）',
    noMatch: '没有匹配的店',
    unknownCity: '未填城市',
    suspended: '已暂停',
    myRole: '我的角色：{role}',
    lastVisited: '上次所在',
    favorite: '收藏',
    unfavorite: '取消收藏',
    favoriteFailed: '收藏没有保存，请重试',
    switchStore: '切换店铺',
    logout: '退出登录',
  },
  en: {
    pageTitle: 'Choose a restaurant',
    pageSubtitle:
      'Your account is linked to {count} restaurants. Each restaurant sets your permissions there; once inside, tap the restaurant name in the top bar to switch.',
    noEnterable: 'No restaurant is available right now: the ones below are suspended.',
    searchPlaceholder: 'Search name or city (↑↓ to choose, Enter to open)',
    favorites: '★ Favorites',
    recent: 'Recent',
    all: 'All {count} (by city)',
    results: 'Results ({count})',
    noMatch: 'No matching restaurant',
    unknownCity: 'No city',
    suspended: 'Suspended',
    myRole: 'My role: {role}',
    lastVisited: 'Last visited',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    favoriteFailed: 'Favorite not saved, please try again',
    switchStore: 'Switch restaurant',
    logout: 'Log out',
  },
  pt: {
    pageTitle: 'Escolha o restaurante',
    pageSubtitle:
      'A sua conta está ligada a {count} restaurantes. Cada restaurante define as suas permissões; já dentro, toque no nome do restaurante na barra superior para mudar.',
    noEnterable: 'Nenhum restaurante disponível agora: os seguintes estão suspensos.',
    searchPlaceholder: 'Pesquisar nome ou cidade (↑↓ escolher, Enter abrir)',
    favorites: '★ Favoritos',
    recent: 'Recentes',
    all: 'Todos os {count} (por cidade)',
    results: 'Resultados ({count})',
    noMatch: 'Nenhum restaurante corresponde',
    unknownCity: 'Sem cidade',
    suspended: 'Suspenso',
    myRole: 'A minha função: {role}',
    lastVisited: 'Último visitado',
    favorite: 'Adicionar aos favoritos',
    unfavorite: 'Remover dos favoritos',
    favoriteFailed: 'Favorito não guardado, tente novamente',
    switchStore: 'Mudar de restaurante',
    logout: 'Sair',
  },
  es: {
    pageTitle: 'Elija el restaurante',
    pageSubtitle:
      'Su cuenta está vinculada a {count} restaurantes. Cada restaurante define sus permisos; una vez dentro, toque el nombre del restaurante en la barra superior para cambiar.',
    noEnterable: 'Ningún restaurante disponible ahora: los siguientes están suspendidos.',
    searchPlaceholder: 'Buscar nombre o ciudad (↑↓ elegir, Intro abrir)',
    favorites: '★ Favoritos',
    recent: 'Recientes',
    all: 'Todos los {count} (por ciudad)',
    results: 'Resultados ({count})',
    noMatch: 'Ningún restaurante coincide',
    unknownCity: 'Sin ciudad',
    suspended: 'Suspendido',
    myRole: 'Mi función: {role}',
    lastVisited: 'Último visitado',
    favorite: 'Añadir a favoritos',
    unfavorite: 'Quitar de favoritos',
    favoriteFailed: 'Favorito no guardado, inténtelo de nuevo',
    switchStore: 'Cambiar de restaurante',
    logout: 'Cerrar sesión',
  },
  fr: {
    pageTitle: 'Choisissez le restaurant',
    pageSubtitle:
      'Votre compte est lié à {count} restaurants. Chaque restaurant définit vos droits ; une fois dedans, touchez le nom du restaurant dans la barre du haut pour changer.',
    noEnterable: 'Aucun restaurant disponible pour le moment : ceux ci-dessous sont suspendus.',
    searchPlaceholder: 'Rechercher nom ou ville (↑↓ choisir, Entrée ouvrir)',
    favorites: '★ Favoris',
    recent: 'Récents',
    all: 'Tous les {count} (par ville)',
    results: 'Résultats ({count})',
    noMatch: 'Aucun restaurant ne correspond',
    unknownCity: 'Sans ville',
    suspended: 'Suspendu',
    myRole: 'Mon rôle : {role}',
    lastVisited: 'Dernier visité',
    favorite: 'Ajouter aux favoris',
    unfavorite: 'Retirer des favoris',
    favoriteFailed: 'Favori non enregistré, réessayez',
    switchStore: 'Changer de restaurant',
    logout: 'Se déconnecter',
  },
  de: {
    pageTitle: 'Restaurant auswählen',
    pageSubtitle:
      'Ihr Konto ist mit {count} Restaurants verknüpft. Jedes Restaurant legt Ihre Rechte dort fest; drinnen tippen Sie oben auf den Restaurantnamen, um zu wechseln.',
    noEnterable: 'Derzeit ist kein Restaurant verfügbar: die folgenden sind gesperrt.',
    searchPlaceholder: 'Name oder Stadt suchen (↑↓ wählen, Enter öffnen)',
    favorites: '★ Favoriten',
    recent: 'Zuletzt',
    all: 'Alle {count} (nach Stadt)',
    results: 'Ergebnisse ({count})',
    noMatch: 'Kein passendes Restaurant',
    unknownCity: 'Ohne Stadt',
    suspended: 'Gesperrt',
    myRole: 'Meine Rolle: {role}',
    lastVisited: 'Zuletzt besucht',
    favorite: 'Zu Favoriten',
    unfavorite: 'Aus Favoriten entfernen',
    favoriteFailed: 'Favorit nicht gespeichert, bitte erneut versuchen',
    switchStore: 'Restaurant wechseln',
    logout: 'Abmelden',
  },
};
