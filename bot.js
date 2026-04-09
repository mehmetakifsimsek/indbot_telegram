const fs = require('fs');
const path = require('path');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '.playwright');
}

(function ensurePlaywrightBrowser() {
  try {
    const { chromium } = require('playwright');
    const execPath = chromium.executablePath();
    if (!execPath || !fs.existsSync(execPath)) {
      console.error('[setup] Playwright Chromium bulunamadı. Build sırasında `npx playwright install chromium` çalıştırın veya Docker deploy kullanın.');
      process.exit(1);
    }
    console.log(`[setup] Playwright Chromium hazır: ${execPath}`);
  } catch (err) {
    console.error('[setup] Playwright kontrolü başarısız:', err.message);
    process.exit(1);
  }
})();

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initDb, ensureUser, getUser, updateUser, getAllUsers } = require('./db');
const {
  checkTracking, DESKS, APPOINTMENT_TYPES, MONTH_NAMES,
  openAndPreparePage, getAvailableDesks, getAvailableDays, getAvailableTimes,
  clickOnDay, clickNextMonth, getOpenMonthLabel, todayMonthLabel, monthDiff
} = require('./checker');
const { t } = require('./i18n');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not defined.');

const APP_BASE_URL = String(process.env.APP_BASE_URL || process.env.WEBHOOK_BASE_URL || '').trim().replace(/\/$/, '');
const TELEGRAM_USE_WEBHOOK = /^(1|true|yes)$/i.test(String(process.env.TELEGRAM_USE_WEBHOOK || ''));
const useWebhook = TELEGRAM_USE_WEBHOOK && !!APP_BASE_URL;

const bot = new TelegramBot(token, { polling: false });

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const healthHandler = (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() });
app.get('/', (req, res) => res.status(200).send('Bot is alive!'));
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

if (useWebhook) {
  app.post('/api/telegram-webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

initDb().then(async () => {
  app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
  });

  if (useWebhook) {
    const webhookUrl = `${APP_BASE_URL}/api/telegram-webhook`;
    try {
      await bot.setWebHook(webhookUrl, { drop_pending_updates: false });
      console.log(`[webhook] Registered: ${webhookUrl}`);
    } catch (err) {
      console.error('[webhook] Webhook ayarlanamadı:', err.message);
      process.exit(1);
    }
  } else {
    try {
      await bot.deleteWebHook({ drop_pending_updates: false });
    } catch (err) {
      console.warn('[polling] Existing webhook temizlenemedi:', err.message);
    }

    try {
      await bot.startPolling({
        restart: true,
        interval: 1000,
        params: { timeout: 30 }
      });
      console.log('[polling] Polling started');
    } catch (err) {
      console.error('[polling] Polling başlatılamadı:', err.message);
      process.exit(1);
    }
  }

  setInterval(runChecks, 60 * 1000);
  runChecks().catch(err => console.error(err));
}).catch(err => {
  console.error('[db] Init failed:', err.message);
  process.exit(1);
});

function getLang(chatId) {
  const user = getUser(chatId);
  return user?.lang || 'tr';
}

function langMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇹🇷 Türkçe', callback_data: 'lang_tr' }],
        [{ text: '🇬🇧 English', callback_data: 'lang_en' }]
      ]
    }
  };
}

function mainMenu(lang, hasTrackings = false) {
  const rows = [
    [{ text: t(lang, 'btnChatId'), callback_data: 'chatid_btn' }],
    [{ text: t(lang, 'btnBrowse'), callback_data: 'browse' }],
    [{ text: t(lang, 'btnCreateTracking'), callback_data: 'new_tracking' }],
  ];
  if (hasTrackings) {
    rows.push([{ text: t(lang, 'btnMyTrackings'), callback_data: 'list_trackings' }]);
    rows.push([
      { text: t(lang, 'btnDeleteTracking'), callback_data: 'delete_menu' },
      { text: t(lang, 'btnDeleteAll'), callback_data: 'reset_confirm' }
    ]);
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function browseAptMenu(lang) {
  const rows = Object.entries(APPOINTMENT_TYPES).map(([key, val]) => ([
    { text: val.label, callback_data: `brow_apt|${key}` }
  ]));
  rows.push([backBtn(lang, 'back_main')]);
  return { reply_markup: { inline_keyboard: rows } };
}

function browseMonthMenu(lang, aptKey, city, n = 3) {
  const now = new Date();
  const months = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
  }
  const rows = [];
  for (let i = 0; i < months.length; i += 2) {
    const row = [{ text: months[i], callback_data: `brow_month|${aptKey}|${city}|${months[i]}` }];
    if (months[i + 1]) row.push({ text: months[i + 1], callback_data: `brow_month|${aptKey}|${city}|${months[i + 1]}` });
    rows.push(row);
  }
  rows.push(...navRow(lang, `back_to_browsecity|${aptKey}`));
  return { reply_markup: { inline_keyboard: rows } };
}

function backBtn(lang, callbackData = 'back_main') {
  const isMain = callbackData === 'back_main';
  return { text: t(lang, isMain ? 'btnBack' : 'btnBackStep'), callback_data: callbackData };
}

function navRow(lang, backData) {
  if (!backData || backData === 'back_main') {
    return [[backBtn(lang, 'back_main')]];
  }
  return [[backBtn(lang, backData), backBtn(lang, 'back_main')]];
}

function appointmentTypeMenu(lang) {
  const rows = Object.entries(APPOINTMENT_TYPES).map(([key, val]) => ([
    { text: val.label, callback_data: `apt_${key}` }
  ]));
  rows.push([backBtn(lang, 'back_main')]);
  return { reply_markup: { inline_keyboard: rows } };
}

function monthMenu(lang, n = 3) {
  const now = new Date();
  const months = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
  }
  const rows = [];
  for (let i = 0; i < months.length; i += 2) {
    const row = [{ text: months[i], callback_data: `mth_${months[i]}` }];
    if (months[i + 1]) row.push({ text: months[i + 1], callback_data: `mth_${months[i + 1]}` });
    rows.push(row);
  }
  rows.push(...navRow(lang, 'back_to_days'));
  return { reply_markup: { inline_keyboard: rows } };
}

