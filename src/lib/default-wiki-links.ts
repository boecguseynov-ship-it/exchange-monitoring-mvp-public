import type { WikiGroup } from "@/features/public-content/content";

export type DefaultWikiLink = {
  title: string;
  description: string;
  href: string;
  anchor: string;
  group: string;
  icon: WikiGroup["icon"];
  position: number;
};

export const footerWikiGroups = ["Пользователям", "Обменным пунктам"] as const;

export const defaultWikiLinks: DefaultWikiLink[] = [
  {
    group: "Пользователям",
    icon: "users",
    title: "Как начать работу",
    description: "Выбор направления, ввод суммы, сравнение предложений и переход к обменнику.",
    href: "/#monitoring",
    anchor: "getting-started",
    position: 10
  },
  {
    group: "Пользователям",
    icon: "users",
    title: "Условные обозначения",
    description: "Курс, резерв, лимиты, KYC, AML, сети и статусы обновления в таблице мониторинга.",
    href: "/wiki#legend",
    anchor: "legend",
    position: 20
  },
  {
    group: "Пользователям",
    icon: "users",
    title: "FAQ для пользователей",
    description: "Ответы на частые вопросы о выборе обменника, проверке условий и спорных ситуациях.",
    href: "/wiki#faq-users",
    anchor: "faq-users",
    position: 30
  },
  {
    group: "Пользователям",
    icon: "users",
    title: "Статьи о безопасности",
    description: "Материалы о безопасном обмене, проверке адресов, доменов и криптовалютных сетей.",
    href: "/blog",
    anchor: "security-articles",
    position: 40
  },
  {
    group: "Пользователям",
    icon: "users",
    title: "Отзывы и жалобы",
    description: "Как оставить отзыв, обратиться в поддержку и передать данные по спорной операции.",
    href: "/contacts#feedback",
    anchor: "reviews-complaints",
    position: 50
  },
  {
    group: "Пользователям",
    icon: "users",
    title: "Обменные пункты",
    description: "Каталог обменников, их статусы, отзывы, резервы и публичные карточки.",
    href: "/exchangers#catalog",
    anchor: "exchangers-catalog",
    position: 60
  },
  {
    group: "Обменным пунктам",
    icon: "exchange",
    title: "Формат экспортного файла",
    description: "Структура push-фида, поля предложения, сети, лимиты и пример JSON-снимка.",
    href: "/api-docs#feed-format",
    anchor: "feed-format",
    position: 10
  },
  {
    group: "Обменным пунктам",
    icon: "exchange",
    title: "Условия размещения",
    description: "Требования к профилю, корректности курсов, контактам и публичной информации.",
    href: "/wiki#placement-terms",
    anchor: "placement-terms",
    position: 20
  },
  {
    group: "Обменным пунктам",
    icon: "exchange",
    title: "Обязанности участников мониторинга",
    description: "Актуальность фидов, обработка жалоб, честные условия и запрет вводящих в заблуждение данных.",
    href: "/wiki#participant-duties",
    anchor: "participant-duties",
    position: 30
  },
  {
    group: "Обменным пунктам",
    icon: "exchange",
    title: "Кабинет обменника",
    description: "Профиль, фиды, ключи, импорт, предложения, отзывы и жалобы в личном кабинете.",
    href: "/dashboard/owner#profile",
    anchor: "owner-dashboard",
    position: 40
  },
  {
    group: "Обменным пунктам",
    icon: "exchange",
    title: "Документация API",
    description: "Публичные endpoints, защищённый ingest API и примеры запросов для интеграции.",
    href: "/api-docs#public-api",
    anchor: "api-documentation",
    position: 50
  }
];

export const defaultFooterWikiLinks = footerWikiGroups.map((group) => ({
  title: group,
  icon: group === "Пользователям" ? "users" as const : "exchange" as const,
  items: defaultWikiLinks
    .filter((link) => link.group === group)
    .sort((left, right) => left.position - right.position)
    .map((link) => ({
      title: link.title,
      description: link.description,
      href: `/wiki#${link.anchor}`,
      anchor: link.anchor
    }))
})) satisfies WikiGroup[];
