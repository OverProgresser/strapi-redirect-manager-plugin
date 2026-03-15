# Strapi Redirect Manager Plugin

A production-ready redirect management plugin for **Strapi v5**.
Manage 301/302 redirects from the admin panel, automatically create redirects when content slugs change, detect redirect chains, and track orphaned URLs from deleted content.

## Features

- **Manual redirect CRUD** — Create, edit, delete, and toggle 301/302 redirects from the admin panel
- **Runtime middleware** — Intercepts requests at the server level with an in-memory cache for performance
- **Slug auto-redirect** — When a content type's slug field changes, a redirect is automatically created from the old URL to the new one
- **Chain detection** — Prevents redirect chains longer than 10 hops and detects cycles before they are saved
- **Orphan redirect tracking** — When slug-tracked content is deleted, a pending orphan entry is created so you can decide where to redirect the old URL
- **Plugin settings** — Configure which content types participate in auto-redirect, set URL prefixes per content type, and toggle each feature independently

## Requirements

- Strapi v5 (`>=5.0.0 <6.0.0`)
- Node.js `>=18.0.0`

## Installation

```bash
npm install strapi-plugin-redirect-manager
```

Add to your Strapi project's `config/plugins.ts` (or `.js`):

```ts
export default {
  'redirect-manager': {
    enabled: true,
  },
};
```

## Usage

### Admin Panel

After installing, the plugin appears in the left sidebar as **Redirect Manager**.

#### Redirect List

- View all redirects in a table (`from`, `to`, `type`, active status)
- Add new redirects with the **New Redirect** button
- Edit or delete existing redirects
- Toggle individual redirects on/off without deleting them

#### Orphan Redirects

Accessible via the **Orphan Redirects** button in the header. When content with a tracked slug is deleted, a pending entry appears here. You can:

- **Resolve** — Enter a destination path and create a 301 redirect. Any existing redirects that pointed to the orphan's old URL are automatically updated to point to the new destination (chain flattening).
- **Dismiss** — Mark as dismissed without creating a redirect

#### Settings

Found under **Settings > Redirect Manager > Configuration**.

| Setting | Description |
|---|---|
| Auto-redirect on slug change | Create a redirect automatically when a content slug changes |
| Chain detection | Block saves that would create chains longer than 10 hops or cycles |
| Orphan redirect tracking | Create pending orphan entries when slug-tracked content is deleted |
| Content types | Enable per content type, select the slug field, and set an optional URL prefix |

### Slug Auto-Redirect Setup

1. Go to **Settings > Redirect Manager > Configuration**
2. Enable **Auto-redirect on slug change**
3. In the Content Types table, enable a content type (e.g. `api::article.article`)
4. Select the slug field (must be a `string` or `uid` attribute)
5. Optionally set a URL prefix (e.g. `/blog`)

Now when an article's slug changes from `my-post` to `my-updated-post`, a redirect `/blog/my-post → /blog/my-updated-post` is created automatically.

**Note:** Redirects are only created for published entries when `draftAndPublish` is enabled on the content type.

## Security

- All admin routes are protected by Strapi's admin JWT — no public access
- `from` and `to` fields must start with `/` — external URLs and protocol-relative URLs are rejected
- No stack traces or internal paths are exposed in error responses
- The `Location` response header is never set directly from raw user input

## API Routes

All routes require admin authentication (`type: 'admin'`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/redirect-manager/redirects` | List all redirects |
| `POST` | `/redirect-manager/redirects` | Create redirect |
| `GET` | `/redirect-manager/redirects/:id` | Get single redirect |
| `PUT` | `/redirect-manager/redirects/:id` | Update redirect |
| `DELETE` | `/redirect-manager/redirects/:id` | Delete redirect |
| `PUT` | `/redirect-manager/redirects/:id/toggle` | Toggle active state |
| `GET` | `/redirect-manager/settings` | Get plugin settings |
| `POST` | `/redirect-manager/settings` | Save plugin settings |
| `GET` | `/redirect-manager/content-types` | List available content types |
| `GET` | `/redirect-manager/orphan-redirects` | List pending orphan redirects |
| `PUT` | `/redirect-manager/orphan-redirects/:id/resolve` | Resolve orphan (creates redirect) |
| `PUT` | `/redirect-manager/orphan-redirects/:id/dismiss` | Dismiss orphan |

## Out of Scope

CSV bulk import, locale-aware redirects, A/B redirects, analytics, regex/wildcard matching, import/export.

## License

MIT
