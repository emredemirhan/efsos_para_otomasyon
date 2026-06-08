# Efsos Otomasyon

Paraşüt üzerinde Excel'den alınan gider verilerini yarı otomatik doldurmak için kullanılan Tampermonkey userscript projesi.

Bu repo artık tek parça userscript olarak geliştirilmez. Kaynak kod `src/` altında modüler tutulur, Tampermonkey'e yüklenecek tek dosya build ile üretilir.

## Kullanım

Arkadaşına kurulum için şu linki gönder:

```txt
https://raw.githubusercontent.com/emredemirhan/efsos_para_otomasyon/main/dist/parasut.user.js
```

Kurulum adımları:

1. Chrome'a Tampermonkey eklentisini kur.
2. Yukarıdaki linki Chrome'da aç.
3. Tampermonkey kurulum ekranı açılınca `Install` / `Yükle` butonuna bas.
4. Paraşüt'e girip yeni gider formunu aç.
5. Panel otomatik görünür; Excel satırlarını panele yapıştırıp `Ana Gideri Doldur` ile kullan.

Bu link açıldığında Tampermonkey kurulum ekranı gelir. Güncelleme yayınlamak için sürümü artırıp tekrar build alarak aynı repo'ya pushlamak gerekir.

Yeni kullanıcıya son geliştirme halini kurdurmak için değişikliklerin GitHub'daki
`main` branch'ine pushlanmış olması gerekir. Kurulum linki her zaman
`main/dist/parasut.user.js` dosyasını indirir; localde kalmış değişiklikler
karşı tarafa gitmez.

## Yayınlama ve Güncelleme

`main` branch'ine `src/`, `scripts/`, `tests/`, paket dosyaları veya workflow değişiklikleri pushlanınca GitHub Actions sadece doğrulama yapar:

- bağımlılıkları kurar,
- testleri çalıştırır,
- `dist/parasut.user.js` dosyasını yeniden build edebilirliğini kontrol eder.

Actions repo'ya commit atmaz, versiyon artırmaz ve `dist/` çıktısını pushlamaz. Yayınlanacak userscript dosyası localde üretilip commitlenmelidir. Tampermonkey güncellemesi için `@version` değişmelidir; bu değer `package.json` versiyonundan build sırasında yazılır.

Lokalden aynı işlemi tek komutla yapmak gerekirse:

```bash
npm run release:patch
```

Bu komut testleri çalıştırır, patch versiyonunu artırır ve `dist/parasut.user.js` dosyasını yeniden üretir. Sonrasında `package.json`, `package-lock.json` ve `dist/parasut.user.js` birlikte commitlenip `main` branch'ine pushlanır.

Geliştirme sonrası userscript çıktısını üretmek için:

```bash
npm run build
```

Bu komut Tampermonkey'e yüklenecek tek dosyayı üretir:

- `dist/parasut.user.js`: Tampermonkey'e yüklenecek ana çıktı.

Parser testlerini çalıştırmak için:

```bash
npm test
```

## Proje Yapısı

```txt
src/
  main.js              # boot, frame guard, resize ve sayfa context yenileme
  config/
    constants.js       # panel id ve localStorage key'leri
  core/
    format.js          # tutar/tarih parse ve format helper'ları
    tableParser.js     # Excel/tab-separated veri parse işlemleri
    text.js            # Türkçe normalize/key helper'ları
  parasut/
    dom.js             # DOM helper'ları, waitFor, setNativeValue
    frame.js           # iframe / duplicate panel guard
    pageDetection.js   # gider formu ve fiş/fatura detay sayfası tespiti
    fields.js          # label'dan input bulma ve field doldurma
    dropdowns.js       # kategori/etiket dropdown seçimi
    supplier.js        # tedarikçi autocomplete akışı
    expenseFlow.js     # ana gider formu doldurma akışı
    paymentFlow.js     # tedarikçi ödemesi otomasyonu (ara/aç/eşleştir/doldur)
    datepicker.js      # pikaday (yeni ve eski Paraşüt UI) tarih seçimi
  panel/
    view.js            # geriye uyumlu re-export shim
    controller.js      # panel eventleri, preview, flow görünürlüğü, ödeme kilidi
    panelTemplate.js   # panel HTML'i
    panelState.js      # status ve loading state'leri
    panelHover.js      # hover stilleri
    panelTheme.js      # panel renkleri
    storage.js         # panel pozisyonu, seçimler, minimize state
    drag.js            # panel sürükleme davranışı
tests/
  format.test.js
  tableParser.test.js
scripts/
  build.mjs
dist/
  parasut.user.js
```

## Flow Ayrımı

Panel iki akışta çalışır; veri her iki akış için aynı `localStorage` metnini kullanır:

- **Gider akışı** (`flow: "expense"`): Yeni gider formu sayfasında (`/fis-faturalar/yeni`) sadece `Ana Gideri Doldur` görünür.
- **Ödeme akışı** (`flow: "payment"`): Tedarikçiler listesi (`/tedarikciler`), tedarikçi detayı (`/tedarikciler/{id}`) ve gider/fiş detayı (`/fis-faturalar/{id}`) sayfalarında `Ödemeyi Başlat` görünür.
- Diğer sayfalarda popup gizlenir; veri korunur.

