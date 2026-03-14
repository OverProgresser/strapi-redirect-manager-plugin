# Strapi Plugin: Redirect Manager - Mimari Dokümantasyonu

> **Plugin Adı:** `strapi-plugin-redirect-manager`
> **Versiyon:** 1.0.1
> **Strapi Uyumluluğu:** v5.21.0+
> **Lisans:** MIT

---

## Genel Bakış

Strapi v5 için yazılmış bir URL redirect (301/302) yönetim plugini. Bir content type'daki slug değiştiğinde otomatik redirect kaydı oluşturup, eski URL'lerin yeni URL'lere yönlendirilmesini sağlar.

---

## Klasör Yapısı

```
strapi-redirect-manager-plugin/
├── plugin.ts                        # Alternatif admin register (Settings section olarak)
├── package.json                     # v1.0.1, Strapi 5.21.0 peer dep
├── bitbucket-pipelines.yml          # CI/CD - npm publish
│
├── admin/src/                       # Admin Panel (React)
│   ├── index.ts                     # Plugin register + menu link + i18n
│   ├── pluginId.ts                  # Sabit: "redirect-manager"
│   ├── components/
│   │   ├── Initializer.tsx          # Plugin init lifecycle
│   │   └── PluginIcon.tsx           # PuzzlePiece ikonu
│   ├── pages/
│   │   ├── App.tsx                  # Router (sadece HomePage)
│   │   ├── HomePage.tsx             # Settings bileşenini render eder
│   │   └── Settings.tsx             # Ana UI - content type ayarları tablosu
│   ├── utils/getTranslation.ts      # i18n yardımcı fonksiyon
│   └── translations/en.json         # İngilizce çeviriler
│
└── server/src/                      # Backend (Koa/Strapi)
    ├── index.ts                     # Tüm server modüllerini export eder
    ├── register.ts                  # content-api route'larını register eder
    ├── bootstrap.ts                 # DB lifecycle hooks (slug watcher - ana mekanizma)
    ├── destroy.ts                   # Boş (scaffold)
    ├── config/index.ts              # Boş config (scaffold)
    ├── content-types/
    │   └── redirect/redirect.ts     # "redirect" collection type şeması
    ├── controllers/
    │   ├── controller.ts            # Welcome mesajı (varsayılan scaffold)
    │   ├── redirect.ts              # Ana controller - 7 endpoint
    │   └── index.ts
    ├── routes/
    │   ├── content-api.ts           # GET / (welcome)
    │   ├── redirect.ts              # 7 adet redirect route tanımı
    │   └── index.ts
    ├── services/
    │   ├── service.ts               # Welcome service (varsayılan scaffold)
    │   ├── redirect.ts              # Ana iş mantığı servisi
    │   └── index.ts
    ├── hooks/slugWatcher.ts         # Tamamen yorum satırında (kullanılmıyor)
    ├── middlewares/index.ts         # Boş (scaffold)
    └── policies/index.ts            # Boş (scaffold)
```

---

## Veri Modeli

### `plugin::redirect-manager.redirect` (collectionType)

| Alan           | Tip    | Zorunlu | Default | Açıklama                          |
|----------------|--------|---------|---------|-----------------------------------|
| `contentType`  | string | Evet    | -       | Örn: `api::article.article`       |
| `oldSlug`      | string | Evet    | -       | Eski URL slug                     |
| `newSlug`      | string | Evet    | -       | Yeni URL slug                     |
| `redirectType` | string | Evet    | `"301"` | `301` veya `302`                  |
| `comment`      | text   | Hayır   | -       | Açıklama notu                     |

- `draftAndPublish: false` - Doğrudan yayınlanır, taslak yok.
- `timestamps: true` - `createdAt` ve `updatedAt` otomatik eklenir.

### Plugin Store (Ayarlar)

Ayarlar `strapi.store` üzerinde `plugin::redirect-manager` namespace'inde `settings` key'i ile tutulur:

```json
{
  "enabledContentTypes": {
    "api::article.article": { "enabled": true, "slugField": "slug" },
    "api::page.page": { "enabled": false, "slugField": null }
  }
}
```

---

## Çekirdek Mekanizma: Otomatik Slug Takibi

**Dosya:** `server/src/bootstrap.ts`

DB lifecycle hook'ları ile çalışır:

### 1. `beforeUpdate`
- Yalnızca `api::` ile başlayan content type'larda tetiklenir
- Plugin ayarlarından ilgili content type'ın aktif olup olmadığını ve slugField'ını kontrol eder
- Güncelleme öncesi mevcut slug değerini `event.state.oldSlug`'a kaydeder

### 2. `afterUpdate`
- `draftAndPublish` aktifse sadece publish edilmiş entry'lerde çalışır
- Slug değiştiyse:
  1. **Ters redirect'leri siler** (newSlug → oldSlug yönündekiler) - döngü önleme
  2. **Yeni 301 redirect kaydı oluşturur** (oldSlug → newSlug)
  3. Otomatik yorum ekler: `"Auto-created from {old} to {new}"`

---

## API Endpoint'leri

