# Strapi Redirect Manager

A redirect management plugin for **Strapi v5**.
Manage 301/302 redirects from the admin panel without touching code or redeploying.

## What it does

| Feature | Description |
|---|---|
| **Manual redirects** | Create, edit, delete, and toggle redirects from the admin panel |
| **Runtime middleware** | Intercepts HTTP requests with an in-memory cache — no DB hit per request |
| **Slug auto-redirect** | Slug changes on content types automatically create a redirect from the old URL |
| **Chain & cycle detection** | Blocks saves that would create chains longer than 10 hops or redirect cycles |
| **Orphan redirect queue** | Deleted content creates a pending entry so you can redirect or dismiss its old URL |

## Requirements

- Strapi `>=5.0.0 <6.0.0`
- Node.js `>=20.0.0` (Strapi v5 requirement)

---

## Installation

```bash
npm install strapi-plugin-redirect-manager
```

Add to `config/plugins.ts`:

```ts
export default {
  'redirect-manager': {
    enabled: true,
  },
};
```

Rebuild and restart:

```bash
npm run build
npm run develop
```

The plugin appears in the left sidebar as **Redirect Manager**.

---

## User Guide

### 1. Creating a redirect

1. Click **Redirect Manager** in the sidebar.
2. Click **New Redirect** (top right).
3. Fill in the form:

   | Field | Description | Example |
   |---|---|---|
   | From | Source path — must start with `/` | `/old-page` |
   | To | Destination path — must start with `/` | `/new-page` |
   | Type | `301 — Permanent` or `302 — Temporary` | `301 — Permanent` |
   | Active | Whether the redirect is live | On |
   | Comment | Optional note for your team | `SEO migration 2026-03` |

4. Click **Create**.

The redirect is immediately active — no deploy needed.

> **Note:** External URLs (`https://example.com`) are not accepted in the **To** field. The plugin only handles internal path redirects.

---

### 2. Editing or deleting a redirect

- Click the **pencil icon** on any row to edit.
- Click the **trash icon** to delete (a confirmation dialog appears).
- Use the **toggle** in the Active column to pause/resume a redirect without deleting it.

---

### 3. Setting up slug auto-redirect

When a content entry's slug changes, the plugin can automatically create a redirect from the old URL to the new one.

1. Go to **Settings → Redirect Manager → Configuration**.
2. Make sure **Auto-create redirect when slug changes** is **On**.
3. In the Content Types table, find the content type you want to track.
4. Check the **Enabled** checkbox for that row.
5. Select the **Slug Field** (must be a `string` or `uid` attribute).
6. Optionally enter a **URL Prefix** (e.g. `/blog`).
7. Click **Save**.

**Example:** With URL prefix `/blog` and slug field `slug`, changing an article's slug from `my-post` to `updated-post` automatically creates:

```
/blog/my-post  →  /blog/updated-post  (301)
```

> **Draft & Publish:** Auto-redirects are only created for entries that have been published at least once. Drafts that have never been published are skipped.

---

### 4. Managing orphan redirects

When a tracked content entry is deleted, its URL becomes a dead end (404). The plugin captures this as a **pending orphan** so you can decide what to do.

1. From the Redirect Manager page, click **Orphan Redirects** (top right).
2. You'll see a list of deleted content URLs with their original content type and slug.
3. For each entry, choose:

   - **Resolve** — Enter a destination path and click **Create Redirect**. A 301 redirect is created. Any existing redirects that pointed to the old URL are automatically updated to point to the new destination (chain flattening).
   - **Dismiss** — Ignore the orphan. No redirect is created.

---

### 5. Settings reference

Go to **Settings → Redirect Manager → Configuration**.

| Setting | Default | Description |
|---|---|---|
| Auto-create redirect when slug changes | On | Creates a redirect automatically when a tracked content slug is updated |
| Enable chain detection | On | Blocks saves that would create chains longer than 10 hops or cycles |
| Enable orphan redirect tracking | On | Creates a pending orphan entry when tracked content is deleted |

**Content Types table:**

| Column | Description |
|---|---|
| Content Type | Your Strapi model (e.g. `Article`) |
| Enabled | Whether this content type participates in auto-redirect and orphan tracking |
| Slug Field | The attribute used as the URL slug |
| URL Prefix | Prepended to the slug to form the full path (e.g. `/blog`) |

---

## How the redirect works at runtime

The plugin registers a Koa middleware that runs on every HTTP request:

1. Normalizes the request path (trailing slashes are stripped: `/foo/` → `/foo`).
2. Looks up the normalized path in an in-memory cache (`Map<from, {to, type}>`). Matching is **exact** — no regex or wildcards.
3. If a match is found → responds with the configured status code (301 or 302) and a `Location` header.
4. If no match → passes the request to the next handler.

The cache is populated lazily on first request and invalidated automatically whenever redirects are created, updated, deleted, or toggled.

---

## Security

- All routes require a valid Strapi admin JWT — no public endpoints.
- `from` and `to` must start with `/`. External URLs and protocol-relative URLs (`//`) are rejected.
- The middleware skips any cached entry whose `to` value starts with `http://` or `https://`.
- Error responses never expose stack traces or internal file paths.

---

## API reference

All endpoints require admin authentication (`type: 'admin'`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/redirect-manager/redirects` | List all redirects |
| `POST` | `/redirect-manager/redirects` | Create a redirect |
| `GET` | `/redirect-manager/redirects/:id` | Get a redirect |
| `PUT` | `/redirect-manager/redirects/:id` | Update a redirect |
| `DELETE` | `/redirect-manager/redirects/:id` | Delete a redirect |
| `PUT` | `/redirect-manager/redirects/:id/toggle` | Toggle active state |
| `GET` | `/redirect-manager/settings` | Get plugin settings |
| `POST` | `/redirect-manager/settings` | Save plugin settings |
| `GET` | `/redirect-manager/content-types` | List trackable content types |
| `GET` | `/redirect-manager/orphan-redirects` | List pending orphan redirects |
| `PUT` | `/redirect-manager/orphan-redirects/:id/resolve` | Resolve an orphan |
| `PUT` | `/redirect-manager/orphan-redirects/:id/dismiss` | Dismiss an orphan |

---

## Out of scope (v1)

Regex/wildcard matching, external URL redirects, CSV import/export, locale-aware redirects, analytics tracking, A/B redirects.

---

## License

MIT