function dayPickerMenu(lang, selectedDays = []) {
  const rows = [];
  let row = [];
  for (let day = 1; day <= 31; day++) {
    const isSelected = selectedDays.includes(day);
    row.push({
      text: isSelected ? `✅${day}` : String(day),
      callback_data: `daysel_${day}`
    });
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);

  const sorted = [...selectedDays].sort((a, b) => a - b);
  const confirmText = sorted.length > 0
    ? t(lang, 'confirmDaysSelected', sorted.join(', '))
    : t(lang, 'confirmDays');

  rows.push([{ text: confirmText, callback_data: 'dayconfirm' }]);
  rows.push(...navRow(lang, 'back_to_city'));
  return { reply_markup: { inline_keyboard: rows } };
}

function monthCountMenu(lang) {
  const row = [1, 2, 3].map(n => ({
    text: t(lang, 'monthUnit', n),
    callback_data: `cnt_${n}`
  }));
  return {
    reply_markup: {
      inline_keyboard: [row, ...navRow(lang, 'back_to_month')]
    }
  };
}

function timeFromMenu(lang) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const rows = [];
  let row = [];
  for (const h of hours) {
    row.push({ text: `${h}:00 ›`, callback_data: `tfrom_${h}` });
    if (row.length === 5) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  rows.push([{ text: t(lang, 'anyTime'), callback_data: 'tfrom_any' }]);
  rows.push(...navRow(lang, 'back_to_monthcount'));
  return { reply_markup: { inline_keyboard: rows } };
}

function timeToMenu(lang, fromHour) {
  const hours = [];
  for (let h = fromHour + 1; h <= 18; h++) hours.push(h);
  const rows = [];
  let row = [];
  for (const h of hours) {
    row.push({ text: `‹ ${h}:00`, callback_data: `tto_${h}` });
    if (row.length === 5) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  rows.push(...navRow(lang, 'back_to_timefrom'));
  return { reply_markup: { inline_keyboard: rows } };
}

function resetDraft(chatId) {
  updateUser(chatId, u => ({ ...u, state: null, draftTracking: {} }));
}

function setState(chatId, state, patch = null) {
  updateUser(chatId, u => ({
    ...u,
    state,
    draftTracking: patch ? { ...(u.draftTracking || {}), ...patch } : (u.draftTracking || {})
  }));
}

function matchDeskToCity(deskName) {
  const text = (deskName || '').trim();
  const lower = text.toLowerCase();
  for (const [cityKey] of Object.entries(DESKS)) {
    const keyLower = cityKey.toLowerCase();
    const stripped = lower.replace(/^ind\s*/i, '').replace(/\s+leeghwaterlaan.*$/, '').trim();
    if (lower === keyLower || lower.includes(keyLower) || (stripped && keyLower.includes(stripped))) {
      return cityKey;
    }
  }
  return text.slice(0, 30);
}

function formatTracking(lang, tr, i) {
  const appt = APPOINTMENT_TYPES[tr.appointmentType];
  const timeRangeText = (tr.timeFrom != null && tr.timeTo != null)
    ? t(lang, 'fieldTimeRangeVal', tr.timeFrom, tr.timeTo)
    : t(lang, 'fieldTimeRangeAny');

  return [
    t(lang, 'trackingTitle', i),
    `${t(lang, 'fieldAppointmentType')}: ${appt ? appt.label : tr.appointmentType}`,
    `${t(lang, 'fieldCity')}: ${tr.city}`,
    `${t(lang, 'fieldWatchedDays')}: ${(tr.days || []).join(', ') || '-'}`,
    `${t(lang, 'fieldTimeRange')}: ${timeRangeText}`,
    `${t(lang, 'fieldStartMonth')}: ${tr.startMonth}`,
    `${t(lang, 'fieldScanDuration')}: ${t(lang, 'fieldScanDurationVal', tr.monthCount)}`,
    `${t(lang, 'fieldStatus')}: ${tr.active ? t(lang, 'statusActive') : t(lang, 'statusPassive')}`
  ].join('\n');
}

async function showMainMenu(chatId, text, msgId) {
  const lang = getLang(chatId);
  const user = getUser(chatId);
  const hasTrackings = !!(user?.trackings?.length);
  const menuText = text || t(lang, 'mainMenuTitle');
  const menuOpts = mainMenu(lang, hasTrackings);
  if (msgId) {
    await editStep(chatId, msgId, menuText, menuOpts);
  } else {
    await bot.sendMessage(chatId, menuText, menuOpts);
  }
}

async function editStep(chatId, msgId, text, menuOptions) {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: menuOptions?.reply_markup || { inline_keyboard: [] }
    });
  } catch {
    await bot.sendMessage(chatId, text, menuOptions);
  }
}

