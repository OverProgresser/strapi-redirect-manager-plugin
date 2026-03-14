# Strapi Redirect Manager Plugin

## Proje Bağlamı
Sıfırdan geliştirilen, Strapi Marketplace için hazırlanacak bağımsız bir 301/302 redirect yönetim plugin'i.
Hedef: Strapi v5 uyumlu, production-ready, npm'de yayınlanabilir plugin.

@package.json

## Strapi MCP — ZORUNLU KULLANIM
Bu projede Strapi MCP server bağlı. Strapi v5 API'sine dair herhangi bir şey yazmadan önce MCP'ye sor.
Training data'daki v4 pattern'leri v5'te bozulmuş olabilir. MCP'yi atlamak yasak.

## Dizin Yapısı
> Henüz scaffold oluşturulmadı. Aşağıdaki yapı hedef mimariye göre oluşturulacak.

```
admin/src/
  index.ts               # Plugin register, menu link, i18n
  pluginId.ts            # Sabit: "redirect-manager"
  components/
    Initializer.tsx
    PluginIcon.tsx
  pages/
    App.tsx
    HomePage.tsx
    Settings.tsx          # Ana UI — content type tablosu + ayarlar
  translations/en.json
  utils/getTranslation.ts

server/src/
  index.ts
  register.ts
  bootstrap.ts           # Lifecycle hooks — slug değişim takibi
  destroy.ts
  config/index.ts
  content-types/
    index.ts
    redirect/redirect.ts  # Redirect şeması (TS, JSON değil)
  controllers/
    index.ts
    redirect.ts           # Endpoint handler'lar
  middlewares/index.ts    # Runtime redirect middleware
  policies/index.ts
  routes/
    index.ts
    redirect.ts           # Route tanımları
  services/
    index.ts
    redirect.ts           # CRUD, chain resolution, settings
```

## Kodlama Standartları
- TypeScript strict mode — `any` kullanma
- `strapi.db.query()` kullan — `entityService` v5'te deprecated
- Content-type UID pattern: `plugin::redirect-manager.<type>`
- 2-space indent, single quotes, trailing commas
- Async/await — raw Promise yok
- Şemalar TypeScript dosyasında tanımlanır, `schema.json` kullanılmaz

## Geliştirme Sırası (Fazalar)

1. **Faza 1** — Scaffold + temel kurulum: `package.json`, `LICENSE`, `README.md`, dizin yapısı
2. **Faza 2** — Runtime redirect middleware (`middlewares/index.ts` — sıfırdan yazılacak)
3. **Faza 3** — Plugin Settings sayfası (URL prefix mapping dahil)
4. **Faza 4** — Chain detection — `services/redirect.ts`
5. **Faza 5** — Orphan redirect listesi — yeni content-type + UI

## Güvenlik Gereksinimleri (Tüm Fazalarda Geçerli)
- Admin-only endpoint'ler: settings (GET+POST), content-types (GET), redirect oluşturma (POST)
- Public endpoint'ler: redirect sorgulama (GET /redirect, GET /redirect/all, GET /content/:ct/:slug)
- Public endpoint'lere input validation zorunlu (contentType formatı, slug uzunluk limiti)

## Build & Test Komutları
```bash
npm run build          # strapi-plugin build
npm run watch          # dev watch mode
npm run watch:link     # linked development
npm run verify         # plugin verify
npm run test:ts:front  # tsc admin/tsconfig.json
npm run test:ts:back   # tsc server/tsconfig.json
```

## Git Workflow
- Branch per Faza: `faza/1-scaffold`, `faza/2-middleware`, vb.
- Commit style: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Her commit öncesi `test:ts:front` + `test:ts:back` geçmeli

## Kapsam Dışı (Bu Versiyon)
CSV bulk import, locale-aware redirect, A/B redirect, analytics tracking.
