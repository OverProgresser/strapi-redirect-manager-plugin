# Redirect Manager Plugin — Fix & Improvement Plan

> **Tarih:** 2026-03-15
> **Durum:** Planlama aşaması — tek tek implemente edilecek
> **Öncelik sırası:** Güvenlik → Güvenilirlik → Doğruluk → Temizlik

---

## Ortam Bağlamı (Karar Alma Rehberi)

- **Pre-prod:** Strapi admin panelinden **Save** → içerik draft olarak kaydedilir
- **Prod:** Strapi admin panelinden **Publish** → içerik yayınlanır, deploy tetiklenir
- İçerik güncellemeleri **Strapi admin paneli** üzerinden yapılıyor (REST API değil)
- Admin panel → Document Service API → DB Lifecycle Hooks zinciri geçerli

Bu bağlam tüm fix kararlarını etkiliyor. Özellikle FIX-3'te.

---

## FIX-1 — peerDependencies Versiyon Kısıtı

**Sorun:** `"@strapi/strapi": "5.21.0"` sabiti, 5.21.0 dışındaki her Strapi v5 kurulumunda peer dep hatası verir.

**Karar:** `">=5.0.0 <6.0.0"` olarak genişlet.

**Risk:** v5.0–v5.9 arasında bazı API'lerin farklı davranabileceği bilinmeli. Ancak plugin'in kullandığı `strapi.db.query()`, `strapi.store()`, `strapi.plugin()` ve `strapi.db.lifecycles.subscribe()` tümü v5 genelinde stabil. `@strapi/sdk-plugin` de `^5.3.2` olarak esnek.

**Değişecek dosya:** `package.json`

**Etkilenen satır:**
```json
// ÖNCE
"@strapi/strapi": "5.21.0"

// SONRA
"@strapi/strapi": ">=5.0.0 <6.0.0"
```

---

## FIX-2 — Güvenlik: Endpoint Kimlik Doğrulama

**Sorun:** Tüm 7 endpoint `auth: false`. Herhangi bir dış kaynak:
- `POST /api/redirect-manager/settings` → Plugin ayarlarını tamamen değiştirebilir
- `POST /api/redirect-manager/redirect` → Sahte redirect kaydı ekleyebilir
- `GET /api/redirect-manager/content-types` → Strapi iç content-type yapısını öğrenebilir

**Endpoint Sınıflandırması:**

| Endpoint | Yöntem | Mevcut | Olması Gereken | Gerekçe |
|----------|--------|--------|----------------|---------|
| `/settings` | GET | `auth:false` | **Admin only** | Sadece plugin UI kullanır |
| `/settings` | POST | `auth:false` | **Admin only** | Kritik konfigürasyon |
| `/content-types` | GET | `auth:false` | **Admin only** | İç yapı sızar |
| `/redirect` | GET | `auth:false` | **Public — korunur** | Frontend kullanıyor |
| `/redirect/all` | GET | `auth:false` | **Public — korunur** | Frontend kullanıyor |
| `/redirect` | POST | `auth:false` | **Admin only** | DB manipülasyonu riski |
| `/content/:ct/:slug` | GET | `auth:false` | **Public — korunur** | Frontend kullanıyor |

**Public kalan endpoint'ler için ek önlem:**
- Rate limiting (Strapi built-in veya middleware seviyesinde)
- Input validation (contentType formatı: `api::*.*`, slug uzunluk limiti)

**Uygulama Yöntemi:**

Strapi v5'te plugin route'larında admin auth şu şekilde uygulanır:

```typescript
// Admin-only endpoint için:
config: {
  policies: ['admin::isAuthenticatedAdmin'],
  auth: { scope: ['plugin::redirect-manager.redirect.saveSettings'] },
}

// Veya daha basit — Strapi v5 admin route pattern:
config: {
  auth: { scope: ['admin'] },
}
```

> **Not:** Strapi MCP'den doğru v5 policy/scope pattern'i sorgulanacak (FIX-2 implemente edilmeden önce).

**Değişecek dosya:** `server/src/routes/redirect.ts`

---

## FIX-3 — Document Service Lifecycle Uyumsuzluğu

**Sorun:** Plugin `strapi.db.lifecycles.subscribe()` ile `beforeUpdate/afterUpdate` dinliyor. Strapi v5'te admin panelinden yapılan işlemler şu zinciri izler:

```
Admin Panel
  → Document Service API (strapi.documents())
    → beforeUpdate / afterUpdate  ← sadece "draft save" için tetiklenir
    → Publish işlemi farklıdır:
       draft → published geçişi = DELETE draft + CREATE published
       yani: beforeCreate + afterCreate tetiklenir, beforeUpdate değil
```

