import type { Core } from '@strapi/strapi';
import type Koa = require('koa');

type CacheEntry = { to: string; type: '301' | '302' };

let cache: Map<string, CacheEntry> | null = null;

async function getCache(strapi: Core.Strapi): Promise<Map<string, CacheEntry>> {
  if (cache) return cache;

  const redirects = await strapi.db
    .query('plugin::redirect-manager.redirect')
    .findMany({ where: { isActive: true } });

  cache = new Map(
    (redirects as Array<{ from: string; to: string; type: '301' | '302' }>).map((r) => [
      r.from,
      { to: r.to, type: r.type },
    ]),
  );

  return cache;
}

export function invalidateCache(): void {
  cache = null;
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: Koa.ParameterizedContext, next: Koa.Next): Promise<void> => {
    // Normalize trailing slash: strip it unless path is root '/'
    const rawPath = ctx.request.path;
    const path = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;

    const redirectMap = await getCache(strapi);
    const match = redirectMap.get(path);

    if (!match) {
      await next();
      return;
    }

    // Security: skip external redirects — only internal paths are allowed
    if (match.to.startsWith('http://') || match.to.startsWith('https://')) {
      strapi.log.warn(`[redirect-manager] Skipping external redirect to ${match.to}`);
      await next();
      return;
    }

    // Set status before ctx.redirect() so Koa preserves it (default would be 302)
    ctx.status = parseInt(match.type, 10);
    ctx.redirect(match.to);
  };
};
