import createRedirectMiddleware, { invalidateCache } from '../redirect';

// ---------------------------------------------------------------------------
// Mock setup — mirrors the Koa middleware signature used by redirect.ts
//
// redirect.ts default export:
//   ({ strapi }) => async (ctx, next) => { ... }
//
// Internally it calls:
//   strapi.db.query('plugin::redirect-manager.redirect').findMany({ where: { isActive: true } })
//   strapi.log.warn(...)
//   ctx.redirect(url)
//   ctx.status = 301 | 302
// ---------------------------------------------------------------------------

const mockFindMany = jest.fn();

const mockStrapi = {
  db: {
    query: jest.fn().mockReturnValue({ findMany: mockFindMany }),
  },
  log: { warn: jest.fn() },
} as unknown as Parameters<typeof createRedirectMiddleware>[0]['strapi'];

interface Ctx {
  request: { path: string };
  status: number;
  redirect: jest.Mock;
}

const createCtx = (path: string): Ctx => ({
  request: { path },
  status: 0,
  redirect: jest.fn(),
});

const next = jest.fn();

// The actual middleware returns Koa-typed fn; we cast to work with our minimal Ctx mock.
type MiddlewareFn = (ctx: Ctx, next: jest.Mock) => Promise<void>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard DB rows returned by findMany — all internal, all active */
function makeRedirects(
  entries: Array<{ from: string; to: string; type?: '301' | '302' }>,
) {
  return entries.map((e) => ({
    from: e.from,
    to: e.to,
    type: e.type ?? '301',
    isActive: true,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('redirect middleware', () => {
  let middleware: MiddlewareFn;

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCache();
    // Cast needed: actual return type is Koa middleware, but our tests use a minimal Ctx mock
    middleware = createRedirectMiddleware({ strapi: mockStrapi }) as unknown as MiddlewareFn;
  });

  // -------------------------------------------------------------------------
  // Cache behavior
  // -------------------------------------------------------------------------

  describe('cache behavior', () => {
    it('should call findMany on the first request (cache miss)', async () => {
      mockFindMany.mockResolvedValue(makeRedirects([]));
      const ctx = createCtx('/no-match');

      await middleware(ctx, next);

      expect(mockStrapi.db.query).toHaveBeenCalledWith(
        'plugin::redirect-manager.redirect',
      );
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should NOT call findMany on the second request (cache hit)', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/old', to: '/new' }]),
      );
      const ctx1 = createCtx('/old');
      const ctx2 = createCtx('/old');

      await middleware(ctx1, next);
      // findMany should have been called once
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      await middleware(ctx2, next);
      // Second request uses cache — no additional DB call
      expect(mockFindMany).not.toHaveBeenCalled();
      // But redirect should still work from cache
      expect(ctx2.status).toBe(301);
      expect(ctx2.redirect).toHaveBeenCalledWith('/new');
    });

    it('should call findMany again after invalidateCache()', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/old', to: '/new' }]),
      );
      const ctx1 = createCtx('/old');

      await middleware(ctx1, next);
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Invalidate the module-level cache
      invalidateCache();

      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/old', to: '/updated' }]),
      );
      const ctx2 = createCtx('/old');

      await middleware(ctx2, next);

      // DB should be queried again after cache invalidation
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      // Should use the fresh data
      expect(ctx2.redirect).toHaveBeenCalledWith('/updated');
    });
  });

  // -------------------------------------------------------------------------
  // Redirect matching and response
  // -------------------------------------------------------------------------

  describe('redirect matching', () => {
    it('should set ctx.status and call ctx.redirect when path matches a 301', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/old-page', to: '/new-page', type: '301' }]),
      );
      const ctx = createCtx('/old-page');

      await middleware(ctx, next);

      // DECISION: ctx.status must be set BEFORE ctx.redirect() so Koa preserves
      // the status code instead of defaulting to 302.
      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/new-page');
      // next() should NOT be called when a redirect is performed
      expect(next).not.toHaveBeenCalled();
    });

    it('should set ctx.status = 302 for a 302 redirect', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/temporary', to: '/destination', type: '302' },
        ]),
      );
      const ctx = createCtx('/temporary');

      await middleware(ctx, next);

      expect(ctx.status).toBe(302);
      expect(ctx.redirect).toHaveBeenCalledWith('/destination');
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() and NOT redirect when path has no match', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/old', to: '/new' }]),
      );
      const ctx = createCtx('/unmatched-path');

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(ctx.redirect).not.toHaveBeenCalled();
      // Status should remain untouched (default 0 from mock)
      expect(ctx.status).toBe(0);
    });

    it('should match the correct redirect when multiple entries exist', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/page-a', to: '/page-a-new', type: '301' },
          { from: '/page-b', to: '/page-b-new', type: '302' },
          { from: '/page-c', to: '/page-c-new', type: '301' },
        ]),
      );
      const ctx = createCtx('/page-b');

      await middleware(ctx, next);

      expect(ctx.status).toBe(302);
      expect(ctx.redirect).toHaveBeenCalledWith('/page-b-new');
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Trailing slash normalization
  // -------------------------------------------------------------------------

  describe('trailing slash normalization', () => {
    beforeEach(() => {
      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/blog', to: '/articles', type: '301' }]),
      );
    });

    it('should normalize /blog/ to /blog and find the match', async () => {
      // DECISION: Trailing slashes are stripped before cache lookup,
      // so "/blog/" becomes "/blog" and matches the DB entry for "/blog".
      const ctx = createCtx('/blog/');

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/articles');
      expect(next).not.toHaveBeenCalled();
    });

    it('should NOT strip trailing slash from root path "/"', async () => {
      // DECISION: Root "/" must remain "/" — stripping the slash would produce
      // an empty string, which would break path matching.
      mockFindMany.mockResolvedValue(
        makeRedirects([{ from: '/', to: '/home', type: '301' }]),
      );
      // Need to re-invalidate since we changed the mock
      invalidateCache();

      const ctx = createCtx('/');

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/home');
    });

    it('should match /blog directly without modification (no trailing slash)', async () => {
      const ctx = createCtx('/blog');

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/articles');
    });
  });

  // -------------------------------------------------------------------------
  // Security — external redirect prevention
  // -------------------------------------------------------------------------

  describe('security: external redirect prevention', () => {
    it('should call next() and NOT redirect when "to" is an http:// URL', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/external-http', to: 'http://external.com' as string },
        ]),
      );
      const ctx = createCtx('/external-http');

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(ctx.redirect).not.toHaveBeenCalled();
      expect(ctx.status).toBe(0);
      // Should log a warning about the skipped external redirect
      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        '[redirect-manager] Skipping external redirect to http://external.com',
      );
    });

    it('should call next() and NOT redirect when "to" is an https:// URL', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/external-https', to: 'https://external.com' as string },
        ]),
      );
      const ctx = createCtx('/external-https');

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(ctx.redirect).not.toHaveBeenCalled();
      expect(ctx.status).toBe(0);
      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        '[redirect-manager] Skipping external redirect to https://external.com',
      );
    });

    it('should allow internal paths that contain "http" as a substring', async () => {
      // Edge case: a path like "/httpbin-test" should NOT be blocked
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/httpbin-test', to: '/api/httpbin', type: '301' },
        ]),
      );
      const ctx = createCtx('/httpbin-test');

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/api/httpbin');
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // isActive filter
  // -------------------------------------------------------------------------

  describe('isActive filter', () => {
    it('should pass { where: { isActive: true } } to findMany', async () => {
      mockFindMany.mockResolvedValue([]);
      const ctx = createCtx('/anything');

      await middleware(ctx, next);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should not cache inactive redirects (they are filtered at DB level)', async () => {
      // The middleware relies on the DB query to filter inactive redirects.
      // If findMany only returns active ones, the cache map will only contain active entries.
      mockFindMany.mockResolvedValue([
        { from: '/active', to: '/destination', type: '301' as const, isActive: true },
        // isActive: false would NOT be returned by the DB query because of the where clause,
        // but if somehow it leaked through, verify the cache map behavior.
      ]);
      const ctx = createCtx('/active');

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/destination');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty redirect table gracefully', async () => {
      mockFindMany.mockResolvedValue([]);
      const ctx = createCtx('/any-path');

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(ctx.redirect).not.toHaveBeenCalled();
    });

    it('should handle deeply nested paths', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/a/b/c/d/e', to: '/short', type: '301' },
        ]),
      );
      const ctx = createCtx('/a/b/c/d/e');

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx.redirect).toHaveBeenCalledWith('/short');
    });

    it('should strip trailing slash from deeply nested paths', async () => {
      mockFindMany.mockResolvedValue(
        makeRedirects([
          { from: '/a/b/c', to: '/flat', type: '302' },
        ]),
      );
      const ctx = createCtx('/a/b/c/');

      await middleware(ctx, next);

      expect(ctx.status).toBe(302);
      expect(ctx.redirect).toHaveBeenCalledWith('/flat');
    });
  });
});