**Sonuç:** Kullanıcı bir içeriği publish ederken slug değişmişse, plugin bunu **yakalayamıyor**.

**Ortam bağlamı:**
- **Save (pre-prod):** Slug değişikliği → `beforeUpdate/afterUpdate` tetiklenir ✅ (mevcut kod çalışır)
- **Publish (prod):** Slug değişikliği → `beforeCreate + afterCreate` tetiklenir ❌ (mevcut kod ıskalanır)

**Çözüm Stratejisi:**

`beforeCreate` + `afterCreate` hook'ları da dinlenecek. Publish işlemi sırasında:
1. `beforeCreate`: Yeni entry'nin slug'ı zaten `data` içinde var, fakat eski slug bilinmiyor
2. Eski slug'ı bulmak için: `beforeCreate` event'inde `params.data.documentId` üzerinden mevcut kaydı DB'den sorgula

```typescript
// Yaklaşım:
async beforeCreate(event) {
  const { model, params } = event as any;
  const uid = model.uid;
  if (!uid.startsWith('api::')) return;

  // Publish işlemi mi? documentId varsa evet.
  const documentId = params.data?.documentId;
  if (!documentId) return;

  // Mevcut yayınlanmış kaydı bul (slug'ı almak için)
  const existing = await strapi.db.query(uid).findOne({
    where: { documentId, publishedAt: { $notNull: true } },
    select: [config.slugField],
  });

  event.state = { oldSlug: existing?.[config.slugField] };
},

async afterCreate(event) {
  // Slug değiştiyse redirect oluştur
  // ...aynı afterUpdate mantığı...
}
```

> **Not:** Kesin v5 Document Service event yapısı ve `documentId` erişimi Strapi MCP'den sorgulanacak.

**Değişecek dosya:** `server/src/bootstrap.ts`

---

## FIX-4 — Content Manager'dan Gizleme

**Sorun:** `redirect` content type'ı Content Manager'da görünüyor. Kullanıcılar redirect kayıtlarını hem plugin UI'ından hem Content Manager'dan düzenleyebilir → tutarsız state riski.

**Redirect kayıtlarına erişim noktaları (mevcut):**
1. **Plugin UI (Settings.tsx)** — olması gereken tek yer
2. **Strapi Content Manager** — `pluginOptions` eksik olduğu için otomatik görünüyor
3. **REST API** — `POST /api/redirect-manager/redirect` (FIX-2 ile kilitlenecek)

**İdeal kurgu:** Redirect yönetimi sadece plugin UI'ından yapılmalı. Content Manager erişimi tamamen kapatılmalı. Bu:
- Kullanıcı deneyimini birleşik tutar
- Yanlış düzenleme riskini ortadan kaldırır
- "Auto-created" comment'li kayıtların elle bozulmasını engeller

**Uygulama:**
```typescript
// server/src/content-types/redirect/redirect.ts
options: {
  draftAndPublish: false,
  timestamps: true,
},
pluginOptions: {
  'content-manager': {
    visible: false,   // Content Manager listesinden gizle
  },
  'content-type-builder': {
    visible: false,   // Content Type Builder'dan gizle
  },
},
```

**Değişecek dosya:** `server/src/content-types/redirect/redirect.ts`

---

## FIX-5 — Çift Route Kaydı

**Sorun:** `routes/index.ts` tüm redirect route'larını `content-api` section'ına ekliyor. `register.ts` ise `routes/redirect.ts`'i aynı section'a tekrar `push()` ediyor. Bu çakışma:
- Route'ların iki kez kaydedilmesine → beklenmedik davranış
- Veya `push()`'un hata vermesine → konsol kirliliği

**Neden oluştu:** `routes/index.ts`'e route'lar eklendikten sonra `register.ts` temizlenmemiş.

**Çözüm:** `register.ts` içindeki route push mantığı tamamen kaldırılacak. `routes/index.ts` tek ve yetkin kayıt noktası.

```typescript
// SONRA — register.ts sadece logging:
export default ({ strapi }: { strapi: Core.Strapi }) => {
  // Route'lar routes/index.ts üzerinden otomatik kayıtlanır.
  // Bu dosyaya ek mantık eklenmedikçe boş kalmalı.
};
```

**Değişecek dosya:** `server/src/register.ts`

---

## FIX-6 — getAllRedirects Tek Segmentli Slug Filtresi

**Sorun:** `services/redirect.ts`'te `getAllRedirects()`:
```typescript
.filter(entry => {
  return entry.oldSlug.split("/").filter(Boolean).length > 1;
})
```
Bu filtre `my-post → my-new-post` gibi **tek segmentli slug'ları siler**. Sadece `blog/my-post` gibi çok segmentli olanlar döner.

