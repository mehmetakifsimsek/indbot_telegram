const strings = {
  tr: {
    chooseLanguage: 'Lütfen dil seçin / Please choose a language:',

    mainMenuTitle: 'Ne yapmak istersiniz?',
    btnChatId: '🪪 ChatID\'imi Ver',
    myChatId: (id) => `Chat ID: ${id}`,
    btnBrowse: '🔍 Uygun gün ve saatleri gör',
    btnCreateTracking: '📅 Takip oluştur',
    btnNewTracking: '➕ Yeni Takip',
    btnMyTrackings: '📋 Takiplerim',
    btnStopMenu: '⛔ Takibi Durdur / Etkinleştir',
    btnResetList: '🗑️ Listeyi Sıfırla',
    btnHelp: '❓ Yardım',
    btnBack: '🔙 Ana Menü',
    btnBackStep: '← Geri',

    browseSelectApt: 'Randevu türünü seçin:',
    loadingDesks: '⏳ IND Randevu birimleri kontrol ediliyor...',
    browseSelectCity: (label) => `✅ ${label}\n\nŞehri seçin:`,
    browseSelectMonth: (city) => `✅ ${city}\n\nHangi ay için bakılsın?`,
    browseSearching: '⏳ IND taranıyor, lütfen bekleyin...',
    browseAvailableDays: (month, city) => `📅 ${month} — ${city}\n\nUygun günler (tıklayarak saatleri görebilirsiniz):`,
    browseNoDays: (month, city) => `❌ ${month} — ${city}\n\nUygun gün bulunamadı.`,
    browseDayTimes: (day, month, city) => `🕐 ${day} ${month} — ${city}\n\nMevcut saatler:`,
    browseNoTimes: (day, month, city) => `❌ ${day} ${month} — ${city}\n\nBu gün için uygun saat yok.`,
    browseTimesList: (times) => {
      const starts = times.map(s => s.split('-')[0].trim());
      const byHour = {};
      for (const s of starts) {
        const h = s.split(':')[0];
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(s);
      }
      const lines = [];
      for (const h of Object.keys(byHour).sort()) {
        lines.push(`⏰ ${h}:00`);
        const slots = byHour[h];
        for (let i = 0; i < slots.length; i += 6) {
          lines.push('    ' + slots.slice(i, i + 6).join('  ·  '));
        }
      }
      return lines.join('\n');
    },

    welcome: (name) =>
      `Merhaba ${name}!\n\nIND randevu takibinizi buradan yönetebilirsiniz.`,

    helpText:
      'ℹ️ Nasıl çalışır?\n\n' +
      '1. Yeni Takip → randevu türü → şehir → günler → ay → süre → saat aralığı\n' +
      '2. Bot her dakika IND\'yi kontrol eder\n' +
      '3. İstediğin günde ve saat aralığında slot açılınca anında bildirim alırsın\n\n' +
      'Komutlar:\n' +
      '/start — Menüyü aç\n' +
      '/list — Takiplerini listele',

    selectAppointmentType: 'Randevu türünü seçin:',
    loadingDesksTracking: '⏳ IND Randevu birimleri kontrol ediliyor...',
    selectCity: (label) => `✅ ${label}\n\nŞehri seçin:`,
    selectDays: (city) => `✅ ${city}\n\nTakip etmek istediğiniz günleri seçin (birden fazla olabilir):`,
    confirmDays: '✅ Onayla',
    confirmDaysSelected: (days) => `✅ Onayla (${days})`,
    noDaysSelected: '⚠️ En az bir gün seçin, ardından Onayla\'ya basın.',
    daysConfirmed: (days) => `✅ Seçilen günler: ${days}\n\nTaramaya başlayacağı ayı seçin:`,
    selectMonthCount: (month) => `✅ ${month}\n\nKaç ay taransın?`,
    monthUnit: (n) => `${n} ay`,
    missingInfo: '⚠️ Eksik bilgi, işlem sıfırlandı.',
    trackingCreated: (details) =>
      `✅ Takip oluşturuldu!\n\n${details}\n\nBot her dakika IND'yi kontrol edecek. Slot açılınca haber veririm.`,

    selectTimeFrom: '⏰ Saat filtresi eklemek ister misiniz?\n\nBaşlangıç saatini seçin (veya tüm saatler için "Saat Filtresi Yok"):',
    selectTimeTo: (from) => `⏰ Başlangıç: ${from}:00\n\nBitiş saatini seçin:`,
    anyTime: '⏰ Saat Filtresi Yok (tüm saatler)',
    timeSet: (from, to) => `⏰ Saat aralığı: ${from}:00 – ${to}:00`,

    noTrackings: 'Henüz kayıtlı takibiniz yok.',
    trackingTitle: (i) => `Takip #${i + 1}`,
    fieldAppointmentType: 'Randevu türü',
    fieldCity: 'Şehir',
    fieldWatchedDays: 'İzlenen günler',
    fieldTimeRange: 'Saat aralığı',
    fieldTimeRangeVal: (from, to) => `${from}:00 – ${to}:00`,
    fieldTimeRangeAny: 'Tüm saatler',
    fieldStartMonth: 'Başlangıç ayı',
    fieldScanDuration: 'Tarama süresi',
    fieldScanDurationVal: (n) => `${n} ay`,
    fieldStatus: 'Durum',
    statusActive: '✅ Aktif',
    statusPassive: '⛔ Pasif',

    changeStatus: 'Takip durumunu değiştirin:',
    btnStop: (i, city, label) => `⛔ Durdur — #${i + 1} ${city} / ${label}`,
    btnActivate: (i, city, label) => `✅ Etkinleştir — #${i + 1} ${city} / ${label}`,
    trackingNotFound: 'Takip bulunamadı.',
    trackingStopped: (i) => `⛔ Takip #${i + 1} durduruldu.`,
    trackingActivated: (i) => `✅ Takip #${i + 1} etkinleştirildi. Kontroller başladı.`,

    noTrackingsToReset: 'Zaten kayıtlı takibiniz yok.',
    confirmReset: '⚠️ Tüm takipleriniz silinecek. Emin misiniz?',
    btnConfirmReset: '✅ Evet, sıfırla',
    btnCancelReset: '❌ Hayır, vazgeç',
    resetDone: '🗑️ Tüm takipleriniz silindi.',

    btnDeleteTracking: '🗑️ Takip Sil',
    btnDeleteAll: '⚠️ Tümünü Sil',
    deleteMenu: 'Silmek istediğiniz takibi seçin:',
    btnDeleteItem: (i, city, label) => `🗑️ #${i + 1} — ${city} / ${label}`,
    deleteConfirm: (i, city, label) => `⚠️ Şu takip silinecek:\n\n#${i + 1} — ${city} / ${label}\n\nEmin misiniz?`,
    btnDeleteYes: '✅ Evet, sil',
    btnDeleteNo: '❌ Hayır, vazgeç',
    deleteDone: (i) => `🗑️ Takip #${i + 1} silindi.`,

    notifTitle: '🟢 IND Randevu Açıldı!',
    notifTimeFilter: (from, to) => `⏰ Saat filtresi: ${from}:00 – ${to}:00`,
    notifDayLine: (month, day) => `• ${month} — ${day}. gün`,
    reminder: (msg) => `⚠️ UNUTMA!\n\n${msg}`,
    ackBtn: '✅ Tamam, randevumu aldım',
    ackDone: (i) => `✅ Harika! Randevunuzu aldığınız için tebrikler 🎉\n\nTakip #${i + 1} durduruldu.`,
  },

  en: {
    chooseLanguage: 'Lütfen dil seçin / Please choose a language:',

    mainMenuTitle: 'What would you like to do?',
    btnChatId: '🪪 My ChatID',
    myChatId: (id) => `Chat ID: ${id}`,
    btnBrowse: '🔍 See available days & times',
    btnCreateTracking: '📅 Create Tracking',
    btnNewTracking: '➕ New Tracking',
    btnMyTrackings: '📋 My Trackings',
    btnStopMenu: '⛔ Stop / Activate Tracking',
    btnResetList: '🗑️ Reset List',
    btnHelp: '❓ Help',
    btnBack: '🔙 Main Menu',
    btnBackStep: '← Back',

    browseSelectApt: 'Select appointment type:',
    loadingDesks: '⏳ Checking IND appointment desks...',
    browseSelectCity: (label) => `✅ ${label}\n\nSelect city:`,
    browseSelectMonth: (city) => `✅ ${city}\n\nWhich month would you like to check?`,
    browseSearching: '⏳ Scanning IND, please wait...',
    browseAvailableDays: (month, city) => `📅 ${month} — ${city}\n\nAvailable days (tap to see times):`,
    browseNoDays: (month, city) => `❌ ${month} — ${city}\n\nNo available days found.`,
    browseDayTimes: (day, month, city) => `🕐 ${day} ${month} — ${city}\n\nAvailable times:`,
    browseNoTimes: (day, month, city) => `❌ ${day} ${month} — ${city}\n\nNo available times for this day.`,
    browseTimesList: (times) => {
      const starts = times.map(s => s.split('-')[0].trim());
      const byHour = {};
      for (const s of starts) {
        const h = s.split(':')[0];
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(s);
      }
      const lines = [];
      for (const h of Object.keys(byHour).sort()) {
        lines.push(`⏰ ${h}:00`);
        const slots = byHour[h];
        for (let i = 0; i < slots.length; i += 6) {
          lines.push('    ' + slots.slice(i, i + 6).join('  ·  '));
        }
      }
      return lines.join('\n');
    },

    welcome: (name) =>
      `Hello ${name}!\n\nManage your IND appointment tracking here.`,

    helpText:
      'ℹ️ How does it work?\n\n' +
      '1. New Tracking → appointment type → city → days → month → duration → time range\n' +
      '2. Bot checks IND every minute\n' +
      '3. You get an instant notification when a slot opens on your selected day and time range\n\n' +
      'Commands:\n' +
      '/start — Open menu\n' +
      '/list — List your trackings',

    selectAppointmentType: 'Select appointment type:',
    loadingDesksTracking: '⏳ Checking IND appointment desks...',
    selectCity: (label) => `✅ ${label}\n\nSelect city:`,
    selectDays: (city) => `✅ ${city}\n\nSelect the days you want to track (you can select multiple):`,
    confirmDays: '✅ Confirm',
    confirmDaysSelected: (days) => `✅ Confirm (${days})`,
    noDaysSelected: '⚠️ Please select at least one day, then press Confirm.',
    daysConfirmed: (days) => `✅ Selected days: ${days}\n\nSelect the starting month for scanning:`,
    selectMonthCount: (month) => `✅ ${month}\n\nHow many months to scan?`,
    monthUnit: (n) => `${n} month${n > 1 ? 's' : ''}`,
    missingInfo: '⚠️ Missing information, operation reset.',
    trackingCreated: (details) =>
      `✅ Tracking created!\n\n${details}\n\nThe bot will check IND every minute. I'll notify you when a slot opens.`,

    selectTimeFrom: '⏰ Would you like to add a time filter?\n\nSelect a start time (or choose "No Time Filter" for any time):',
    selectTimeTo: (from) => `⏰ Start: ${from}:00\n\nSelect end time:`,
    anyTime: '⏰ No Time Filter (any time)',
    timeSet: (from, to) => `⏰ Time range: ${from}:00 – ${to}:00`,

    noTrackings: 'You have no saved trackings yet.',
    trackingTitle: (i) => `Tracking #${i + 1}`,
    fieldAppointmentType: 'Appointment type',
    fieldCity: 'City',
    fieldWatchedDays: 'Watched days',
    fieldTimeRange: 'Time range',
    fieldTimeRangeVal: (from, to) => `${from}:00 – ${to}:00`,
    fieldTimeRangeAny: 'Any time',
    fieldStartMonth: 'Start month',
    fieldScanDuration: 'Scan duration',
    fieldScanDurationVal: (n) => `${n} month${n > 1 ? 's' : ''}`,
    fieldStatus: 'Status',
    statusActive: '✅ Active',
    statusPassive: '⛔ Inactive',

    changeStatus: 'Change tracking status:',
    btnStop: (i, city, label) => `⛔ Stop — #${i + 1} ${city} / ${label}`,
    btnActivate: (i, city, label) => `✅ Activate — #${i + 1} ${city} / ${label}`,
    trackingNotFound: 'Tracking not found.',
    trackingStopped: (i) => `⛔ Tracking #${i + 1} stopped.`,
    trackingActivated: (i) => `✅ Tracking #${i + 1} activated. Checks started.`,

    noTrackingsToReset: 'You have no saved trackings.',
    confirmReset: '⚠️ All your trackings will be deleted. Are you sure?',
    btnConfirmReset: '✅ Yes, reset',
    btnCancelReset: '❌ No, cancel',
    resetDone: '🗑️ All your trackings have been deleted.',

    btnDeleteTracking: '🗑️ Delete Tracking',
    btnDeleteAll: '⚠️ Delete All',
    deleteMenu: 'Select the tracking you want to delete:',
    btnDeleteItem: (i, city, label) => `🗑️ #${i + 1} — ${city} / ${label}`,
    deleteConfirm: (i, city, label) => `⚠️ This tracking will be deleted:\n\n#${i + 1} — ${city} / ${label}\n\nAre you sure?`,
    btnDeleteYes: '✅ Yes, delete',
    btnDeleteNo: '❌ No, cancel',
    deleteDone: (i) => `🗑️ Tracking #${i + 1} deleted.`,

    notifTitle: '🟢 IND Appointment Available!',
    notifTimeFilter: (from, to) => `⏰ Time filter: ${from}:00 – ${to}:00`,
    notifDayLine: (month, day) => `• ${month} — Day ${day}`,
    reminder: (msg) => `⚠️ DON\'T FORGET!\n\n${msg}`,
    ackBtn: '✅ OK, I got my appointment',
    ackDone: (i) => `✅ Great! Congratulations on getting your appointment 🎉\n\nTracking #${i + 1} stopped.`,
  }
};

function t(lang, key, ...args) {
  const s = strings[lang] || strings.tr;
  const val = s[key];
  if (typeof val === 'function') return val(...args);
  return val !== undefined ? val : key;
}

module.exports = { t, strings };
