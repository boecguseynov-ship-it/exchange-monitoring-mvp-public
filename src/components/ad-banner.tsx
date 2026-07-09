import Link from "next/link";
import { getBanner, type BannerPlacement } from "@/lib/banners";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export async function AdBanner({ placement }: { placement: BannerPlacement }) {
  const banner = await getBanner(placement);
  if (!banner) return null;

  const hasImage = Boolean(banner.image);
  const className = `adBanner adBanner--${placement}${hasImage ? " adBanner--image" : ""}`;
  const label = `${banner.badge}: ${banner.title}`;
  const content = hasImage ? (
    <span className="adBannerImageFrame">
      <img src={banner.image} alt={banner.alt || banner.title} loading="lazy" />
    </span>
  ) : (
    <>
      <span className="adBannerMark" aria-hidden="true">AD</span>
      <span className="adBannerCopy">
        <small>{banner.badge}</small>
        <strong>{banner.title}</strong>
        <span>{banner.text}</span>
      </span>
      <span className="adBannerAction">Подробнее</span>
    </>
  );

  if (isExternalHref(banner.href)) {
    return (
      <a aria-label={label} className={className} href={banner.href} rel="sponsored noopener noreferrer" target="_blank">
        {content}
      </a>
    );
  }

  return (
    <Link aria-label={label} className={className} href={banner.href}>
      {content}
    </Link>
  );
}
