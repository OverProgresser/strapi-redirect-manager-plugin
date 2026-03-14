# Codebase Audit Raporu

> **Tarih:** 2026-03-15
> **Plugin:** `strapi-plugin-redirect-manager@1.0.1`
> **Konum:** `temp-source/strapi-redirect-manager-plugin/`

---

## 1. Dizin Yapısı

```
.
├── .editorconfig
├── .eslintignore
├── .gitignore
├── .prettierignore
├── .prettierrc
├── README.md
├── bitbucket-pipelines.yml
├── custom.d.ts
├── package.json
├── package-lock.json
├── plugin.ts
├── yarn.lock
│
├── admin/
│   ├── custom.d.ts
│   ├── tsconfig.build.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── pluginId.ts
│       ├── components/
│       │   ├── Initializer.tsx
│       │   └── PluginIcon.tsx
│       ├── pages/
│       │   ├── App.tsx
│       │   ├── HomePage.tsx
│       │   └── Settings.tsx
│       ├── translations/
│       │   └── en.json
│       └── utils/
│           └── getTranslation.ts
│
└── server/
    ├── custom.d.ts
    ├── tsconfig.build.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── register.ts
        ├── bootstrap.ts
        ├── destroy.ts
        ├── config/
        │   └── index.ts
        ├── content-types/
        │   ├── index.ts
        │   └── redirect/
        │       └── redirect.ts
        ├── controllers/
        │   ├── index.ts
        │   ├── controller.ts
        │   └── redirect.ts
        ├── hooks/
        │   └── slugWatcher.ts
        ├── middlewares/
        │   └── index.ts
        ├── policies/
        │   └── index.ts
        ├── routes/
        │   ├── index.ts
        │   ├── content-api.ts
        │   └── redirect.ts
        └── services/
            ├── index.ts
            ├── service.ts
            └── redirect.ts
```

---

## 2. package.json (Tam İçerik)

```json
{
  "name": "strapi-plugin-redirect-manager",
  "version": "1.0.1",
  "type": "commonjs",
  "exports": {
    "./package.json": "./package.json",
    "./strapi-admin": {
      "types": "./dist/admin/src/index.d.ts",
      "source": "./admin/src/index.ts",
      "import": "./dist/admin/index.mjs",
      "require": "./dist/admin/index.js",
      "default": "./dist/admin/index.js"
    },
    "./strapi-server": {
      "types": "./dist/server/src/index.d.ts",
      "source": "./server/src/index.ts",
      "import": "./dist/server/index.mjs",
      "require": "./dist/server/index.js",
      "default": "./dist/server/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "strapi-plugin build",
    "watch": "strapi-plugin watch",
    "watch:link": "strapi-plugin watch:link",
    "verify": "strapi-plugin verify",
    "test:ts:front": "run -T tsc -p admin/tsconfig.json",
    "test:ts:back": "run -T tsc -p server/tsconfig.json"
  },
  "dependencies": {},
  "devDependencies": {
    "prettier": "^3.5.3",
    "@strapi/typescript-utils": "5.11.0",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/react-router-dom": "^5.3.3",
    "@types/styled-components": "^5.1.34",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "@strapi/strapi": "5.21.0",
    "styled-components": "6.1.15",
    "@strapi/sdk-plugin": "^5.3.2"
  },
  "resolutions": {
    "esbuild": "0.20.2"
  },
  "strapi": {
    "kind": "plugin",
    "name": "redirect-manager",
    "displayName": "Strapi Redirection ",
    "description": "It redirects the content in strapi."
  },
  "keywords": ["Strapi", "Plugin", "Redirects", "Auto Redirects Manager"],
  "description": "It redirects the content in strapi.",
  "license": "MIT",
  "author": "Team Make.Digital <dev@makestories.io>"
}
```

---

## 3. Kaynak Dosya Listesi (src/ altındaki .ts/.tsx/.js)

### Server Tarafı (server/src/)

