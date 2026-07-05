export type NavigationItem = {
  href: string;
  label: string;
};

export const publicNavigation: NavigationItem[] = [
  { href: "/", label: "Мониторинг" },
  { href: "/exchangers", label: "Обменные пункты" },
  { href: "/blog", label: "Блог" },
  { href: "/wiki", label: "База знаний" },
  { href: "/contacts", label: "Контакты" }
];

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type BlogArticle = {
  id: string;
  title: string;
  excerpt: string;
  body?: string;
  category: string;
  date: string;
  readTime: string;
  accent: string;
  symbol: string;
};

export const blogArticles: BlogArticle[] = [
  {
    id: "how-to-compare-rates",
    title: "Как сравнивать курсы обменников без неприятных сюрпризов",
    excerpt: "Разбираем эффективный курс, комиссии, лимиты и резерв — четыре показателя, которые стоит проверить до перехода в обменный пункт.",
    category: "Безопасность",
    date: "20 июня 2026",
    readTime: "6 минут",
    accent: "#b8f23f",
    symbol: "↗"
  },
  {
    id: "stablecoin-networks",
    title: "USDT в разных сетях: почему TRC20 и ERC20 нельзя путать",
    excerpt: "Короткая памятка о сетях, комиссиях и проверке адреса перед отправкой стейблкоинов.",
    category: "Криптовалюты",
    date: "18 июня 2026",
    readTime: "5 минут",
    accent: "#31d3a5",
    symbol: "₮"
  },
  {
    id: "exchange-reserves",
    title: "Что показывает резерв обменника и когда он действительно важен",
    excerpt: "Почему большой резерв не всегда означает лучший курс и как подобрать обменник под конкретную сумму.",
    category: "Рынок",
    date: "16 июня 2026",
    readTime: "4 минуты",
    accent: "#ff7a66",
    symbol: "◎"
  },
  {
    id: "kyc-labels",
    title: "KYC, AML и метки риска: читаем условия до обмена",
    excerpt: "Объясняем простыми словами, когда сервис может запросить документы и что означает AML-проверка адреса.",
    category: "Безопасность",
    date: "13 июня 2026",
    readTime: "7 минут",
    accent: "#72a7ff",
    symbol: "✓"
  },
  {
    id: "ratescope-ranking",
    title: "Как RateScope ранжирует предложения обменных пунктов",
    excerpt: "Показываем, как учитываются курс, фиксированные и процентные комиссии, свежесть данных и доступный резерв.",
    category: "RateScope",
    date: "10 июня 2026",
    readTime: "5 минут",
    accent: "#a97aff",
    symbol: "R"
  },
  {
    id: "market-volatility",
    title: "Волатильность курса: почему предложение меняется за несколько минут",
    excerpt: "Что происходит с котировками в периоды движения рынка и почему важно смотреть время последнего обновления.",
    category: "Рынок",
    date: "7 июня 2026",
    readTime: "4 минуты",
    accent: "#ffd34e",
    symbol: "≈"
  }
];

export const blogCategories = ["Все темы", "Криптовалюты", "Безопасность", "Рынок", "RateScope"] as const;

export function filterBlogArticles(articles: BlogArticle[], query: string, category: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");

  return articles.filter((article) => {
    const matchesCategory = category === "Все темы" || article.category === category;
    const haystack = `${article.title} ${article.excerpt} ${article.category}`.toLocaleLowerCase("ru");
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}

export type WikiItem = {
  title: string;
  description: string;
  href: string;
  anchor?: string | null;
};

export type WikiGroup = {
  title: string;
  icon: "users" | "exchange" | "reference";
  items: WikiItem[];
};

export const wikiGroups: WikiGroup[] = [
  {
    title: "Пользователям",
    icon: "users",
    items: [
      { title: "Как начать работу", description: "Выбор направления, ввод суммы, сравнение предложений и переход к обменнику.", href: "/#monitoring", anchor: "getting-started" },
      { title: "Условные обозначения", description: "Курс, резерв, лимиты, KYC, AML, сети и статусы обновления в таблице мониторинга.", href: "/wiki#legend", anchor: "legend" },
      { title: "FAQ для пользователей", description: "Ответы на частые вопросы о выборе обменника, проверке условий и спорных ситуациях.", href: "/wiki#faq-users", anchor: "faq-users" },
      { title: "Статьи о безопасности", description: "Материалы о безопасном обмене, проверке адресов, доменов и криптовалютных сетей.", href: "/blog", anchor: "security-articles" },
      { title: "Отзывы и жалобы", description: "Как оставить отзыв, обратиться в поддержку и передать данные по спорной операции.", href: "/contacts#feedback", anchor: "reviews-complaints" },
      { title: "Обменные пункты", description: "Каталог обменников, их статусы, отзывы, резервы и публичные карточки.", href: "/exchangers#catalog", anchor: "exchangers-catalog" }
    ]
  },
  {
    title: "Обменным пунктам",
    icon: "exchange",
    items: [
      { title: "Формат экспортного файла", description: "Структура push-фида, поля предложения, сети, лимиты и пример JSON-снимка.", href: "/api-docs#feed-format", anchor: "feed-format" },
      { title: "Условия размещения", description: "Требования к профилю, корректности курсов, контактам и публичной информации.", href: "/wiki#placement-terms", anchor: "placement-terms" },
      { title: "Обязанности участников мониторинга", description: "Актуальность фидов, обработка жалоб, честные условия и запрет вводящих в заблуждение данных.", href: "/wiki#participant-duties", anchor: "participant-duties" },
      { title: "Кабинет обменника", description: "Профиль, фиды, ключи, импорт, предложения, отзывы и жалобы в личном кабинете.", href: "/dashboard/owner#profile", anchor: "owner-dashboard" },
      { title: "Документация API", description: "Публичные endpoints, защищённый ingest API и примеры запросов для интеграции.", href: "/api-docs#public-api", anchor: "api-documentation" }
    ]
  },
  {
    title: "Справочники",
    icon: "reference",
    items: [
      { title: "Коды валют", description: "Фиатные и криптовалютные обозначения в RateScope.", href: "/api/v1/assets" },
      { title: "Сети криптовалют", description: "Как различать сети одной и той же валюты.", href: "/api-docs" },
      { title: "Публичное API", description: "Получение активов, курсов и статуса платформы.", href: "/api-docs" }
    ]
  }
];

export function filterWikiGroups(groups: WikiGroup[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  if (!normalizedQuery) return groups;

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.title} ${item.description}`.toLocaleLowerCase("ru").includes(normalizedQuery)
      )
    }))
    .filter((group) => group.items.length > 0);
}