async function tryDelete(chatId, msgId) {
  try { await bot.deleteMessage(chatId, msgId); } catch { /* ignore */ }
}

async function createTrackingFromDraft(chatId, lang, timeFrom, timeTo) {
  const user = getUser(chatId);
  const draft = user?.draftTracking || {};

  if (!draft.appointmentType) {
    console.log(`[createTracking] chatId=${chatId} missing: appointmentType`);
    resetDraft(chatId);
    await bot.sendMessage(chatId, t(lang, 'selectAppointmentType'), appointmentTypeMenu(lang));
    return;
  }
  if (!draft.city) {
    console.log(`[createTracking] chatId=${chatId} missing: city`);
    resetDraft(chatId);
    await bot.sendMessage(chatId, t(lang, 'selectAppointmentType'), appointmentTypeMenu(lang));
    return;
  }
  if (!draft.days || draft.days.length === 0) {
    console.log(`[createTracking] chatId=${chatId} missing: days`);
    setState(chatId, 'awaiting_days', { selectedDays: [] });
    await bot.sendMessage(chatId, t(lang, 'selectDays', draft.city), dayPickerMenu(lang, []));
    return;
  }
  if (!draft.startMonth) {
    console.log(`[createTracking] chatId=${chatId} missing: startMonth`);
    setState(chatId, 'awaiting_start_month', {});
    await bot.sendMessage(chatId, t(lang, 'daysConfirmed', draft.days.join(', ')), monthMenu(lang));
    return;
  }
  if (!draft.monthCount) {
    console.log(`[createTracking] chatId=${chatId} missing: monthCount`);
    setState(chatId, 'awaiting_month_count', {});
    await bot.sendMessage(chatId, t(lang, 'selectMonthCount', draft.startMonth), monthCountMenu(lang));
    return;
  }

  const newTracking = {
    id: Date.now().toString(),
    appointmentType: draft.appointmentType,
    city: draft.city,
    days: draft.days,
    startMonth: draft.startMonth,
    monthCount: draft.monthCount,
    timeFrom: timeFrom ?? null,
    timeTo: timeTo ?? null,
    active: true,
    createdAt: new Date().toISOString(),
    lastNotified: null
  };

  updateUser(chatId, u => ({
    ...u,
    state: null,
    draftTracking: {},
    trackings: [...u.trackings, newTracking]
  }));

  const freshUser = getUser(chatId);
  const idx = (freshUser.trackings || []).length - 1;
  await bot.sendMessage(chatId, t(lang, 'trackingCreated', formatTracking(lang, newTracking, idx)));

  const allTrackings = freshUser.trackings || [];
  if (allTrackings.length > 0) {
    const listText = allTrackings.map((tr, i) => formatTracking(lang, tr, i)).join('\n\n---\n\n');
    await bot.sendMessage(chatId, listText);
  }
  await showMainMenu(chatId);
}

function logUserInfo(from, chatId, action) {
  if (!from) return;
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const parts = [
    `chatId=${chatId}`,
    `id=${from.id}`,
  ];
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ');
  if (fullName)             parts.push(`name="${fullName}"`);
  if (from.username)        parts.push(`username=@${from.username}`);
  if (from.language_code)   parts.push(`lang_code=${from.language_code}`);
  if (from.is_bot)          parts.push('is_bot=true');
  if (action)               parts.push(`action=${action}`);
  console.log(`[user][${ts}] ${parts.join(' | ')}`);
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  ensureUser(chatId, { firstName: msg.from?.first_name || '', username: msg.from?.username || '' });
  logUserInfo(msg.from, chatId, '/start');

  const user = getUser(chatId);
  if (user?.lang) {
    await showMainMenu(chatId);
  } else {
    await bot.sendMessage(chatId, t('tr', 'chooseLanguage'), langMenu());
  }
});

bot.onText(/\/language/, async (msg) => {
  const chatId = msg.chat.id;
  ensureUser(chatId, { firstName: msg.from?.first_name || '', username: msg.from?.username || '' });
  logUserInfo(msg.from, chatId, '/language');
  await bot.sendMessage(chatId, t('tr', 'chooseLanguage'), langMenu());
});

bot.onText(/\/chatid/, async (msg) => {
  const chatId = msg.chat.id;
  ensureUser(chatId, { firstName: msg.from?.first_name || '', username: msg.from?.username || '' });
  logUserInfo(msg.from, chatId, '/chatid');
  const lang = getLang(chatId);
  const chatIdText = t(lang, 'myChatId', chatId);
  await bot.sendMessage(chatId, chatIdText, {
    entities: [{ type: 'text_link', url: `tg://user?id=${chatId}`, offset: chatIdText.indexOf(String(chatId)), length: String(chatId).length }]
  });
});

bot.onText(/\/show/, async (msg) => {
  const chatId = msg.chat.id;
  ensureUser(chatId, { firstName: msg.from?.first_name || '', username: msg.from?.username || '' });
  logUserInfo(msg.from, chatId, '/show');
  const lang = getLang(chatId);
  const user = getUser(chatId);
  if (!user?.trackings?.length) {
    await bot.sendMessage(chatId, t(lang, 'noTrackings'));
    return;
  }
  const text = user.trackings.map((tr, i) => formatTracking(lang, tr, i)).join('\n\n---\n\n');
  await bot.sendMessage(chatId, text);
});

bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat?.id;
  if (!chatId) return;
  const data = query.data;

  ensureUser(chatId, {
    firstName: query.from?.first_name || '',
    username: query.from?.username || ''
  });
  logUserInfo(query.from, chatId, data);

  try { await bot.answerCallbackQuery(query.id); } catch { /* expired */ }

  if (data === 'lang_tr' || data === 'lang_en') {
    const lang = data === 'lang_tr' ? 'tr' : 'en';
    updateUser(chatId, u => ({ ...u, lang }));
    const user = getUser(chatId);
    const hasTrackings = !!(user?.trackings?.length);
    await editStep(
      chatId,
      query.message.message_id,
      t(lang, 'welcome', user?.firstName || 'user'),
      mainMenu(lang, hasTrackings)
    );
    return;
  }

  const lang = getLang(chatId);

  if (data === 'back_main') {
    resetDraft(chatId);
    await showMainMenu(chatId, null, query.message.message_id);
    return;
  }

  if (data === 'chatid_btn') {
    await bot.answerCallbackQuery(query.id);
    const chatIdText = t(lang, 'myChatId', chatId);
    await bot.sendMessage(chatId, chatIdText, {
      entities: [{ type: 'text_link', url: `tg://user?id=${chatId}`, offset: chatIdText.indexOf(String(chatId)), length: String(chatId).length }]
    });
    return;
  }

  if (data === 'back_to_apt') {
    const draft = getUser(chatId)?.draftTracking || {};
    setState(chatId, null, {});
    await editStep(chatId, query.message.message_id, t(lang, 'selectAppointmentType'), appointmentTypeMenu(lang));
    return;
  }

  if (data === 'back_to_city') {
    const draft = getUser(chatId)?.draftTracking || {};
    const appt = APPOINTMENT_TYPES[draft.appointmentType];
    setState(chatId, 'awaiting_city', {});
    const msgId = query.message.message_id;

    await bot.editMessageText(t(lang, 'loadingDesksTracking'), {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });

    try {
      const rawNames = appt ? await getAvailableDesks(appt.url) : Object.keys(DESKS);
      const rows = rawNames.map(name => ([
        { text: `🏢 ${name}`, callback_data: `city_${name}` }
      ]));
      rows.push(...navRow(lang, 'back_to_apt'));
      await bot.editMessageText(t(lang, 'selectCity', appt?.label || ''), {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: rows }
      });
    } catch (err) {
      await bot.editMessageText(`❌ Hata: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, 'back_to_apt') }
      });
    }
    return;
  }

  if (data === 'back_to_days') {
    const draft = getUser(chatId)?.draftTracking || {};
    const selectedDays = draft.selectedDays || draft.days || [];
    setState(chatId, 'awaiting_days', { selectedDays });
    await editStep(chatId, query.message.message_id, t(lang, 'selectDays', draft.city || ''), dayPickerMenu(lang, selectedDays));
    return;
  }

  if (data === 'back_to_month') {
    setState(chatId, 'awaiting_start_month', {});
    const draft = getUser(chatId)?.draftTracking || {};
    const days = draft.days || draft.selectedDays || [];
    await editStep(chatId, query.message.message_id, t(lang, 'daysConfirmed', days.join(', ')), monthMenu(lang));
    return;
  }

  if (data === 'back_to_monthcount') {
    const draft = getUser(chatId)?.draftTracking || {};
    setState(chatId, 'awaiting_month_count', {});
    await editStep(chatId, query.message.message_id, t(lang, 'selectMonthCount', draft.startMonth || ''), monthCountMenu(lang));
    return;
  }

  if (data === 'back_to_timefrom') {
    setState(chatId, 'awaiting_time_from', {});
    await editStep(chatId, query.message.message_id, t(lang, 'selectTimeFrom'), timeFromMenu(lang));
    return;
  }

  if (data === 'browse') {
    await editStep(chatId, query.message.message_id, t(lang, 'browseSelectApt'), browseAptMenu(lang));
    return;
  }

  if (data === 'back_to_browseapt') {
    await editStep(chatId, query.message.message_id, t(lang, 'browseSelectApt'), browseAptMenu(lang));
    return;
  }

  if (data.startsWith('brow_apt|')) {
    const aptKey = data.split('|')[1];
    const appt = APPOINTMENT_TYPES[aptKey];
    if (!appt) return;
    const msgId = query.message.message_id;

    await bot.editMessageText(t(lang, 'loadingDesks'), {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });

    try {
      const deskNames = await getAvailableDesks(appt.url);
      const rows = deskNames.map(name => {
        const cityKey = matchDeskToCity(name);
        return [{ text: `🏢 ${name}`, callback_data: `brow_city|${aptKey}|${cityKey}` }];
      });
      rows.push(...navRow(lang, 'back_to_browseapt'));
      await bot.editMessageText(t(lang, 'browseSelectCity', appt.label), {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: rows }
      });
    } catch (err) {
      await bot.editMessageText(`❌ Hata: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, 'back_to_browseapt') }
      });
    }
    return;
  }

  if (data.startsWith('back_to_browsecity|')) {
    const aptKey = data.split('|')[1];
    const appt = APPOINTMENT_TYPES[aptKey];
    if (!appt) return;
    const msgId = query.message.message_id;

    await bot.editMessageText(t(lang, 'loadingDesks'), {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });

    try {
      const deskNames = await getAvailableDesks(appt.url);
      const rows = deskNames.map(name => {
        const cityKey = matchDeskToCity(name);
        return [{ text: `🏢 ${name}`, callback_data: `brow_city|${aptKey}|${cityKey}` }];
      });
      rows.push(...navRow(lang, 'back_to_browseapt'));
      await bot.editMessageText(t(lang, 'browseSelectCity', appt.label), {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: rows }
      });
    } catch (err) {
      await bot.editMessageText(`❌ Hata: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, 'back_to_browseapt') }
      });
    }
    return;
  }

  if (data.startsWith('brow_city|')) {
    const [, aptKey, city] = data.split('|');
    await editStep(chatId, query.message.message_id, t(lang, 'browseSelectMonth', city), browseMonthMenu(lang, aptKey, city));
    return;
  }

  if (data.startsWith('brow_month|')) {
    const parts = data.split('|');
    const aptKey = parts[1];
    const city = parts[2];
    const month = parts.slice(3).join('|');
    const appt = APPOINTMENT_TYPES[aptKey];
    if (!appt) return;
    const msgId = query.message.message_id;

    await bot.editMessageText(t(lang, 'browseSearching'), {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });

    let browser = null;
    try {
      const { browser: br, page } = await openAndPreparePage(appt.url, city);
      browser = br;
      const openLabel = await getOpenMonthLabel(page);
      const fromLabel = openLabel || todayMonthLabel();
      const diff = monthDiff(fromLabel, month);
      for (let i = 0; i < diff; i++) {
        try { await clickNextMonth(page); } catch { break; }
      }
      const days = await getAvailableDays(page);
      await browser.close(); browser = null;

      if (!days.length) {
        await bot.editMessageText(t(lang, 'browseNoDays', month, city), {
          chat_id: chatId, message_id: msgId,
          reply_markup: { inline_keyboard: navRow(lang, `back_to_browsecity|${aptKey}`) }
        });
        return;
      }

      const dayRows = [];
      let row = [];
      for (const day of days) {
        row.push({ text: String(day), callback_data: `brow_day|${aptKey}|${city}|${month}|${day}` });
        if (row.length === 5) { dayRows.push(row); row = []; }
      }
      if (row.length) dayRows.push(row);
      dayRows.push(...navRow(lang, `back_to_browsecity|${aptKey}`));

      await bot.editMessageText(t(lang, 'browseAvailableDays', month, city), {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: dayRows }
      });
    } catch (err) {
      if (browser) { try { await browser.close(); } catch {} }
      await bot.editMessageText(`❌ Hata: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, 'back_main') }
      });
    }
    return;
  }

  if (data.startsWith('brow_day|')) {
    const parts = data.split('|');
    const aptKey = parts[1];
    const city = parts[2];
    const day = parseInt(parts[parts.length - 1]);
    const month = parts.slice(3, parts.length - 1).join('|');
    const appt = APPOINTMENT_TYPES[aptKey];
    if (!appt) return;
    const msgId = query.message.message_id;

    await bot.editMessageText(t(lang, 'browseSearching'), {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });

    let browser = null;
    try {
      const { browser: br, page } = await openAndPreparePage(appt.url, city);
      browser = br;
      const openLabel = await getOpenMonthLabel(page);
      const fromLabel = openLabel || todayMonthLabel();
      const diff = monthDiff(fromLabel, month);
      console.log(`[browse] ${chatId} brow_day: city=${city} month=${month} day=${day} openLabel=${openLabel} diff=${diff}`);
      for (let i = 0; i < diff; i++) {
        try { await clickNextMonth(page); } catch { break; }
      }
      await page.waitForTimeout(2000);
      await clickOnDay(page, day);
      const times = await getAvailableTimes(page, 30000);
      console.log(`[browse] ${chatId} day=${day} times: ${times.join(', ') || 'none'}`);
      await browser.close(); browser = null;

      const backCb = `brow_month|${aptKey}|${city}|${month}`;
      if (!times.length) {
        await bot.editMessageText(t(lang, 'browseNoTimes', day, month, city), {
          chat_id: chatId, message_id: msgId,
          reply_markup: { inline_keyboard: navRow(lang, backCb) }
        });
        return;
      }

      const text = `${t(lang, 'browseDayTimes', day, month, city)}\n\n${t(lang, 'browseTimesList', times)}`;
      await bot.editMessageText(text, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, backCb) }
      });
    } catch (err) {
      if (browser) { try { await browser.close(); } catch {} }
      await bot.editMessageText(`❌ Hata: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, 'back_main') }
      });
    }
    return;
  }

  if (data === 'help') {
    await bot.sendMessage(chatId, t(lang, 'helpText'));
    return;
  }

  if (data === 'new_tracking') {
    resetDraft(chatId);
    await editStep(chatId, query.message.message_id, t(lang, 'selectAppointmentType'), appointmentTypeMenu(lang));
    return;
  }

  if (data.startsWith('apt_')) {
    const aptKey = data.replace('apt_', '');
    const appt = APPOINTMENT_TYPES[aptKey];
    if (!appt) return;
    setState(chatId, 'awaiting_city', { appointmentType: aptKey });
    const msgId = query.message.message_id;

    await bot.editMessageText(t(lang, 'loadingDesksTracking'), {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });

    try {
      const deskNames = await getAvailableDesks(appt.url);
      const rows = deskNames.map(name => ([
        { text: `🏢 ${name}`, callback_data: `city_${name}` }
      ]));
      rows.push(...navRow(lang, 'back_to_apt'));
      await bot.editMessageText(t(lang, 'selectCity', appt.label), {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: rows }
      });
    } catch (err) {
      await bot.editMessageText(`❌ Hata: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: navRow(lang, 'back_to_apt') }
      });
    }
    return;
  }

  if (data.startsWith('city_')) {
    const city = data.replace('city_', '');
    setState(chatId, 'awaiting_days', { city, selectedDays: [] });
    await editStep(chatId, query.message.message_id, t(lang, 'selectDays', city), dayPickerMenu(lang, []));
    return;
  }

  if (data.startsWith('daysel_')) {
    const day = Number(data.replace('daysel_', ''));
    const user = getUser(chatId);
    const draft = user?.draftTracking || {};
    let days = [...(draft.selectedDays || [])];
    if (days.includes(day)) {
      days = days.filter(d => d !== day);
    } else {
      days.push(day);
    }
    setState(chatId, 'awaiting_days', { selectedDays: days });
    try {
      await bot.editMessageReplyMarkup(
        dayPickerMenu(lang, days).reply_markup,
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch { /* same markup */ }
    return;
  }

  if (data === 'dayconfirm') {
    const user = getUser(chatId);
    const draft = user?.draftTracking || {};
    const days = (draft.selectedDays || []).sort((a, b) => a - b);
    if (days.length === 0) {
      const currentDays = draft.selectedDays || [];
      try {
        await bot.editMessageReplyMarkup(
          dayPickerMenu(lang, currentDays).reply_markup,
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch {}
      return;
    }
    setState(chatId, 'awaiting_start_month', { days });
    await editStep(chatId, query.message.message_id, t(lang, 'daysConfirmed', days.join(', ')), monthMenu(lang));
    return;
  }

  if (data.startsWith('mth_')) {
    const startMonth = data.replace('mth_', '');
    setState(chatId, 'awaiting_month_count', { startMonth });
    await editStep(chatId, query.message.message_id, t(lang, 'selectMonthCount', startMonth), monthCountMenu(lang));
    return;
  }

  if (data.startsWith('cnt_')) {
    const monthCount = parseInt(data.replace('cnt_', ''));
    const user = getUser(chatId);
    const draft = user?.draftTracking || {};

    if (!draft.appointmentType || !draft.city || !draft.days || !draft.startMonth) {
      console.log(`[cnt_] chatId=${chatId} missing fields — apt=${draft.appointmentType} city=${draft.city} days=${JSON.stringify(draft.days)} month=${draft.startMonth}`);
      if (!draft.appointmentType || !draft.city) {
        resetDraft(chatId);
        await bot.sendMessage(chatId, t(lang, 'selectAppointmentType'), appointmentTypeMenu(lang));
      } else if (!draft.days || draft.days.length === 0) {
        setState(chatId, 'awaiting_days', { selectedDays: [] });
        await bot.sendMessage(chatId, t(lang, 'selectDays', draft.city), dayPickerMenu(lang, []));
      } else {
        setState(chatId, 'awaiting_start_month', {});
        await bot.sendMessage(chatId, t(lang, 'daysConfirmed', draft.days.join(', ')), monthMenu(lang));
      }
      return;
    }

    setState(chatId, 'awaiting_time_from', { monthCount });
    await editStep(chatId, query.message.message_id, t(lang, 'selectTimeFrom'), timeFromMenu(lang));
    return;
  }

  if (data.startsWith('tfrom_')) {
    const val = data.replace('tfrom_', '');
    const msgId = query.message.message_id;

    if (val === 'any') {
      await tryDelete(chatId, msgId);
      await createTrackingFromDraft(chatId, lang, null, null);
      return;
    }

    const fromHour = parseInt(val);
    setState(chatId, 'awaiting_time_to', { timeFrom: fromHour });
    await editStep(chatId, msgId, t(lang, 'selectTimeTo', fromHour), timeToMenu(lang, fromHour));
    return;
  }

  if (data.startsWith('tto_')) {
    const toHour = parseInt(data.replace('tto_', ''));
    const user = getUser(chatId);
    const draft = user?.draftTracking || {};
    await tryDelete(chatId, query.message.message_id);
    await createTrackingFromDraft(chatId, lang, draft.timeFrom ?? null, toHour);
    return;
  }

  if (data === 'list_trackings') {
    const user = getUser(chatId);
    if (!user?.trackings.length) {
      await editStep(chatId, query.message.message_id, t(lang, 'noTrackings'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } });
      return;
    }
    const text = user.trackings.map((tr, i) => formatTracking(lang, tr, i)).join('\n\n---\n\n');
    await editStep(chatId, query.message.message_id, text, {
      reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] }
    });
    return;
  }

  if (data === 'stop_menu') {
    const user = getUser(chatId);
    if (!user?.trackings.length) {
      await editStep(chatId, query.message.message_id, t(lang, 'noTrackings'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } });
      return;
    }
    const keyboard = user.trackings.map((tr, i) => {
      const label = APPOINTMENT_TYPES[tr.appointmentType]?.label || tr.appointmentType;
      return tr.active
        ? [{ text: t(lang, 'btnStop', i, tr.city, label), callback_data: `deactivate_${i}` }]
        : [{ text: t(lang, 'btnActivate', i, tr.city, label), callback_data: `activate_${i}` }];
    });
    keyboard.push([backBtn(lang)]);
    await editStep(chatId, query.message.message_id, t(lang, 'changeStatus'), { reply_markup: { inline_keyboard: keyboard } });
    return;
  }

  if (data.startsWith('deactivate_')) {
    const idx = Number(data.replace('deactivate_', ''));
    const user = getUser(chatId);
    if (!user?.trackings[idx]) { await editStep(chatId, query.message.message_id, t(lang, 'trackingNotFound'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } }); return; }
    updateUser(chatId, u => {
      const t2 = [...u.trackings];
      t2[idx] = { ...t2[idx], active: false };
      return { ...u, trackings: t2 };
    });
    await showMainMenu(chatId, t(lang, 'trackingStopped', idx), query.message.message_id);
    return;
  }

  if (data.startsWith('activate_')) {
    const idx = Number(data.replace('activate_', ''));
    const user = getUser(chatId);
    if (!user?.trackings[idx]) { await editStep(chatId, query.message.message_id, t(lang, 'trackingNotFound'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } }); return; }
    updateUser(chatId, u => {
      const t2 = [...u.trackings];
      t2[idx] = { ...t2[idx], active: true, lastNotified: null, pendingAck: false };
      return { ...u, trackings: t2 };
    });
    await showMainMenu(chatId, t(lang, 'trackingActivated', idx), query.message.message_id);
    return;
  }

  if (data === 'delete_menu') {
    const user = getUser(chatId);
    if (!user?.trackings.length) {
      await editStep(chatId, query.message.message_id, t(lang, 'noTrackings'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } });
      return;
    }
    const keyboard = user.trackings.map((tr, i) => {
      const label = APPOINTMENT_TYPES[tr.appointmentType]?.label || tr.appointmentType;
      return [{ text: t(lang, 'btnDeleteItem', i, tr.city, label), callback_data: `delete_confirm_${i}` }];
    });
    keyboard.push([backBtn(lang)]);
    await editStep(chatId, query.message.message_id, t(lang, 'deleteMenu'), { reply_markup: { inline_keyboard: keyboard } });
    return;
  }

  if (data.startsWith('delete_confirm_')) {
    const idx = Number(data.replace('delete_confirm_', ''));
    const user = getUser(chatId);
    const tr = user?.trackings[idx];
    if (!tr) { await editStep(chatId, query.message.message_id, t(lang, 'trackingNotFound'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } }); return; }
    const label = APPOINTMENT_TYPES[tr.appointmentType]?.label || tr.appointmentType;
    await editStep(chatId, query.message.message_id, t(lang, 'deleteConfirm', idx, tr.city, label), {
      reply_markup: {
        inline_keyboard: [[
          { text: t(lang, 'btnDeleteYes'), callback_data: `delete_yes_${idx}` },
          { text: t(lang, 'btnDeleteNo'), callback_data: 'delete_menu' }
        ]]
      }
    });
    return;
  }

  if (data.startsWith('delete_yes_')) {
    const idx = Number(data.replace('delete_yes_', ''));
    const user = getUser(chatId);
    if (!user?.trackings[idx]) { await editStep(chatId, query.message.message_id, t(lang, 'trackingNotFound'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } }); return; }
    updateUser(chatId, u => ({
      ...u,
      trackings: u.trackings.filter((_, i) => i !== idx)
    }));
    await showMainMenu(chatId, t(lang, 'deleteDone', idx), query.message.message_id);
    return;
  }

  if (data === 'reset_confirm') {
    const user = getUser(chatId);
    if (!user?.trackings.length) {
      await editStep(chatId, query.message.message_id, t(lang, 'noTrackingsToReset'), { reply_markup: { inline_keyboard: [[backBtn(lang, 'back_main')]] } });
      return;
    }
    await editStep(chatId, query.message.message_id, t(lang, 'confirmReset'), {
      reply_markup: {
        inline_keyboard: [[
          { text: t(lang, 'btnConfirmReset'), callback_data: 'reset_yes' },
          { text: t(lang, 'btnCancelReset'), callback_data: 'back_main' }
        ]]
      }
    });
    return;
  }

  if (data === 'reset_yes') {
    updateUser(chatId, u => ({ ...u, trackings: [], state: null, draftTracking: {} }));
    await showMainMenu(chatId, t(lang, 'resetDone'), query.message.message_id);
    return;
  }

  if (data.startsWith('ack_')) {
    const idx = Number(data.replace('ack_', ''));
    const user = getUser(chatId);
    if (!user?.trackings[idx]) { await bot.sendMessage(chatId, t(lang, 'trackingNotFound')); return; }
    updateUser(chatId, u => {
      const t2 = [...u.trackings];
      t2[idx] = { ...t2[idx], pendingAck: false, active: false };
      return { ...u, trackings: t2 };
    });
    await bot.sendMessage(chatId, t(lang, 'ackDone', idx));
    return;
  }
});

bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;
  const lang = getLang(chatId);
  const user = getUser(chatId);
  if (!user?.trackings.length) {
    await bot.sendMessage(chatId, t(lang, 'noTrackings'));
    return;
  }
  const text = user.trackings.map((tr, i) => formatTracking(lang, tr, i)).join('\n\n---\n\n');
  await bot.sendMessage(chatId, text);
});

bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  ensureUser(chatId, { firstName: msg.from?.first_name || '', username: msg.from?.username || '' });
  logUserInfo(msg.from, chatId, '/clear');
  const lang = getLang(chatId);
  const user = getUser(chatId);
  if (!user?.trackings.length) {
    await bot.sendMessage(chatId, t(lang, 'noTrackingsToReset'));
    return;
  }
  await bot.sendMessage(chatId, t(lang, 'confirmReset'), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: t(lang, 'btnConfirmReset'), callback_data: 'reset_yes' },
          { text: t(lang, 'btnCancelReset'), callback_data: 'back_main' }
        ]
      ]
    }
  });
});

bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  const lang = getLang(chatId);
  const user = getUser(chatId);

  const active = (user?.trackings || []).filter(tr => tr.active);
  if (!active.length) {
    await bot.sendMessage(chatId, lang === 'tr'
      ? '⚠️ Aktif takip yok. Önce /start ile takip oluşturun.'
      : '⚠️ No active trackings. Use /start to create one.');
    return;
  }

  await bot.sendMessage(chatId, lang === 'tr'
    ? `🔍 ${active.length} takip kontrol ediliyor, lütfen bekleyin...`
    : `🔍 Checking ${active.length} tracking(s), please wait...`);

  for (let i = 0; i < user.trackings.length; i++) {
    const tr = user.trackings[i];
    if (!tr.active) continue;
    try {
      const result = await checkTracking(tr, msg2 => console.log(`[check-cmd][${chatId}] ${msg2}`), lang);
      if (result.found) {
        await bot.sendMessage(chatId, result.message, ackKeyboard(lang, i));
        updateUser(chatId, u => {
          const t2 = [...u.trackings];
          t2[i] = { ...t2[i], lastNotified: result.slotKey, pendingAck: true, lastNotifiedAt: Date.now() };
          return { ...u, trackings: t2 };
        });
      } else {
        const apptLabel = (require('./checker').APPOINTMENT_TYPES[tr.appointmentType] || {}).label || tr.appointmentType;
        await bot.sendMessage(chatId, lang === 'tr'
          ? `❌ ${apptLabel} / ${tr.city} — Seçili günlerde uygun slot bulunamadı.`
          : `❌ ${apptLabel} / ${tr.city} — No slots found for selected days.`);
      }
    } catch (err) {
      console.error(`[check-cmd] error chatId=${chatId}:`, err.message);
      await bot.sendMessage(chatId, lang === 'tr'
        ? `⚠️ Kontrol sırasında hata: ${err.message}`
        : `⚠️ Check error: ${err.message}`);
    }
  }
});

