# Plugin Review Raporu: strapi-plugin-redirect-manager

> **Tarih:** 2026-03-15
> **Reviewer:** Claude (Strapi v5 dokümantasyonu referans alınarak)
> **Versiyon:** 1.0.1
> **Değerlendirme Kaynakları:** Codebase analizi + Strapi v5.2.2 resmi dokümantasyonu

---

## 1. GÜVENLİK

### 1.1 Kritik: Tüm Route'lar Kimlik Doğrulamasız

**Dosya:** `server/src/routes/redirect.ts`

Tüm 7 route `auth: false` olarak tanımlı:
```typescript
config: { auth: false, policies: [] }
```

**Sorun:**
- `/settings` (GET/POST): Herkes plugin ayarlarını okuyup değiştirebilir
- `/redirect` (POST): Herkes redirect kaydı oluşturabilir
- `/content-types` (GET): İç yapı bilgisi dışarıya sızıyor

**Strapi Standartı:** Strapi'de `auth: false` yalnızca kasten public yapılması gereken endpoint'ler için kullanılır. Plugin route'ları varsayılan olarak admin auth gerektirir. `GET /redirect` ve `GET /redirect/all` gibi frontend'in tükettiği endpoint'ler public olabilir ama yazma işlemleri kesinlikle korunmalı.

**Öneri:**
| Route | Olması Gereken |
|-------|----------------|
| `GET /settings` | `auth: true` (admin only) |
| `POST /settings` | `auth: true` (admin only) |
| `GET /content-types` | `auth: true` (admin only) |
| `GET /redirect` | `auth: false` (frontend tüketimi için) |
| `GET /redirect/all` | `auth: false` (frontend tüketimi için) |
| `POST /redirect` | `auth: true` (admin only) |
| `GET /content/:contentType/:slug` | `auth: false` (frontend tüketimi için) |

---

### 1.2 Orta: RBAC / Permissions Eksik

Plugin hiçbir permission tanımlamıyor. Strapi v5 plugin'leri `permissions` dizisi ile hangi rollerin hangi işlemleri yapabileceğini belirleyebilir. `en.json`'da `permissions.read` ve `permissions.update` çeviri key'leri var ama backend'de karşılıkları yok.

**Öneri:** `server/src/` altına permissions tanımları eklenmeli, route config'lerine `policies` ile entegre edilmeli.

---

### 1.3 Düşük: Input Validation Yetersiz

**Dosya:** `server/src/controllers/redirect.ts`

- `createRedirect`: `ctx.request.body.data` doğrudan servise iletiliyor, hiçbir alan validasyonu yok
- `saveSettings`: Sadece `enabledContentTypes`'ın object olup olmadığı kontrol ediliyor, içerik doğrulanmıyor
- `findContentBySlug`: `contentType` parametresi doğrudan `strapi.db.query(contentType)` çağrısına veriliyor - potansiyel olarak var olmayan content type sorgulanabilir

**Öneri:** Her endpoint için input sanitization ve schema validation eklenmeli (örn: `oldSlug` max uzunluk, `redirectType` enum kontrolü `301|302`, `contentType` format doğrulama).

---

## 2. STRAPİ v5 UYUMLULUK

### 2.1 Kritik: Entity Service vs Document Service

**Dosya:** `server/src/bootstrap.ts`

Plugin `strapi.db.query()` ve `strapi.db.lifecycles.subscribe()` kullanıyor. Strapi v5'te:

- **Entity Service API kaldırıldı**, yerini **Document Service API** aldı
- Document Service API `documentId` property'si gerektirir
- Draft & Publish mantığı değişti: `publishedAt` yerine `status` kullanılıyor

Mevcut kodda:
```typescript
const isPublished = !!result.publishedAt;  // v4 pattern
```

Strapi v5'te `status: 'published' | 'draft'` kullanılması gerekiyor. `publishedAt` hâlâ DB seviyesinde çalışabilir ancak Document Service üzerinden işlem yapıldığında lifecycle hook davranışları farklılaşır.