Akış ve sayfa tespiti `src/parasut/pageDetection.js` (`flow`, `paymentStage`) ile, görünürlük `src/panel/controller.js` içindeki `getCurrentFlow()` ve `updateFlowVisibility()` ile yönetilir.

`Ödemeyi Başlat` tek satır için: tedarikçiyi arar/açar, gider kalemini ada göre eşleştirip açar, sidebar'daki ilk `Ödeme Ekle` butonuna basarak ödeme formunu açar ve tarih/hesap/meblağ/açıklama alanlarını doldurur.

Ödeme akışı kasıtlı olarak yarı otomatiktir:

- Otomasyon Paraşüt içindeki son `ÖDEME EKLE` / kaydet butonuna asla basmaz.
- Kullanıcı formu kontrol eder ve gerçek ödemeyi ekleyen son `ÖDEME EKLE` butonuna manuel basar.
- Form kapanmadan yeni ödeme başlatılmaz; açık form varken panel kullanıcıdan önce manuel kaydetmesini ister.
- Sonraki ödemeye geçmek için kayıttan sonra panelde `›` kullanılır.

## Veri Formatı

Excel'den kopyalanan tab-separated veri paneldeki textarea'ya yapıştırılır.

Header varsa tanınan örnek kolonlar:

- `Toplam Tutar`
- `Kalem Tutarı` / `Gider Tutarı` / `Ana Gider Tutarı`
- `Tedarikçi` / `Kişi`
- `Kayıt İsmi` / `Açıklama` / `Kalem`
- `Marka` / `Kategori` / `Gider Kategorisi`
- `Fiş/Fatura Tarihi` / `Fatura Tarihi` / `Tarih`
- `Ödeneceği Tarih` / `Ödeme Tarihi`
- `Etiket` / `Tag`
- `Ödeme Tutarı` / `Ödeme Hesabı` (ödeme akışı için ek sütunlar)

### Ödeme Sütunları

Aynı Excel'e 3 ek sütun eklenerek ödeme akışı çalıştırılır:

- `Ödeme Tutarı`: Tek ödeme tutarı veya birden fazla ödeme için `/` ile ayrılmış tutarlar (`30.000,00 / 52.750,00`).
- `Ödeme Tarihi`: Tek tarih (tüm ödemelere uygulanır) veya `/` ile ayrılmış tarihler.
- `Ödeme Hesabı`: Tek hesap (tüm ödemelere uygulanır) veya `/` ile ayrılmış hesap adları.

Ödeme tarihi Türkçe gün/ay olarak okunur. `06/05/2026`, `06/05` ve `0605-2026` değerleri 6 Mayıs anlamına gelir; `05.06.2026` ise 5 Haziran anlamına gelir.

Eşleştirme anahtarı ve ödeme açıklaması olarak gider kalemi adı (`Kayıt İsmi`) kullanılır. Headersız kullanımda 4 sütunlu gider formatına bu 3 sütun eklenince 7 sütunlu (`KİŞİ, MARKA, KALEM TUTARI, KAYIT İSMİ, ÖDEME TUTARI, ÖDEME TARİHİ, ÖDEME HESABI`), 5 sütunlu legacy formata eklenince 8 sütunlu format otomatik tanınır.

Header yoksa varsayılan sıra:

```txt
KİŞİ, EXCEL MARKA, KALEM TUTARI, KAYIT İSMİ
```

Headersız 4 kolonlu formatta Paraşüt'e yazılan ana gider tutarı 3. kolondaki
`KALEM TUTARI` değeridir. Kategori/marka kayıt isminin ilk marka kodundan
türetilir; bu yoksa 2. kolondaki Excel marka değeri kullanılır. Eski 5 kolonlu
`KİŞİ, MARKA, GRUP/TOPLAM, KALEM TUTARI, KAYIT İSMİ` formatı da geriye dönük
uyumluluk için hâlâ desteklenir; bu formatta GRUP/TOPLAM kolonu yok sayılır.

## Geliştirme Notları

- Paraşüt DOM selector veya label değişiklikleri için önce `src/parasut/` altına bak.
- Excel veri formatı veya parse davranışı değişecekse önce `src/core/` altında değiştir, sonra test ekle.
- Panelde görünen buton, preview veya status metinleri için `src/panel/` altına bak.
- Tampermonkey metadata bloğu `scripts/build.mjs` içinde tutulur.
- Build çıktısı olan `dist/parasut.user.js` elle düzenlenmemeli; kaynak değişiklikleri `src/` altında yapılmalı.

## Doğrulama

Her anlamlı değişiklikten sonra:

```bash
npm test
npm run build
```

Sonra Tampermonkey'de `dist/parasut.user.js` güncel içerikle kullanılabilir.
