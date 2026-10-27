import { readFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map(([, name, value]) => [name.toLowerCase(), value]));
}

// Filter the actual generated HTML, including future pages outside Starlight.
// Missing files, redirect pages, and noindex pages must never enter the sitemap.
export async function indexableEntry(item, directory) {
  const path = new URL(item.url).pathname;
  if (!path.endsWith('/')) return undefined;
  let html;
  try {
    html = await readFile(new URL(`.${path}index.html`, directory), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const meta = [...head.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  if (meta.some((tag) => tag['http-equiv']?.toLowerCase() === 'refresh' ||
    (tag.name?.toLowerCase() === 'robots' && /\b(noindex|none)\b/i.test(tag.content)))) {
    return undefined;
  }
  const canonical = [...head.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag))
    .filter((tag) => tag.rel === 'canonical');
  return canonical.length === 1 && canonical[0].href === item.url ? item : undefined;
}

export default function indexableSitemap() {
  let directory;
  const integration = sitemap({ serialize: (item) => indexableEntry(item, directory) });
  const configDone = integration.hooks['astro:config:done'];
  return {
    ...integration,
    hooks: {
      ...integration.hooks,
      'astro:config:done': async (context) => {
        directory = context.config.outDir;
        await configDone?.(context);
      },
    },
  };
}
