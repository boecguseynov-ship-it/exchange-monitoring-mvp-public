export type LegalPageSlug = "privacy" | "terms";

export type LegalPageContent = {
  slug: LegalPageSlug;
  title: string;
  description: string;
  updatedAt: string;
  body: string;
};

const updatedAt = "2026-07-05";

export const legalPages: Record<LegalPageSlug, LegalPageContent> = {
  privacy: {
    slug: "privacy",
    title: "Политика конфиденциальности",
    description: "Как monik exchange обрабатывает данные пользователей, обращения и технические события сервиса.",
    updatedAt,
    body: `
## Какие данные мы обрабатываем
Мы используем данные, которые нужны для работы мониторинга: параметры обменного направления, технические события, обращения через формы, отзывы и жалобы.

- контактные данные, если пользователь передает их добровольно;
- сведения об отзывах, жалобах и переписке по спорным операциям;
- технические данные браузера, необходимые для защиты сервиса и диагностики ошибок.

## Для чего это нужно
Данные помогают показывать актуальные курсы, поддерживать качество каталога обменников, разбирать жалобы и защищать пользователей от недостоверной информации.

## Передача данных
Мы не продаем персональные данные. Передача возможна только поставщикам инфраструктуры, платежным или юридическим партнерам, если это необходимо для работы сервиса или выполнения требований закона.

## Хранение и удаление
Срок хранения зависит от типа данных и цели обработки. Пользователь может запросить уточнение, исправление или удаление данных через страницу [Контакты](/contacts).
`.trim()
  },
  terms: {
    slug: "terms",
    title: "Условия использования",
    description: "Правила использования monik exchange, публичных данных мониторинга и пользовательских материалов.",
    updatedAt,
    body: `
## Общие положения
monik exchange предоставляет справочную информацию об обменных направлениях, резервах, репутации и публичных сигналах безопасности. Сервис не является стороной обменной операции.

## Курсы и предложения
Курсы, лимиты и резервы могут меняться без предварительного уведомления. Перед совершением операции пользователь должен проверить итоговые условия на сайте выбранного обменника.

## Отзывы и жалобы
Пользователь отвечает за достоверность материалов, которые отправляет в отзывах, жалобах и обращениях. Мы можем скрывать материалы, нарушающие закон, права третьих лиц или правила модерации.

## Ограничение ответственности
monik exchange не гарантирует совершение обмена и не несет ответственность за действия сторонних обменных пунктов. Мы предоставляем инструменты сравнения и публичной проверки, но итоговое решение принимает пользователь.

## Связь
По вопросам работы сервиса, документов и удаления данных используйте страницу [Контакты](/contacts).
`.trim()
  }
};

export function getLegalPage(slug: string): LegalPageContent | null {
  return slug === "privacy" || slug === "terms" ? legalPages[slug] : null;
}

export async function loadLegalPage(slug: string): Promise<LegalPageContent | null> {
  const fallback = getLegalPage(slug);
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const { PublishStatus } = await import("@prisma/client");
    const document = await prisma.legalDocument.findFirst({
      where: { slug, status: PublishStatus.PUBLISHED }
    });
    if (!document) return fallback;
    return {
      slug: document.slug as LegalPageSlug,
      title: document.title,
      description: document.description,
      body: document.body,
      updatedAt: document.updatedAt.toISOString()
    };
  } catch {
    return fallback;
  }
}

export function formatLegalUpdatedAt(value: string | Date) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow"
  });
}