| Dosya | Açıklama |
|-------|----------|
| `index.ts` | Tüm server modüllerini birleştirip export eder |
| `register.ts` | content-api route'larını plugin'e register eder |
| `bootstrap.ts` | DB lifecycle hooks - otomatik slug takibi |
| `destroy.ts` | Boş (scaffold) |
| `config/index.ts` | Boş config (scaffold) |
| `content-types/index.ts` | redirect content type'ı export eder |
| `content-types/redirect/redirect.ts` | Redirect collection type şeması |
| `controllers/index.ts` | Controller'ları export eder |
| `controllers/controller.ts` | Welcome mesajı (scaffold) |
| `controllers/redirect.ts` | Ana controller - 7 endpoint handler |
| `hooks/slugWatcher.ts` | Tamamen yorum satırında (kullanılmıyor) |
| `middlewares/index.ts` | Boş export (scaffold) |
| `policies/index.ts` | Boş export (scaffold) |
| `routes/index.ts` | Route tanımlarını birleştirir |
| `routes/content-api.ts` | GET / welcome route |
| `routes/redirect.ts` | 7 adet redirect route tanımı |
| `services/index.ts` | Service'leri export eder |
| `services/service.ts` | Welcome service (scaffold) |
| `services/redirect.ts` | Ana iş mantığı - CRUD, chain resolution, settings |

### Admin Tarafı (admin/src/)

| Dosya | Açıklama |
|-------|----------|
| `index.ts` | Plugin register + menu link + i18n trads |
| `pluginId.ts` | Sabit: `"redirect-manager"` |
| `components/Initializer.tsx` | Plugin init lifecycle hook |
| `components/PluginIcon.tsx` | PuzzlePiece ikonu |
| `pages/App.tsx` | React Router (sadece HomePage) |
| `pages/HomePage.tsx` | Settings bileşenini render eder |
| `pages/Settings.tsx` | Ana UI - content type ayarları tablosu |
| `utils/getTranslation.ts` | i18n yardımcı fonksiyon |
| `translations/en.json` | İngilizce çeviri dosyası |

---

## 4. Content Type Şeması

### `server/src/content-types/redirect/redirect.ts`

```typescript
export default {
  kind: "collectionType",
  collectionName: "redirects",
  info: {
    singularName: "redirect",
    pluralName: "redirects",
    displayName: "Redirect",
  },
  options: {
    draftAndPublish: false,
    timestamps: true,
  },
  attributes: {
    contentType: { type: "string", required: true },
    oldSlug: { type: "string", required: true },
    newSlug: { type: "string", required: true },
    redirectType: { type: "string", required: true, default: "301" },
    comment: { type: "text" },
  },
};
```

### `server/src/content-types/index.ts`

```typescript
import redirect from "./redirect/redirect";

export default {
  'redirect': {
    schema: redirect
  },
};
```

> **Not:** Şema JSON dosyası (`schema.json`) olarak değil, doğrudan TypeScript'te tanımlanmış.

---

## 5. Middleware Dosyası

### `server/src/middlewares/index.ts`

```typescript
export default {};
```

> **Durum:** Tamamen boş. Hiçbir middleware tanımlanmamış. README'de bahsedilen "Auto Middleware: Handles redirects at runtime" özelliği implement edilmemiş.

---

## 6. bootstrap.ts ve register.ts

### `server/src/register.ts`

```typescript
import { Core } from '@strapi/strapi';
import redirectRoutes from './routes/redirect';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  console.log('📦 Registering Redirect Manager content-api routes');

  const plugin = strapi.plugin('redirect-manager');

  if (!plugin.routes['content-api']) {
    plugin.routes['content-api'] = {
      type: 'content-api',
      routes: [],
    };
  }

  plugin.routes['content-api'].routes.push(...redirectRoutes);
};
```

**Ne yapıyor:**
- Plugin'in content-api route section'ını kontrol eder, yoksa oluşturur
- `routes/redirect.ts`'deki 7 route tanımını bu section'a ekler

---

### `server/src/bootstrap.ts`

