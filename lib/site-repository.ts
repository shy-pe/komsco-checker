import rawSites from "@/data/sites.json";
import type { SiteConfig } from "@/lib/types";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSites(): SiteConfig[] {
  const seen = new Set<string>();

  return rawSites
    .filter((site): site is SiteConfig => Boolean(site?.name && site?.url))
    .map((site, index) => {
      const baseId = slugify(site.id || site.name) || `site-${index + 1}`;
      let id = baseId;
      let suffix = 2;

      while (seen.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      seen.add(id);

      return {
        id,
        name: site.name.trim(),
        url: site.url.trim()
      };
    });
}
