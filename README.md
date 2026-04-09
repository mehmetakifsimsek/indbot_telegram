# IND Randevu Kontrol/Alarm Botu ----- IND Appointment Checker/Alarm Bot

---

## 🇹🇷 Türkçe

### Nedir?

Bu proje, Hollanda Göç ve Vatandaşlık Servisi (IND) üzerindeki randevu müsaitliğini otomatik olarak takip eden bir Telegram botudtur. Kullanıcılar belirli randevu tipi, birim (şehir), haftanın günleri ve başlangıç ayı gibi kriterleri seçerek takip oluşturabilir. Bot, IND sistemini düzenli aralıklarla tarar; uygun bir randevu bulduğunda kullanıcıya Telegram üzerinden bildirim gönderir.

### Özellikler

- **Dil desteği:** Türkçe ve İngilizce arayüz
- **Randevu tipleri:** Belge teslimi, biyometri, MVV vb. (IND'nin sunduğu tüm tipler dinamik olarak yüklenir)
- **Takip oluşturma:** Randevu tipi → şehir/birim → haftanın günleri → başlangıç ayı → tarama süresi adımlarıyla yönlendirilmiş akış
- **Uygun saatleri gör:** Takip oluşturmadan önce, herhangi bir ay ve birim için mevcut randevu günlerini ve saatlerini anlık olarak tarayıp görüntüler
- **Çoklu takip:** Bir kullanıcı birden fazla takip oluşturabilir; her birini ayrı ayrı aktif/pasif yapabilir veya silebilir
- **Canlı saat listesi:** Bulunan randevular saate göre gruplanarak düzenli biçimde gösterilir
- **Kullanıcı loglama:** Her etkileşimde `chatId`, `kullanıcı adı`, `dil kodu`, `yapılan işlem` ve UTC zaman damgası konsola kaydedilir

### Komutlar

| Komut | Açıklama |
|---|---|
| `/start` | Botu başlatır; dil daha önce seçilmişse ana menüye geçer |
| `/language` | Dil seçim ekranını açar |
| `/chatid` | ChatID değerini verir (PC uygulamasıyla kullanmak isterseniz  gereklidir)  |
| `/show` | Mevcut takip görevlerini listeler |
| `/clear` | Tüm takipleri silmek için onay ister |

### Teknik Yapı

```
bot.js        — Telegram bot mantığı, komut ve callback handler'ları, kullanıcı akışı
checker.js    — IND sitesini Playwright ile tarayan ve randevuları ayrıştıran modül
i18n.js       — Türkçe ve İngilizce metin çevirileri
db.js         — Kullanıcı verisi ve takip kayıtlarının saklanması (harici)
```

### Gereksinimler

- Node.js 18+
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Playwright](https://playwright.dev/) (Chromium)

### Kurulum

```bash
npm install
npx playwright install chromium
```

`.env` veya ortam değişkenleri:

```
TELEGRAM_TOKEN=your_bot_token
SESSION_SECRET=your_secret
PORT=3000
WEBHOOK_URL=https://yourdomain.com   # opsiyonel; yoksa polling kullanılır
```

```bash
node bot.js
```

### Nasıl Çalışır?

1. Kullanıcı `/start` ile botu başlatır ve dil seçer
2. Ana menüden "Yeni Takip" veya "Uygun Saatleri Gör" seçer
3. Takip oluştururken: randevu tipi → birim → günler → ay → tarama süresi adımları izlenir
4. Bot, seçilen kriterlere göre IND sitesini Playwright ile periyodik olarak tarar
5. Uygun randevu bulunduğunda kullanıcıya Telegram mesajı gönderilir

### Notlar

- "Uygun Saatleri Gör" akışında uzun birim adları (ör. "IND Amsterdam Leeghwaterlaan 29") kısa şehir anahtarlarına dönüştürülerek Telegram'ın 64 bayt callback veri sınırı aşılmaz
- Ay listesi her zaman 3 ay (mevcut ay + 2) ile sınırlıdır; IND sisteminin kendi gösterdiği maksimum aralıkla örtüşür
- `WEBHOOK_URL` ortam değişkeni tanımlandığında bot webhook modunda çalışır; tanımlanmadığında otomatik olarak long polling moduna geçer

---

## 🇪🇳 English

### What is it?

This is a Telegram bot that automatically monitors appointment availability on the Dutch Immigration and Naturalisation Service (IND) website. Users configure a tracking by selecting an appointment type, office (city/desk), preferred days of the week, and a start month. The bot periodically scrapes the IND system and sends a Telegram notification as soon as a slot becomes available.

### Features

- **Multilingual UI:** Turkish and English
- **Appointment types:** Document collection, biometrics, MVV, etc. (all types are loaded dynamically from IND)
- **Guided tracking creation:** Step-by-step flow — appointment type → city/desk → days of week → start month → scan duration
- **Browse available times:** Before creating a tracking, users can instantly view available days and time slots for any month and office
- **Multiple trackings:** Each user can maintain several independent trackings, toggling them active/inactive or deleting them individually
- **Grouped time display:** Found slots are grouped by hour and displayed in a clean, readable format
- **User activity logging:** Every interaction logs `chatId`, `username`, `language code`, and `action` to the console with a UTC timestamp

### Commands

| Command | Description |
|---|---|
| `/start` | Starts the bot; skips language selection if language was already set |
| `/language` | Opens the language selection screen |
| `/chatid` | Gives your ChatID value (Needed for PC side app if you want to use it)  |
| `/show` | Lists all active tracking tasks for the user |
| `/clear` | Prompts for confirmation before deleting all trackings |

### Project Structure

```
bot.js        — Telegram bot logic, command & callback handlers, user flow state machine
checker.js    — Playwright-based IND scraper; parses available days, times, and desks
i18n.js       — Turkish and English UI string definitions
db.js         — User data and tracking persistence (external module)
```

### Requirements

- Node.js 18+
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Playwright](https://playwright.dev/) (Chromium)

### Setup

```bash
npm install
npx playwright install chromium
```

Environment variables (`.env` or host config):

```
TELEGRAM_TOKEN=your_bot_token
SESSION_SECRET=your_secret
PORT=3000
WEBHOOK_URL=https://yourdomain.com   # optional; falls back to polling if omitted
```

```bash
node bot.js
```

### How It Works

1. User sends `/start`, selects a language
2. From the main menu, the user picks "New Tracking" or "Browse Available Times"
3. Tracking creation is a guided multi-step flow: appointment type → desk → days → month → duration
4. The bot uses Playwright to headlessly scrape IND on a schedule, matching the user's criteria
5. When a matching slot is found, the user receives a Telegram message with the details

### Notes

- Callback data sent to Telegram is kept within the 64-byte limit by mapping long desk names to short city keys in the browse flow
- The month list is always capped at 3 months (current + 2) to match the IND system's own limit
- Webhook mode is used when `WEBHOOK_URL` is set; otherwise the bot falls back to long polling automatically