```typescript
import { Core } from '@strapi/strapi';

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  const redirectService = strapi.plugin('redirect-manager').service('redirect');

  strapi.db.lifecycles.subscribe({
    async beforeUpdate(event) {
      const { model, params } = event as any;
      const uid = model.uid;

      if (!uid.startsWith('api::')) return;

      try {
        const settings = await redirectService.getSettings();
        const config = settings.enabledContentTypes?.[uid];
        if (!config?.enabled || !config.slugField) return;

        const prevEntry = await strapi.db.query(uid).findOne({
          where: { id: params.where.id },
          select: [config.slugField],
        });

        event.state = { oldSlug: prevEntry?.[config.slugField] };
      } catch (error) {
        console.error(`Redirect Manager Error in beforeUpdate for ${uid}:`, error);
      }
    },

    async afterUpdate(event) {
      const { model, result, state } = event as any;
      const uid = model.uid;

      if (!uid.startsWith('api::')) return;

      const isDraftAndPublish = model.options?.draftAndPublish;
      const isPublished = !!result.publishedAt;
      if (isDraftAndPublish && !isPublished) return;

      try {
        const settings = await redirectService.getSettings();
        const config = settings.enabledContentTypes?.[uid];
        if (!config?.enabled || !config.slugField) return;

        const oldSlug = state?.oldSlug;
        const newSlug = result[config.slugField];

        if (oldSlug && newSlug && oldSlug !== newSlug) {
          // Ters redirect'leri siler (döngü önleme)
          await strapi.db.query('plugin::redirect-manager.redirect').deleteMany({
            where: {
              contentType: uid,
              oldSlug: newSlug,
            },
          });

          // Yeni redirect kaydı oluşturur
          await redirectService.createRedirect({
            contentType: uid,
            oldSlug,
            newSlug,
            redirectType: '301',
            comment: `Auto-created from ${oldSlug} to ${newSlug}`,
          });
        }
      } catch (error) {
        console.error(`[Redirect Manager] Error in afterUpdate for ${uid}:`, error);
      }
    },
  });
};
```

**Ne yapıyor:**
1. **beforeUpdate** - Güncelleme öncesi eski slug değerini event state'e kaydeder
2. **afterUpdate** - Slug değiştiyse ters redirect'leri temizler ve yeni 301 redirect oluşturur

---

## 7. Admin Panel Dosya Listesi

### pages/ (3 dosya)

| Dosya | Satır | Rol |
|-------|-------|-----|
| `App.tsx` | 15 | React Router - tek route (HomePage), hata sayfası |
| `HomePage.tsx` | 17 | Settings bileşenini `<Main>` içinde render eder |
| `Settings.tsx` | 235 | Ana UI bileşeni - content type tablosu, checkbox, select |

### components/ (2 dosya)

| Dosya | Satır | Rol |
|-------|-------|-----|
| `Initializer.tsx` | 40 | `setPlugin(PLUGIN_ID)` çağırarak plugin'i hazır işaretler |
| `PluginIcon.tsx` | 12 | `@strapi/icons` PuzzlePiece ikonunu export eder |

---

## Ek Gözlemler

### Kullanılan Strapi Design System Bileşenleri (Settings.tsx)
`Box`, `Button`, `Checkbox`, `Flex`, `Main`, `Select`, `Typography`, `Alert`, `Loader`, `Card`, `CardBody`, `CardHeader`, `CardTitle`, `Table`, `Thead`, `Tbody`, `Tr`, `Th`, `Td`, `SingleSelect`, `SingleSelectOption`, `Grid`

### Import edilen ama kullanılmayan bileşenler (Settings.tsx)
`Select`, `Alert`, `Card`, `CardBody`, `CardHeader`, `CardTitle`, `Grid`, `Information` ikonu

### Kullanılan Strapi Admin Hook'ları
- `useFetchClient` - API çağrıları için
- `useNotification` - Toast bildirimleri için

### Eksik `toggleNotification` tanımı
`Settings.tsx` satır 147'de `useNotification()` çağrılıyor ama satır 128-138'de daha önce kullanılıyor. Hoisting sayesinde çalışıyor ancak okunabilirlik açısından sorunlu.
