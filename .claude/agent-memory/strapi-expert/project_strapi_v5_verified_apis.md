---
name: Strapi v5 Verified API Patterns
description: MCP-verified Strapi v5 API patterns that differ from v4 training data — admin routes, lifecycle hooks, Design System v2 components
type: project
---

## Admin Route URL Prefix

Admin-type plugin routes (`type: 'admin'`) are served at `/${pluginId}/...` — NOT `/api/${pluginId}/...`.

Correct useFetchClient call: `get(`/${PLUGIN_ID}/settings`)` not `get(`/api/${PLUGIN_ID}/settings`)`.

MCP source: documentation llms-full.txt — the example uses `/my-plugin/pass-data` as the URL without `/api/` prefix.

**Why:** The existing Settings.tsx had `/api/${PLUGIN_ID}/...` which would have returned 404 in production. Fixed in Faza 3.

**How to apply:** Any admin-side fetch to plugin routes must use `/${PLUGIN_ID}/...` prefix.

## Settings Page Registration

`app.createSettingSection()` is called in `register()` (not `bootstrap()`). Shape:

```typescript
app.createSettingSection(
  { id: string, intlLabel: { id: string, defaultMessage: string } },
  [{ intlLabel, id, to: '/settings/<plugin-id>', Component: async () => import(...), permissions: [] }]
);
```

Settings page appears under the Strapi admin Settings panel in the left sidebar.

## Lifecycle Hooks (strapi.db.lifecycles.subscribe)

- Bootstrap parameter: `{ strapi }` (destructured)
- Subscribe call is in `bootstrap.ts`, not inline in model schema files
- `event.state` cross-hook sharing: confirmed supported, assign an object
- `event.params.where.id`: correct access pattern for beforeUpdate
- `event.result`: available in afterUpdate, contains the updated entity
- `event.model.uid`: the content-type UID string

## strapi.contentTypes Access in v5

`strapi.contentTypes[uid]` is the correct v5 pattern — confirmed by MCP (documentation llms-full.txt snippet using `Object.keys(strapi.contentTypes).filter(uid => uid.startsWith('api::'))` and `strapi.contentTypes[uid]` for attribute access).

The content type object shape: `{ uid, info: { displayName }, attributes: Record<string, { type }> }`.

Also confirmed: `strapi.contentTypes` is directly accessible on the `strapi` instance in controllers (via the factory closure `{ strapi }: { strapi: Core.Strapi }`). No special getter needed for the content-type map itself — only for individual typed lookups where `strapi.contentType(uid)` is the alternative getter.

## Global Middleware Registration in Plugins

`strapi.server.use()` is the correct v5 pattern — MCP confirmed.
Type signature: `use(...args: Parameters<Koa['use']>): Server`
This means the middleware function type is `Koa.Middleware` = `(ctx: Koa.ParameterizedContext, next: Koa.Next) => Promise<void>`.

Pattern in register.ts:
```typescript
strapi.server.use(middlewares.yourMiddleware({ strapi }));
```
The middleware factory receives `{ strapi }` and returns the Koa function — this is the canonical Strapi plugin middleware shape.

## Koa ctx.redirect() + Status Code Behavior

Koa source confirmed: `ctx.redirect(url)` checks `if (!statuses.redirect[this.status]) this.status = 302`.
Therefore: set `ctx.status = 301` BEFORE calling `ctx.redirect(url)` to issue a 301.
Setting status after the redirect call has no effect (the HTML body is already written).

## Koa Type Import in ts-jest Context

`@types/koa` uses `export = Application` (CommonJS-style).
With `esModuleInterop: false` (ts-jest default), `import type Koa from 'koa'` fails.
Correct form: `import type Koa = require('koa')` — this works in both tsc and ts-jest.

## useFetchClient Methods

`FetchClient` interface (confirmed from `@strapi/admin` type declarations):
- `get(url, config?)`
- `post(url, data?, config?)`
- `put(url, data?, config?)`
- `del(url, config?)` — note: it is `del`, NOT `delete`

## Design System v2 Component APIs

### Toggle
Props: `onLabel: string` (required), `offLabel: string` (required), `checked?: boolean | null`, `onChange` (native input event from ComponentPropsWithoutRef<'input'>).
NOT `onCheckedChange` — that is Switch/Checkbox API.

### Checkbox
Extends `@radix-ui/react-checkbox` — uses `onCheckedChange(checked: CheckedState): void`, NOT `onChange`.
Old `onChange` prop will TypeScript-error in strict mode.

### Switch
`checked` + `onCheckedChange` props. Typically wrapped in `Field.Root`.

### Modal (DS v2 compound component)
`Modal.Root` controlled via `open: boolean` + `onOpenChange: (open: boolean) => void`.
Sub-components: `Modal.Trigger`, `Modal.Content`, `Modal.Header` (prop: `closeLabel`), `Modal.Title`, `Modal.Body`, `Modal.Footer`, `Modal.Close` (wraps a button, renders as child).
No `isOpen` prop — use `open`.

### Dialog (DS v2 compound component for confirmations)
`Dialog.Root` controlled via `open: boolean` + `onOpenChange`.
Sub-components: `Dialog.Content`, `Dialog.Header`, `Dialog.Body` (prop: `icon?`), `Dialog.Footer`, `Dialog.Cancel` (asChild), `Dialog.Action` (asChild).

### IconButton (DS v2)
API changed in v1→v2 migration: removed `icon` and `ariaLabel` props.
New API: `<IconButton label="Edit"><Pencil /></IconButton>` — label is required (shows tooltip), children is the icon.
Optional: `withTooltip={false}` to suppress tooltip.

### Field + TextInput (DS v2)
Wrap `TextInput` in `Field.Root name="..." error={...} required`:
```tsx
<Field.Root name="field" error={errors.field} required>
  <Field.Label>Label</Field.Label>
  <TextInput value={val} onChange={(e) => setVal(e.target.value)} />
  <Field.Error />
</Field.Root>
```
`TextInput` takes standard input props: `value`, `onChange` (React.ChangeEvent<HTMLInputElement>), `placeholder`.
