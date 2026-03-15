---
name: Faza Status Tracker
description: Current completion status of each development Faza for the redirect-manager plugin
type: project
---

Faza 1 (scaffold + package.json cleanup): COMPLETE as of 2026-03-15. Initial git commit: `feat: initial plugin scaffold (faza 1)`.

**Why:** Establishes the base structure on which all subsequent Fazas build.

Faza 2 (redirect content-type + CRUD altyapı): COMPLETE as of 2026-03-15. Branch: `faza/2-redirect-crud`, commit: 7069fe2.
  - Schema: from/to/type(enumeration)/isActive model
  - New types file: `server/src/types/redirect.ts` (Redirect, CreateRedirectInput, UpdateRedirectInput)
  - Service: full CRUD + toggleActive + getSettings/saveSettings/getContentTypes
  - Controller: input validation, slash-prefix enforcement, no stack trace leakage
  - Routes: type: 'admin' — all routes require Strapi admin JWT authentication

Faza 3 (settings toggles + slug lifecycle): IN PROGRESS as of 2026-03-15. Branch: `staging` (eski adı: `faza/3-settings-lifecycle`), commit: 9dcf276.
  - PluginSettings extended: autoRedirectOnSlugChange, chainDetectionEnabled, orphanRedirectEnabled
  - ContentTypeSettings extended: urlPrefix? field
  - bootstrap.ts: beforeUpdate/afterUpdate lifecycle with draftAndPublish guard and cycle prevention
  - Settings.tsx: API URL fixed (/redirect-manager/... not /api/redirect-manager/...), Toggle rows added, Checkbox onChange -> onCheckedChange
  - admin/src/index.ts: Settings page registered via createSettingSection

**How to apply:** All faza development now happens on `staging` branch. Faza 4 target is runtime redirect middleware in `middlewares/index.ts` with in-memory cache, registered via `strapi.server.use()` in `register.ts`.

Faza 4: COMPLETE as of 2026-03-15. Branch: `faza/4-middleware`, commit: 135e4a6.
  - `server/src/middlewares/redirect.ts`: in-memory Map cache, trailing slash normalization, external redirect guard, 301/302 via ctx.status + ctx.redirect()
  - `middlewares/index.ts`: exports redirectMiddleware
  - `register.ts`: calls strapi.server.use(middlewares.redirectMiddleware({ strapi }))
  - `services/redirect.ts`: invalidateCache() added after create, update, delete, toggleActive
  - Koa import: must use `import type Koa = require('koa')` (not default import) — ts-jest lacks esModuleInterop
Faza 5: COMPLETE as of 2026-03-15. Branch: `faza/5-admin-ui`, commit: 90b296d.
  - `admin/src/pages/RedirectListPage.tsx`: full CRUD table + Modal.Root add/edit form + Dialog.Root delete confirmation + inline Toggle
  - `admin/src/pages/App.tsx`: added `redirects` route pointing to RedirectListPage
  - `admin/src/pages/HomePage.tsx`: now renders RedirectListPage (plugin main page = redirect list)
  - DS v2 patterns used: Modal.Root/Content/Header/Title/Body/Footer/Close, Dialog.Root/Content/Header/Body/Footer/Cancel/Action, Field.Root/Label/Error, TextInput, IconButton (label + children), Badge, Toggle
  - useFetchClient: confirmed del/put/post/get all available
Faza 6: NOT STARTED — Chain detection (service + admin UI uyarısı)
Faza 7: NOT STARTED — Orphan redirect (content-type + UI)
