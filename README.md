# Efsos Otomasyon

Paraşüt üzerinde Excel'den alınan gider verilerini yarı otomatik doldurmak için kullanılan Tampermonkey userscript projesi.

Bu repo artık tek parça userscript olarak geliştirilmez. Kaynak kod `src/` altında modüler tutulur, Tampermonkey'e yüklenecek tek dosya build ile üretilir.

## Kullanım

Arkadaşına kurulum için şu linki gönder:

```txt
https://raw.githubusercontent.com/emredemirhan/efsos_para_otomasyon/main/dist/parasut.user.js
```

Bu link açıldığında Tampermonkey kurulum ekranı gelir. Güncelleme yayınlamak için sürümü artırıp tekrar build alarak aynı repo'ya pushlamak yeterlidir.

## Otomatik Yayınlama

`main` branch'ine `src/`, `scripts/`, `tests/` veya paket dosyalarında değişiklik pushlanınca GitHub Actions otomatik olarak:

- bağımlılıkları kurar,
- testleri çalıştırır,
- patch versiyonu artırır,
- `dist/parasut.user.js` dosyasını yeniden build eder,
- `package.json`, `package-lock.json` ve `dist/parasut.user.js` değişikliklerini `chore: build userscript [skip ci]` commit'iyle `main` branch'ine pushlar.

Bu commit GitHub'a düştükten sonra Tampermonkey `@version` değiştiğini görür ve karşı taraf manuel `Update` dediğinde yeni sürümü çeker.

Lokalden aynı işlemi tek komutla yapmak gerekirse:

```bash
npm run release:patch
```

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
    paymentParser.js   # çoklu ödeme kalemi parse işlemleri
    text.js            # Türkçe normalize/key helper'ları
  parasut/
    dom.js             # DOM helper'ları, waitFor, setNativeValue
    frame.js           # iframe / duplicate panel guard
    pageDetection.js   # gider formu ve fiş/fatura detay sayfası tespiti
    fields.js          # label'dan input bulma ve field doldurma
    dropdowns.js       # kategori/etiket dropdown seçimi
    supplier.js        # tedarikçi autocomplete akışı
    expenseFlow.js     # ana gider formu doldurma akışı
    paymentFlow.js     # ödeme kalemi formu doldurma akışı
  panel/
    view.js            # panel HTML'i ve buton loading state'leri
    controller.js      # panel eventleri, preview, flow görünürlüğü
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

Panel iki farklı Paraşüt ekranında farklı davranır:

- Gider formu sayfasında sadece `Ana Gideri Doldur` görünür.
- Fiş/fatura detay sayfasında sadece `Ödeme kalemi` seçimi ve `Seçili Ödeme Kalemini Doldur` görünür.
- Diğer sayfalarda popup tamamen gizlenir; veri `localStorage` içinde korunur.

Bu ayrım `src/panel/controller.js` içindeki `getCurrentFlow()` ve `updateFlowVisibility()` üzerinden yönetilir.

## Veri Formatı

Excel'den kopyalanan tab-separated veri paneldeki textarea'ya yapıştırılır.

Header varsa tanınan örnek kolonlar:

- `Toplam Tutar`
- `Tedarikçi` / `Kişi`
- `Kayıt İsmi` / `Açıklama` / `Kalem`
- `Marka` / `Kategori` / `Gider Kategorisi`
- `Fiş/Fatura Tarihi` / `Fatura Tarihi` / `Tarih`
- `Ödeneceği Tarih` / `Ödeme Tarihi`
- `Etiket` / `Tag`

Header yoksa varsayılan sıra:

```txt
TOPLAM TUTAR, KİŞİ, KAYIT İSMİ, MARKA, TARİH, ÖDENECEĞİ TARİH, ETİKET
```

Çoklu ödeme kalemi, kayıt ismi içinde satır satır şu formatla parse edilir:

```txt
Meta Ads - 100,50 TL
Google Ads - 200 TL
```

Bu parse logic'i `src/core/paymentParser.js` içindedir.

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
