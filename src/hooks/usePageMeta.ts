import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}

const BASE_TITLE = 'Shutdown Security';
const BASE_URL = 'https://shuffle-cases.lovable.app';
const DEFAULT_IMAGE = `${BASE_URL}/favicon.ico`;

function setMetaTag(property: string, content: string, isOg = false) {
  const attr = isOg ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function usePageMeta({ title, description, image, url, type = 'website' }: PageMeta) {
  useEffect(() => {
    const fullTitle = title === BASE_TITLE ? title : `${title} | ${BASE_TITLE}`;
    const fullUrl = url ? `${BASE_URL}${url}` : window.location.href;
    const img = image || DEFAULT_IMAGE;

    // Document title
    document.title = fullTitle;

    // Standard meta
    setMetaTag('description', description);

    // Open Graph
    setMetaTag('og:title', fullTitle, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:image', img, true);
    setMetaTag('og:url', fullUrl, true);
    setMetaTag('og:type', type, true);
    setMetaTag('og:site_name', BASE_TITLE, true);

    // Twitter
    setMetaTag('twitter:title', fullTitle);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', img);
    setMetaTag('twitter:card', image ? 'summary_large_image' : 'summary');

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', fullUrl);

    return () => {
      // Reset to defaults on unmount
      document.title = `${BASE_TITLE} - Open Source Alert & Case Management`;
    };
  }, [title, description, image, url, type]);
}