const FIVE_MIN = 5 * 60 * 1000;

function ackKeyboard(lang, trackingIdx) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: t(lang, 'ackBtn'), callback_data: `ack_${trackingIdx}` }]]
    }
  };
}

async function runChecks() {
  const users = getAllUsers();
  for (const user of users) {
    const lang = user.lang || 'tr';
    for (let i = 0; i < user.trackings.length; i++) {
      const tr = user.trackings[i];
      if (!tr.active) continue;

      try {
        const result = await checkTracking(tr, msg => console.log(`[${user.chatId}] ${msg}`), lang);

        if (!result.found) {
          if (tr.pendingAck && tr.lastNotified === result.slotKey) {
            updateUser(user.chatId, u => {
              const t2 = [...u.trackings];
              t2[i] = { ...t2[i], pendingAck: false, lastNotified: null };
              return { ...u, trackings: t2 };
            });
          }
          continue;
        }

        const now = Date.now();

        if (tr.pendingAck && tr.lastNotified === result.slotKey) {
          if (now - (tr.lastNotifiedAt || 0) >= FIVE_MIN) {
            await bot.sendMessage(
              user.chatId,
              t(lang, 'reminder', result.message),
              ackKeyboard(lang, i)
            );
            updateUser(user.chatId, u => {
              const t2 = [...u.trackings];
              t2[i] = { ...t2[i], lastNotifiedAt: now };
              return { ...u, trackings: t2 };
            });
          }
          continue;
        }

        if (!tr.pendingAck && tr.lastNotified === result.slotKey) continue;

        await bot.sendMessage(user.chatId, result.message, ackKeyboard(lang, i));

        updateUser(user.chatId, u => {
          const t2 = [...u.trackings];
          t2[i] = { ...t2[i], lastNotified: result.slotKey, pendingAck: true, lastNotifiedAt: now };
          return { ...u, trackings: t2 };
        });
      } catch (err) {
        console.error(`Check error [${user.chatId}]:`, err.message);
      }
    }
  }
}

if (!useWebhook) {
  let _pollingBackoff = 5000;
  let _pollingPaused = false;
  bot.on('polling_error', async err => {
    const is409 = err?.message?.includes('409');
    if (is409 && !_pollingPaused) {
      _pollingPaused = true;
      console.log(`[polling] 409 conflict — pausing ${_pollingBackoff / 1000}s`);
      try { await bot.stopPolling(); } catch {}
      await new Promise(r => setTimeout(r, _pollingBackoff));
      _pollingBackoff = Math.min(_pollingBackoff * 2, 5 * 60 * 1000);
      _pollingPaused = false;
      try { await bot.startPolling(); } catch {}
    } else if (!is409) {
      console.error('Polling error:', err?.message);
    }
  });
}
console.log('Telegram bot started...');
