# libID website

One static site and Cloudflare Worker: landing page at `/`, Starlight at `/docs/` and `/specs/`.
Add Markdown/MDX with `title` frontmatter in [`docs/pages/`](../docs/pages/).
Specs are published directly from [`specs/`](../specs/).
Six UI colors per theme and one shared logo color live in [`../brand/palette.json`](../brand/palette.json), used by the website, favicons and CCDP screens, which also share the Libron font in [`../brand/libron/`](../brand/libron/).

## Local

Node.js 26+, pnpm 11.25.0. From the repository root:

```sh
pnpm -C site install --frozen-lockfile
pnpm -C site dev
```

Run `pnpm -C site build`, then `pnpm -C site preview` to test search.
Run `pnpm -C site build` before `pnpm -C site test`. Tests cover themes,
spec links, Worker routing and preview indexing, and the generated HTML's SEO
metadata, landmarks, sitemap, and social image dimensions.

## Indexing and accessibility

Public page URLs use a trailing slash. Starlight renders titles, descriptions,
canonicals and Open Graph tags at build time. Keep each page's `description`
frontmatter specific to that page. The home page has its own static metadata.
The existing `@astrojs/sitemap` generator is configured explicitly (the same
version Starlight uses) to include only generated HTML whose single canonical
matches its URL, excluding `noindex` and redirect pages. It adds no guessed
`lastmod` dates. `/robots.txt` points to `/sitemap-index.xml`.

`/llms.txt` is a reading guide to the protocol, specifications, and code; it is
not an indexing, training, or citation guarantee. Source Markdown is available
in the linked GitHub repository. No separate Markdown-rendering service is used.

Structured data describes a WebSite, the protocol as a CreativeWork, and
documentation as TechArticle. It does not assert a legal company or promise a
knowledge panel. `/og.png` is the existing libID banner (PNG, 1200 × 630).

The Worker runs before static assets so it can apply `X-Robots-Tag: noindex`
to every response on non-production hosts (including Worker Preview and
workers.dev URLs). Preview robots.txt disallows crawling. Production 404s retain
their status and receive `noindex`; unknown paths are not sent to the homepage.
The Worker normalizes HTTP and `www` to HTTPS on `lib.id` with 301 and promotes
the Assets binding's recognized trailing-slash/index.html redirects to 301.
Running the Worker first means ordinary static requests also invoke it.

Starlight retains its existing header, navigation, main, footer, native popover
menus, and native search dialog. Skip links move keyboard focus to the content;
the home page has a matching skip link. Shared focus styles and reduced-motion
preferences preserve the existing typeface, palette, and layout.

### Cloudflare owner checks

The source cannot inspect or override zone-level rules. Before release, check
these settings for the `lib.id` zone:

1. Security → Settings → filter **Bot traffic** → **Configure AI bot policies**:
   set Training, Search, and Agent access to Allow. Do not leave an AI crawler
   block active if the intended policy is to allow training and agent access.
2. Inspect **Bot Preference Sync** / managed robots.txt under those policies.
   This site supplies its own robots.txt and optional
   `Content-Signal: search=yes, ai-input=yes, ai-train=yes`. Disable managed
   robots.txt injection if it prepends conflicting `ai-train=no`, crawler
   `Disallow`, or restrictive content-use signals. Do not publish both policies.
   Content-Signal is Cloudflare's optional content-use mechanism, not an
   RFC 9309 robots.txt directive, and crawlers may not support it.
3. Keep the existing www Single Redirect described below. Check **SSL/TLS →
   Edge Certificates → Always Use HTTPS** and any redirect rules for conflicts.
   The Worker adds a source-controlled fallback; no dashboard change is made
   by this repository update.
4. Check WAF/custom rules and Cloudflare Access for crawler challenges/blocks.
   Test the final public robots.txt, including the response seen by AI crawlers.
   Requests with a crawler User-Agent alone do not establish verified-bot access.

After an explicitly approved deployment, verify apex and www HTTP/HTTPS,
`/docs` → `/docs/` (301), `/docs/index.html` → `/docs/`, unknown paths (404),
UTM URLs (clean canonical, query preserved on redirects), sitemap URLs (200),
social-image MIME/dimensions, and noindex on both custom-domain and workers.dev
previews. Confirm headers on production are free of unexpected noindex.
Reconcile this change with open PRs #70 (expanded docs) and #166 (noindex agent
launcher) when merging; the sitemap filter covers noindex pages outside Starlight.

References: [Cloudflare managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/),
[HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/),
[Worker/Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/).

## Cloudflare

Worker: **libid**. Root: `/`. Production branch: `main`.
Environment: `NODE_VERSION=26`, `PNPM_VERSION=11.25.0`.

| Command | Value |
| --- | --- |
| Build | `pnpm -C site install --frozen-lockfile && pnpm -C site build` |
| Deploy | `pnpm -C site run deploy` |
| Non-production deploy | `pnpm -C site run deploy:preview` |

Cloudflare caches assets at the edge. `public/_headers` gives fingerprinted
`/_astro/` assets a one-year browser cache; HTML, favicons, and search files
keep Cloudflare's default revalidation so updates remain fresh.
Keep cacheable fonts in `src/assets/` and reference them through imports or CSS
so Astro changes their URLs when their contents change.

`wrangler.jsonc` manages the `lib.id` and `www.lib.id` production custom domains
and `previews.lib.id` for Worker Previews. Cloudflare manages their DNS and HTTPS
certificates. Configure a zone-level Single Redirect rule matching
`http.host eq "www.lib.id"`, with a dynamic target of
`concat("https://lib.id", http.request.uri.path)`, status `301`, and query-string
preservation enabled. The custom-domain entry provisions the hostname; the
redirect rule sends visitors to the apex domain.

Branch previews use `<preview-name>.previews.lib.id`; the existing production
and preview `workers.dev` URLs remain enabled.

Enable non-production branch builds and Worker Previews in Cloudflare's build
settings, using the commands above. After switching to Worker Previews, set the
Preview command to `pnpm -C site run deploy:preview`: the default
`npx wrangler preview` runs at the repository root and misses `site/wrangler.jsonc`.
Existing previews retain their own build settings. Apply the build command,
Preview command, and environment versions above to each existing preview too.
`deploy:preview` uses the current Git branch
as the Preview name and updates its isolated deployment. For a local preview
deployment, build the site first, then run `pnpm -C site run deploy:preview`.

All website text uses self-hosted
[Libron v0.31](https://github.com/nicoverbruggen/libron/releases/tag/v0.31),
with its license in `../brand/libron/LICENSE`, published as `/fonts/libron/LICENSE`.