**Etki:** Frontend `GET /api/redirect-manager/redirect/all` endpoint'ini kullanarak tüm redirect'leri çekip 301 yönlendirmesi yapıyorsa, tek segmentli slug redirect'leri hiç işlenmez. Bu plugin'in temel işlevini kırar.

**Kullanım durumu netleştirmesi:** Strapi üzerinde yönetilen içerikler sayfa URL'lerinden oluşuyor ve `/example-link` formatında (tek segment). Bu filtrenin bu senaryoda hiçbir anlam yoktur.

**Çözüm:** Filtre tamamen kaldırılacak. Tüm redirect'ler dönecek.

```typescript
// ÖNCE:
return entries
  .filter(entry => {
    return entry.oldSlug.split("/").filter(Boolean).length > 1;
  })
  .map(entry => ({...}));

// SONRA:
return entries.map(entry => ({
  oldSlug: entry.oldSlug,
  newSlug: entry.newSlug,
  redirectType: entry.redirectType,
}));
```

**Değişecek dosya:** `server/src/services/redirect.ts`

---

## Fix Öncelik ve Uygulama Sırası

| # | Fix | Öncelik | Risk | Etkilenen Dosya(lar) | Durum |
|---|-----|---------|------|----------------------|-------|
| FIX-1 | peerDependencies genişletme | Düşük | Minimal | `package.json` | ⬜ Bekliyor |
| FIX-2 | Endpoint güvenlik | **Kritik** | Orta — frontend konfigürasyonu gerekebilir | `routes/redirect.ts` | ⬜ Bekliyor |
| FIX-3 | Document Service lifecycle | **Kritik** | Yüksek — MCP sorgusu gerekli | `bootstrap.ts` | ⬜ Bekliyor |
| FIX-4 | Content Manager gizleme | Orta | Minimal | `content-types/redirect/redirect.ts` | ⬜ Bekliyor |
| FIX-5 | Çift route kaydı | Orta | Minimal | `register.ts` | ⬜ Bekliyor |
| FIX-6 | getAllRedirects filtresi | **Yüksek** | Minimal | `services/redirect.ts` | ⬜ Bekliyor |

**Önerilen uygulama sırası:** FIX-4 → FIX-5 → FIX-6 → FIX-1 → FIX-2 → FIX-3

Risksiz olanlardan başlanır, MCP araştırması gerektiren FIX-2 ve FIX-3 en sona bırakılır.

---

## Gelecek Sürüm Adayları (Bu Scope Dışı)

Mevcut fix'ler tamamlandıktan sonra değerlendirilecek sorunlar ve eksiklikler:

### Kod Kalitesi
- `controllers/redirect.ts:87` — `ctx.send({ from: slug, to: content.slug })` hatası: `content.slug` her zaman doğru field değil, `finalSlug` kullanılmalıydı
- `controllers/redirect.ts:70` — Redirect bulunamaması `console.error` ile loglanıyor, bu bir hata değil, normal durum — `console.log` veya sessiz olmalı
- `controllers/redirect.ts:121-123` — `console.log({ data })` debug logu production'da kalmamalı
- `bootstrap.ts` genelinde `event as any` cast'leri — proper typing eklenmeli
- `services/redirect.ts:104` — `limit: 500` hardcoded, büyük veritabanlarında yetersiz kalır → paginate veya configurable yapılmalı
- `Settings.tsx` — kullanılmayan import'lar temizlenmeli (`Select`, `Alert`, `Card`, vb.)

### Güvenlik (Detay)
- Public endpoint'lere rate limiting eklenmeli
- `findContentBySlug`'da `contentType` parametresi validate edilmeli (`api::` prefix kontrolü yapılıyor ama whitelist daha güvenli)
- `saveSettings`'te gelen `enabledContentTypes` objesinin derinlemesine validate edilmesi gerekiyor

### Mimari
- `resolveRedirect`'teki while loop döngü derinliği sınırsız (visitedSlugs koruma var ama eksik — CHAIN DETECTION özelliği plan'da zaten var)
- `getAllRedirects`'in 500 kayıt limiti configurable olmalı veya tüm kayıtlar sayfalanarak alınmalı

### Test Eksikliği
- Hiç unit veya integration test yok
- `bootstrap.ts` lifecycle davranışı test edilemeden verify edilemiyor
- FIX-3 sonrası lifecycle doğruluğu test edilmeli

### Özellik Eksiklikleri (Roadmap'te var)
- Runtime redirect middleware (`middlewares/index.ts` boş) — Faza 2
- URL prefix mapping (`Settings.tsx` genişletmesi) — Faza 3
- Chain detection derinlik limiti — Faza 4
- Orphan redirect listesi — Faza 5
- CSV bulk import, locale-aware redirect, analytics tracking — sonraki versiyon