**Etki:** `strapi.db.query()` ve `strapi.db.lifecycles` direkt DB katmanında çalıştığı için şu an fonksiyonel olabilir, ancak Document Service middleware'leri bypass ediliyor. Bu, v5'in standart davranışlarından (audit log, i18n, draft/publish flow) faydalanamamak demek.

---

### 2.2 Orta: Lifecycle Hook Tetiklenme Farkları

Strapi v5 dokümantasyonuna göre, Document Service API metotları lifecycle hook'ları farklı şekilde tetikler:

| Document Service Metodu | Tetiklenen Hook'lar |
|------------------------|---------------------|
| `update()` | beforeCreate/afterCreate (yeni locale) VEYA beforeUpdate/afterUpdate |
| `update({ status: 'published' })` | beforeCreate + beforeUpdate + beforeDelete (çoklu) |
| `publish()` | beforeCreate + beforeDelete (çoklu) |

Plugin sadece `beforeUpdate` ve `afterUpdate` dinliyor. Eğer content Document Service üzerinden güncelleniyorsa (ki admin panelden yapılan tüm işlemler böyle), bir `update` işlemi aslında `create + delete` olarak tetiklenebilir - bu durumda plugin'in hook'ları atlanır.

**Öneri:** `beforeCreate`, `afterCreate`, `beforeDelete`, `afterDelete` hook'ları da eklenmeli veya Document Service middleware'leri kullanılmalı.

---

### 2.3 Düşük: Content Type Şemasında pluginOptions Eksik

**Dosya:** `server/src/content-types/redirect/redirect.ts`

Strapi v5 dokümantasyonuna göre, plugin content type'larının admin panelde Content Manager ve Content Type Builder'da görünüp görünmeyeceği `pluginOptions` ile kontrol edilir:

```typescript
pluginOptions: {
  'content-manager': { visible: false },
  'content-type-builder': { visible: false },
}
```