Tüm route'lar `/api/redirect-manager/` prefix'i altında, `content-api` tipindedir.

| Method | Path                             | Handler                    | Açıklama                                          |
|--------|----------------------------------|----------------------------|---------------------------------------------------|
| GET    | `/settings`                      | `redirect.getSettings`     | Plugin ayarlarını getir                            |
| POST   | `/settings`                      | `redirect.saveSettings`    | Ayarları kaydet (`enabledContentTypes` body)       |
| GET    | `/content-types`                 | `redirect.getContentTypes` | `api::` content type'ları ve attribute'larını listele |
| GET    | `/redirect?contentType=&oldSlug=`| `redirect.getRedirect`     | Tek redirect sorgula (chain resolution ile)        |
| GET    | `/redirect/all`                  | `redirect.getAllRedirect`  | Tüm redirect'leri getir (max 500, filtrelenmiş)    |
| POST   | `/redirect`                      | `redirect.createRedirect`  | Manuel redirect oluştur (`data` body)              |
| GET    | `/content/:contentType/:slug`    | `redirect.findContentBySlug`| Slug ile content bul (redirect chain takibi ile)  |

---

## Redirect Zincirleme (Chain Resolution)

**Dosya:** `server/src/services/redirect.ts` → `resolveRedirect()`

Bir slug sorgulandığında zincir takibi yapılır:
- **4 varyasyon** paralel sorgulanır: `slug`, `/slug`, `slug/`, `/slug/`
- Zincir sonuna kadar takip edilir (A→B→C ise A sorgulandığında C döner)
- `visitedSlugs` Set'i ile **sonsuz döngü önlenir**

### `getAllRedirects()` Filtreleme
- Limit: 500 kayıt
- **Filtre:** Yalnızca slug'ı birden fazla `/` segment içerenler döner (`oldSlug.split("/").filter(Boolean).length > 1`)

---

## Admin UI

**Ana Bileşen:** `admin/src/pages/Settings.tsx`

- Tüm `api::` collection type'ları tabloda listeler
- Her content type için:
  - **Checkbox:** Redirect takibini aç/kapat
  - **SingleSelect:** Slug field seçimi (string veya uid tipli alanlar)
- `@strapi/design-system` bileşenleri kullanır (Table, Checkbox, SingleSelect, vb.)
- `useFetchClient` ile API çağrıları yapar
- `useNotification` ile başarı/hata bildirimleri gösterir

### Navigasyon
- Sol menüde "redirect-manager" altında listelenir (PluginIcon: PuzzlePiece)
- Settings section'da da "Redirect Manager Settings" olarak görünür (plugin.ts üzerinden)

---

## Bilinen Sorunlar ve İyileştirme Alanları

### 1. Güvenlik - Kritik
- **Tüm API route'ları `auth: false`** olarak tanımlı
- Herhangi bir kimlik doğrulama veya yetkilendirme yok
- Dışarıdan herkes redirect oluşturabilir, ayarları değiştirebilir, tüm redirect'leri okuyabilir

### 2. Çift Register Sorunu
- `plugin.ts` dosyası Settings section olarak register yapıyor
- `admin/src/index.ts` ise menu link olarak register yapıyor
- İki farklı giriş noktası çakışma yaratabilir

### 3. Kullanılmayan Dosyalar
- `server/src/hooks/slugWatcher.ts` - Tamamen yorum satırında, aynı iş `bootstrap.ts`'de yapılıyor
- `server/src/services/service.ts` - Sadece welcome mesajı, gerçek işlev yok
- `server/src/controllers/controller.ts` - Sadece welcome mesajı
- `server/src/routes/content-api.ts` - Sadece GET / welcome endpoint
- `middlewares/index.ts`, `policies/index.ts`, `destroy.ts`, `config/index.ts` - Boş scaffold'lar

### 4. getAllRedirects Filtreleme Mantığı
- Yalnızca çok segmentli slug'lar dönüyor (`/blog/my-post` evet, `my-post` hayır)
- Bu filtreleme mantığının amacı belirsiz ve dokümante edilmemiş
- Limit 500 sabit kodlanmış, sayfalama (pagination) yok

### 5. Hata Yönetimi
- `console.error` ile loglanıyor ama merkezi bir hata yönetimi yok
- `findContentBySlug` içinde redirect bulunamadığında `console.error` kullanılıyor (bu aslında normal bir durum, error değil)

### 6. CI/CD
- Bitbucket Pipelines ile npm'e publish ediliyor
- Node 18 image kullanıyor
- Master branch'e merge'de: build, security scan, npm publish

---

## Bağımlılıklar

### Peer Dependencies (Zorunlu)
- `@strapi/strapi: 5.21.0`
- `@strapi/sdk-plugin: ^5.3.2`
- `react: ^18.0.0`, `react-dom: ^18.0.0`
- `react-router-dom: ^6.0.0`
- `styled-components: 6.1.15`

### Dev Dependencies
- `typescript: ^5.0.0`
- `prettier: ^3.5.3`
- `@strapi/typescript-utils: 5.11.0`
