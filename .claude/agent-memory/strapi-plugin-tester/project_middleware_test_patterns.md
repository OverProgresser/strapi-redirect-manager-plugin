---
name: Middleware test patterns
description: Mock pattern and type casting approach for testing Koa middleware in the redirect-manager plugin
type: project
---

Middleware tests require casting the middleware return type because `createRedirectMiddleware()` returns a Koa-typed function (`Koa.ParameterizedContext`), but tests use a minimal `Ctx` mock with only `request.path`, `status`, and `redirect`.

**Why:** Koa types require 60+ properties on the context object. Mocking all of them is impractical and adds noise without testing value.

**How to apply:**
- Define a `MiddlewareFn` type alias: `type MiddlewareFn = (ctx: Ctx, next: jest.Mock) => Promise<void>`
- Cast with `as unknown as MiddlewareFn` when assigning the middleware
- The module-level `cache` variable in `redirect.ts` persists across tests within the same module — always call `invalidateCache()` in `beforeEach`
- When testing cache invalidation mid-test, call `invalidateCache()` explicitly and provide fresh `mockFindMany` data before the next middleware invocation
- Jest 30 in non-TTY mode suppresses verbose test names; use `--json` or `--testPathPatterns` to filter