Mevcut şemada bu yok. Bu, redirect collection'ının Content Manager'da listelenip düzenlenebileceği anlamına gelir ki bu istenmeyen bir durumdur (redirect'ler sadece plugin UI üzerinden yönetilmeli).

---

## 3. MİMARİ

### 3.1 Route Registrasyon Karmaşası

**İki farklı yerde** route tanımı yapılıyor:

1. **`server/src/routes/index.ts`**: `content-api` ve `redirect` route'larını birleştirerek export ediyor
2. **`server/src/register.ts`**: Aynı redirect route'larını programatik olarak `plugin.routes['content-api'].routes.push()` ile ekliyor

Bu çift tanımlama, route'ların **iki kez eklenmesine** neden olabilir. Strapi'nin standart plugin yapısında route'lar `routes/index.ts`'den export edilir ve otomatik yüklenir. `register.ts`'deki manuel ekleme gereksiz ve riskli.

**Öneri:** `register.ts`'deki route push mantığı kaldırılmalı, standart `routes/index.ts` export yeterli.

---

### 3.2 Admin Register Çakışması

**İki ayrı dosya** admin register yapıyor:

1. **`plugin.ts`** (kök dizin): `app.createSettingSection()` ile Settings menüsüne ekliyor
2. **`admin/src/index.ts`**: `app.addMenuLink()` ile sol menüye ekliyor

Strapi v5'te `./strapi-admin` export'u `admin/src/index.ts`'i kullanır. Kök dizindeki `plugin.ts` büyük olasılıkla build sürecinde yok sayılır, ama codebase'de olması kafa karıştırıcı.

**Öneri:** `plugin.ts` kaldırılmalı. Settings section kaydı `admin/src/index.ts` içine taşınmalı.

---

### 3.3 Scaffold Dosyalar

Aşağıdaki dosyalar boş/noop ve sadece yer tutucu:
- `server/src/destroy.ts` - boş fonksiyon
- `server/src/config/index.ts` - boş config
- `server/src/middlewares/index.ts` - `export default {}`
- `server/src/policies/index.ts` - `export default {}`
- `server/src/services/service.ts` - sadece welcome mesajı
- `server/src/controllers/controller.ts` - sadece welcome mesajı
- `server/src/routes/content-api.ts` - sadece `GET /` welcome
- `server/src/hooks/slugWatcher.ts` - tamamen yorum satırı

Bu dosyalar `@strapi/sdk-plugin` scaffold'undan kalma. Yayına alınacak bir plugin'de temizlenmeli.

---

## 4. PERFORMANS

### 4.1 Orta: resolveRedirect - 4 Paralel Sorgu

**Dosya:** `server/src/services/redirect.ts` satır 63-101

Her redirect çözümlemesi için 4 paralel DB sorgusu yapılıyor (slug varyasyonları: `slug`, `/slug`, `slug/`, `/slug/`). Zincirleme durumunda bu her adımda tekrarlanır.

**Sorun:**
- 3 adımlı bir zincir = 12 DB sorgusu
- Slash normalize etmek uygulama katmanında yapılmalı, DB'ye 4 farklı sorgu göndermek yerine

**Öneri:** Slug'ı normalize eden bir utility fonksiyon yazılmalı (baş/son slash temizleme), tek bir sorgu yapılmalı. Veya `createRedirect` sırasında slug'lar normalize edilerek kaydedilmeli.

---

### 4.2 Düşük: Bootstrap'ta Her Update'te Settings Sorgusu

**Dosya:** `server/src/bootstrap.ts`

`beforeUpdate` ve `afterUpdate` hook'larının her tetiklenmesinde `redirectService.getSettings()` çağrılıyor. Bu, her content güncellemesinde plugin store'a ek bir DB sorgusu demek.

**Öneri:** Settings bir kez bootstrap'ta cache'lenmeli ve `saveSettings` çağrıldığında invalidate edilmeli.

---

### 4.3 Düşük: getAllRedirects Limiti

**Dosya:** `server/src/services/redirect.ts` satır 104-119

```typescript
limit: 500, // important: fetch ALL, not just 100
```

Sabit 500 limiti var, pagination yok. 500'den fazla redirect olduğunda veri kaybı yaşanır. Ayrıca yorum "fetch ALL" diyor ama aslında 500 ile sınırlı.

Ek olarak, `filter` mantığı şüpheli:
```typescript
.filter(entry => {
  return entry.oldSlug.split("/").filter(Boolean).length > 1;
})
```
Bu, tek segmentli slug'ları (`my-post`) dışarıda bırakıyor. Yalnızca çok segmentli slug'lar (`blog/my-post`) döndürülüyor. Bu filtrelemenin neden yapıldığı dokümante edilmemiş ve muhtemelen belirli bir frontend use case'ine özel.

---

## 5. KOD KALİTESİ

### 5.1 TypeScript Kullanımı

**İyi:**
- Interface'ler tanımlanmış: `Settings`, `RedirectData`, `RedirectEntry`, `RedirectEntryCompact`
- Service dönüş tipleri belirtilmiş

**Kötü:**
- Controller'da `as any` cast'leri yaygın (bootstrap.ts satır 8, 30)
- `redirect.ts` controller'ında `strapi` global değişken olarak kullanılıyor, import/parametre olarak alınmıyor (Strapi v5'te bu çalışır çünkü `strapi` global'dir, ancak type safety sağlamaz)
- `getContentTypes` servisinde `as any` cast:
  ```typescript
  .map(([uid, model]:any) => ...
  ```

---

### 5.2 Hata Yönetimi

- Tutarsız hata log formatları: `Redirect Manager Error`, `Redirect Controller Error`, `[Redirect Manager]`
- `findContentBySlug` satır 70: Redirect bulunamadığında `console.error` kullanılıyor - bu normal bir durum, `log.info` veya `log.debug` olmalı
- `createRedirect` controller'ında (satır 119-127) hiçbir try/catch yok
- `console.log({ data })` debug log'u production kodunda kalmış (satır 121-123)

---

### 5.3 Admin UI - Settings.tsx

**Kullanılmayan importlar:**
```typescript
import { Select, Alert, Card, CardBody, CardHeader, CardTitle, Grid } from "@strapi/design-system"
import { Information } from "@strapi/icons"
```
Bu bileşenler import ediliyor ama hiçbir yerde kullanılmıyor. Bundle size'ı gereksiz artırır (tree-shaking olmadığı durumda).

**Hoisting sorunu:**
```typescript
// Satır 128-138: toggleNotification kullanılıyor
toggleNotification({ type: 'success', message: "Settings saved successfully!" });

// Satır 147: ama ancak burada tanımlanıyor
const { toggleNotification } = useNotification();
```
JavaScript hoisting sayesinde çalışıyor ama hook kurallarına göre (`useNotification`) bileşenin en üstünde çağrılmalı.

**Inline style:**
```typescript
<div style={{fontSize:"1.4rem"}}>
```
Strapi Design System kullanıyorken inline style tercih edilmemeli. `Typography` veya `Box` ile yapılmalı.

**`"use client"` direktifi:**
Satır 1'de `"use client"` var. Bu Next.js/React Server Components direktifi - Strapi admin panelinde anlamı yok, gereksiz.

---

## 6. EKSİK ÖZELLİKLER

### 6.1 Runtime Redirect Middleware

README'de şu özellik listeleniyor:
> "Auto Middleware: Handles redirects at runtime (optional)"

Ancak `server/src/middlewares/index.ts` tamamen boş. Runtime'da gelen HTTP isteklerini yakalayıp otomatik redirect yapacak bir global middleware implement edilmemiş. Bu, pluginin en önemli vaadlerinden biri ve eksik.

---

### 6.2 Pattern Matching / RegExp Desteği

README'de şu özellik listeleniyor:
> "Pattern Matching: Supports wildcards like `/blog/:slug` and RegExp"

Bu özellik hiçbir yerde implement edilmemiş. `resolveRedirect` sadece exact match yapıyor (4 slash varyasyonuyla). Wildcard veya regex desteği yok.

---

### 6.3 Draft & Publish Desteği

README'de şu özellik listeleniyor:
> "Draft & Publish: Preview redirect entries before going live"

Redirect content type'ında `draftAndPublish: false` tanımlı. Yani redirect kayıtlarının taslak/yayın ayrımı yok, direkt oluşturulur.

---

### 6.4 Redirect Silme ve Düzenleme UI'ı

Admin panelde sadece content type ayarları (enable/disable, slug field seçimi) gösteriliyor. Mevcut redirect kayıtlarını listeleme, düzenleme veya silme UI'ı yok. Redirect'ler sadece API üzerinden görüntülenebilir.

---

### 6.5 Bulk Import / Export

CSV veya JSON üzerinden toplu redirect import/export özelliği yok.

---

## 7. GENEL DEĞERLENDİRME

| Kategori | Puan (1-5) | Durum |
|----------|------------|-------|
| Güvenlik | 1/5 | Kritik - Tüm endpoint'ler açık |
| Strapi v5 Uyumluluk | 2/5 | v4 pattern'leri kullanılıyor, lifecycle risk var |
| Mimari | 2/5 | Çift registrasyon, scaffold kirliliği |
| Performans | 3/5 | Çalışır ama optimize edilmeli |
| Kod Kalitesi | 2/5 | Type safety zayıf, debug log'lar kalmış |
| Özellik Tamamlılığı | 2/5 | README'deki 3 ana özellik eksik |
| Admin UI | 2/5 | Sadece ayarlar, redirect yönetim UI'ı yok |

### Öncelikli Aksiyon Listesi

1. **[KRİTİK]** Yazma endpoint'lerine auth ekle (`POST /settings`, `POST /redirect`, `GET /settings`, `GET /content-types`)
2. **[KRİTİK]** Lifecycle hook'larını Strapi v5 Document Service davranışına göre gözden geçir
3. **[YÜKSEK]** `register.ts`'deki çift route registrasyon sorununu düzelt
4. **[YÜKSEK]** Content type şemasına `pluginOptions` ekle (Content Manager'da gizle)
5. **[YÜKSEK]** `plugin.ts` dosyasını kaldır veya `admin/src/index.ts` ile birleştir
6. **[ORTA]** Slug normalizasyonu ekle, 4 paralel sorguyu teke indir
7. **[ORTA]** Settings cache mekanizması ekle
8. **[ORTA]** Kullanılmayan importları, debug log'ları ve scaffold dosyaları temizle
9. **[ORTA]** Input validation ekle
10. **[DÜŞÜK]** README'deki eksik özellikleri ya implement et ya da README'den kaldır
