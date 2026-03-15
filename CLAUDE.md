# Strapi Redirect Manager Plugin

## Proje Bağlamı
Sıfırdan geliştirilen, bağımsız bir Strapi v5 redirect yönetim plugin'i.
Hedef: Strapi Marketplace'te genel kullanıma açık yayın.
Lisans: MIT

## Strapi MCP — ZORUNLU KULLANIM
Bu projede Strapi MCP server bağlı. Strapi v5 API'sine dair herhangi bir şey
yazmadan önce MCP'ye sor. Training data'daki v4 pattern'leri v5'te bozulmuş
olabilir. MCP'yi atlamak yasak.

## Tech Stack
- **Plugin scaffold:** `@strapi/sdk-plugin`
- **Runtime:** Node.js >=18.0.0, TypeScript strict
- **Admin UI:** Strapi Design System v2 (`@strapi/design-system`)
- **Build:** `strapi-plugin build` / `strapi-plugin watch`
- **Type check:** `tsc --noEmit` (ayrı front + back tsconfig)

## Dizin Yapısı
```
admin/src/
  index.ts              — plugin admin registration (settings section)
  pages/Settings.tsx    — settings UI (content-type toggles, prefix map)
  pages/HomePage.tsx    — plugin ana sayfası
  pages/App.tsx         — admin router
  components/           — Initializer, PluginIcon
  pluginId.ts           — plugin ID sabiti
server/src/
  index.ts              — server entry (exports register, bootstrap, routes, etc.)
  register.ts           — middleware + lifecycle hook kayıtları
  bootstrap.ts          — slug auto-redirect lifecycle hooks
  controllers/redirect.ts — CRUD + settings endpoints
  services/redirect.ts  — DB query layer (strapi.db.query)
  routes/redirect.ts    — admin route definitions (type: 'admin')
  content-types/redirect/ — redirect schema
  types/redirect.ts     — PluginSettings, Redirect interfaces
```

## Özellikler & Content-Type Tasarımı
Detaylı özellik açıklamaları ve content-type şemaları için bkz. **PRD.md**.
Özet: Manuel redirect CRUD, runtime middleware, slug auto-redirect,
chain detection, orphan redirect, settings sayfası.

## Geliştirme Sırası (Fazalar)
1. ✅ **Faza 1** — Scaffold + package.json + proje iskelet
2. ✅ **Faza 2** — `redirect` content-type + CRUD service/controller/route
3. ✅ **Faza 3** — Plugin Settings sayfası + slug auto-redirect (lifecycle hooks)
4. ✅ **Faza 4** — Runtime middleware (cache dahil)
5. **Faza 5** — Admin UI: redirect listesi + ekleme/düzenleme formu
6. **Faza 6** — Chain detection
7. **Faza 7** — Orphan redirect

## Kodlama Standartları
- TypeScript strict — `any` yasak
- `strapi.db.query(uid)` kullan — `entityService` deprecated
- Lifecycle state: `event.state` üzerinden taşı (module-level variable yasak)
- Content-type UID: `plugin::redirect-manager.<type>`
- `strapi.store()` ile settings sakla, namespace: `plugin_redirect-manager`
- 2-space indent, single quotes, trailing commas

## Build & Test Komutları
```bash
npm run build          # strapi-plugin build
npm run watch          # dev watch
npm run watch:link     # linked dev (host Strapi app ile)
npm run verify         # plugin verify
npm run test:ts:front  # tsc admin tsconfig
npm run test:ts:back   # tsc server tsconfig
```

## Dev Ortamı Kurulumu
Plugin'i test etmek için ayrı bir Strapi v5 host app gerekli:
1. Host app'te `npm install --save /path/to/301-redirect-strapi-plugin`
2. `plugins.ts`'e plugin'i ekle
3. Bu dizinde `npm run watch:link`, host app'te `npm run develop`

## Git Workflow
- **`staging` branch:** Tüm faza geliştirmeleri burada birleştirilir.
  Yeni özellikler `staging`'e merge edilir, hazır olunca `main`'e PR açılır.
- Commit style: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Her commit öncesi `test:ts:front` + `test:ts:back` geçmeli
- Remote: `https://github.com/OverProgresser/strapi-redirect-manager-plugin.git`

## Teknik Kısıtlar (PRD Bölüm 6-7)
- Controller'da input validation: boş string, yanlış tip, bilinmeyen alan kabul edilmez
- Tüm admin CRUD endpoint'leri Strapi admin JWT ile korumalı
- Tüm route'lar `type: 'admin'` — asla `content-api` + `auth: false` değil
- `type: 'admin'` route'lar `/${pluginId}/...` path'i altında serve edilir
- `@strapi/helper-plugin` kullanılmaz — import'lar `@strapi/strapi/admin`'den
- Notification type: `success`, `danger`, `info` — `warning` yok
- DS v2: Checkbox → `onCheckedChange`, Toggle → `onLabel` + `offLabel` zorunlu
- `from` ve `to` alanları `/` ile başlamalı — open redirect yasak
- `to` alanı dış domain kabul etmez (`http://`, `https://` ile başlayamaz)
- Controller hata response'larında stack trace veya internal path sızdırılmaz
- `Location` header'ına ham kullanıcı girdisi yazılmaz
- Middleware `register.ts`'te `strapi.server.use()` ile global kayıtlı
- Cache: redirect eklenince / güncellenince / silinince invalidate edilir
- Chain detection max derinlik: 10 hop

## Faza 3'ten Öğrenilenler (tekrar etme)
- Admin route URL'leri: `type: 'admin'` route'lar `/${pluginId}/settings` altında
  serve edilir — `/api/${pluginId}/settings` değil
- DS v2 Checkbox: `onChange` değil `onCheckedChange` kullanılır
- DS v2 Toggle: `onLabel` + `offLabel` prop'ları zorunlu; `onChange` native input event alır
- Settings sayfası `createSettingSection` ile register edilir:
  Settings > Redirect Manager > Configuration
- PluginSettings interface: `autoRedirectOnSlugChange`, `chainDetectionEnabled`,
  `orphanRedirectEnabled` toggle'ları + `enabledContentTypes` map'i

## Kapsam Dışı (Bu Versiyon)
CSV bulk import, locale-aware redirect, A/B redirect, analytics tracking,
regex/wildcard redirect, import/export.