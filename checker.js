const path = require('path');
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, '.playwright');
const { chromium } = require('playwright');
const { t } = require('./i18n');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const APPOINTMENT_TYPES = {
  collect_document: {
    label: 'Collect Document',
    url: 'https://oap.ind.nl/oap/en/#/doc'
  },
  biometrics: {
    label: 'Biometrics Appointment',
    url: 'https://oap.ind.nl/oap/en/#/bio'
  },
  residence_sticker: {
    label: 'Residence Endorsement Sticker',
    url: 'https://oap.ind.nl/oap/en/#/VAA'
  },
  return_visa: {
    label: 'Return Visa',
    url: 'https://oap.ind.nl/oap/en/#/TKV'
  },
  asylum_reunification: {
    label: 'Asylum Family Reunification',
    url: 'https://oap.ind.nl/oap/en/#/nra'
  },
  for_ukraine: {
    label: 'For Ukraine',
    url: 'https://oap.ind.nl/oap/en/#/OEK'
  }
};

const DESKS = {
  'Amsterdam': 'AM',
  'Den Haag': 'DH',
  "'s-Hertogenbosch": 'DB',
  'Zwolle': 'ZW',
  'Rotterdam': 'RO'
};

function monthNameToIndex(name) {
  return MONTH_NAMES.findIndex(m => m.toLowerCase() === String(name).toLowerCase());
}

function parseMonthLabel(label) {
  const m = String(label || '').match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})$/i
  );
  if (!m) throw new Error(`Invalid month format: ${label}`);

  const monthName = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const year = Number(m[2]);
  const monthIndex = MONTH_NAMES.indexOf(monthName);
  return { monthIndex, year };
}

function monthDiff(fromLabel, toLabel) {
  const from = parseMonthLabel(fromLabel);
  const to = parseMonthLabel(toLabel);
  return (to.year - from.year) * 12 + (to.monthIndex - from.monthIndex);
}

function buildMonthSequence(startMonth, monthCount) {
  const { monthIndex, year } = parseMonthLabel(startMonth);
  const result = [];
  for (let i = 0; i < monthCount; i++) {
    const idx = (monthIndex + i) % 12;
    const yr = year + Math.floor((monthIndex + i) / 12);
    result.push(`${MONTH_NAMES[idx]} ${yr}`);
  }
  return result;
}

async function getAvailableDesks(url) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    await page.waitForFunction(() => {
      const s = document.querySelector('#desk');
      return s && s.querySelectorAll('option').length > 1;
    }, { timeout: 20000 });

    const desks = await page.evaluate(() => {
      const select = document.querySelector('#desk');
      if (!select) return [];
      return Array.from(select.querySelectorAll('option'))
        .map(o => (o.textContent || '').trim())
        .filter(text => text.length > 0);
    });

    return desks;
  } finally {
    await browser.close();
  }
}

async function openAndPreparePage(url, cityName) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    await page.waitForFunction(() => {
      const s = document.querySelector('#desk');
      return s && s.querySelectorAll('option').length > 1;
    }, { timeout: 20000 });

    const matched = await page.evaluate((city) => {
      const select = document.querySelector('#desk');
      const opts = Array.from(select.querySelectorAll('option'));
      const found = opts.find(o => {
        const text = (o.textContent || '').trim();
        if (!text) return false;
        const stripped = text.toLowerCase().replace(/^ind\s*/i, '').replace(/\s+leeghwaterlaan.*$/, '').trim();
        return text === city ||
               text.toLowerCase().includes(city.toLowerCase()) ||
               (stripped.length > 0 && city.toLowerCase().includes(stripped));
      });
      return found ? found.textContent.trim() : null;
    }, cityName);

    if (!matched) throw new Error(`Desk not found for city: ${cityName}`);

    await page.locator('#desk').selectOption({ label: matched });
    await page.waitForTimeout(4000);
    return { browser, page };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function clickNextMonth(page) {
  const clicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button, a, span, div'));
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const cls = (el.className || '').toString().toLowerCase();

      if (
        text === '>' || text === '›' || text === '→' ||
        aria.includes('next') || title.includes('next') || cls.includes('next')
      ) {
        el.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) throw new Error('Calendar next button could not be found.');
  await page.waitForTimeout(1800);
}

async function getOpenMonthLabel(page) {
  return await page.evaluate((months) => {
    const candidates = Array.from(document.querySelectorAll(
      'h1, h2, h3, h4, h5, .calendar-title, .month-title, ' +
      'thead th, [class*="month"], [class*="calendar"], ' +
      '[class*="header"], caption, td, th, span, div, button, p'
    ));
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      if (text.length > 40) continue;
      for (const m of months) {
        if (text.includes(m) && /20\d{2}/.test(text)) {
          const year = text.match(/20\d{2}/)?.[0];
          return `${m} ${year}`;
        }
      }
    }
    return null;
  }, MONTH_NAMES);
}

function todayMonthLabel() {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

async function getAvailableDays(page) {
  return await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const found = [];

    for (const el of spans) {
      const text = (el.textContent || '').trim();
      if (!/^\d{1,2}$/.test(text)) continue;

      const day = Number(text);
      if (day < 1 || day > 31) continue;

      const className = (el.className || '').toString().toLowerCase();
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      if (rect.width < 20 || rect.height < 20) continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (className.includes('disabled') || className.includes('is-other-month')) continue;

      found.push(day);
    }

    return [...new Set(found)].sort((a, b) => a - b);
  });
}

async function clickOnDay(page, day) {
  const dayStr = String(day);

  const tdIndex = await page.evaluate((targetDay) => {
    const tds = Array.from(document.querySelectorAll('td'));

    const calTds = tds.filter(td => {
      const rect = td.getBoundingClientRect();
      return rect.width >= 18 && rect.height >= 18;
    });

    let day1Pos = -1;
    for (let i = 0; i < calTds.length; i++) {
      const text = (calTds[i].innerText || calTds[i].textContent || '').trim();
      const cls = (calTds[i].className || '').toString().toLowerCase();
      if (text === '1' && !cls.includes('disabled') && !cls.includes('muted')) {
        day1Pos = i;
        break;
      }
    }

    const searchFrom = day1Pos >= 0 ? day1Pos : 0;
    for (let i = searchFrom; i < calTds.length; i++) {
      const text = (calTds[i].innerText || calTds[i].textContent || '').trim();
      const cls = (calTds[i].className || '').toString().toLowerCase();
      if (text === String(targetDay) && !cls.includes('disabled') && !cls.includes('muted')) {
        return tds.indexOf(calTds[i]);
      }
    }
    return -1;
  }, day);

  if (tdIndex < 0) {
    console.log(`[clickOnDay] day=${day} — TD bulunamadı`);
    await page.waitForTimeout(4000);
    return;
  }

  try {
    const loc = page.locator('td').nth(tdIndex);
    const cls = await loc.getAttribute('class') || '';
    console.log(`[clickOnDay] day=${day} nth=${tdIndex} cls="${cls}"`);
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 5000 });
    console.log(`[clickOnDay] day=${day} clicked via nth locator`);
  } catch (err) {
    console.log(`[clickOnDay] day=${day} click failed: ${err.message}`);
  }

  await page.waitForTimeout(4000);
}

async function getAvailableTimes(page, timeoutMs = 30000) {
  try {
    await page.waitForFunction(
      () => {
        const sel = document.querySelector('#timeSlot, select[name="timeSlot"]');
        if (!sel) return false;
        return Array.from(sel.options).some(o => (o.value || '').toString().trim().length > 0);
      },
      { timeout: timeoutMs }
    );
  } catch {
    return [];
  }

  return await page.evaluate(() => {
    const found = new Set();
    const rangeRe = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/;
    const startRe = /\b(\d{1,2}):(\d{2})\b/;

    function pad(t) {
      const [h, m] = t.split(':');
      return `${String(parseInt(h)).padStart(2, '0')}:${m}`;
    }

    const timeSlot = document.querySelector('#timeSlot, select[name="timeSlot"]');
    const source = timeSlot
      ? Array.from(timeSlot.options)
      : Array.from(document.querySelectorAll('select option'));

    for (const opt of source) {
      const text = (opt.text || opt.value || '').trim();
      if (!text) continue;
      const rng = text.match(rangeRe);
      if (rng) {
        const startH = parseInt(rng[1].split(':')[0], 10);
        if (startH >= 7 && startH <= 19) {
          found.add(`${pad(rng[1])}-${pad(rng[2])}`);
        }
      } else {
        const m = text.match(startRe);
        if (m) {
          const h = parseInt(m[1], 10);
          if (h >= 7 && h <= 19) {
            found.add(`${String(h).padStart(2, '0')}:${m[2]}`);
          }
        }
      }
    }

    return [...found].sort();
  });
}

function filterTimesByRange(times, fromHour, toHour) {
  return times.filter(slot => {
    const start = slot.split('-')[0].trim();
    const parts = start.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const slotMinutes = h * 60 + m;
    const fromMinutes = fromHour * 60;
    const toMinutes = toHour * 60;
    return slotMinutes >= fromMinutes && slotMinutes < toMinutes;
  });
}

async function checkTracking(tracking, log = () => {}, lang = 'tr') {
  const appt = APPOINTMENT_TYPES[tracking.appointmentType];
  if (!appt) return { found: false };

  const monthList = buildMonthSequence(tracking.startMonth, tracking.monthCount);
  const watchedDays = tracking.days || [];
  const hasTimeFilter = tracking.timeFrom != null && tracking.timeTo != null;

  log(`Checking: ${appt.label} / ${tracking.city}${hasTimeFilter ? ` / ${tracking.timeFrom}:00-${tracking.timeTo}:00` : ''}`);

  const foundMatches = [];
  let browser = null;

  try {
    for (const targetMonth of monthList) {
      let prepared;
      try {
        prepared = await openAndPreparePage(appt.url, tracking.city);
      } catch (err) {
        log(`Page open error: ${err.message}`);
        continue;
      }

      browser = prepared.browser;
      const page = prepared.page;

      const openMonthLabel = await getOpenMonthLabel(page);

      const detectedLabel = openMonthLabel || todayMonthLabel();
      if (!openMonthLabel) {
        log(`Could not detect open month — assuming ${detectedLabel} (today's month)`);
      }

      const diff = monthDiff(detectedLabel, targetMonth);
      log(`Open: ${detectedLabel}, target: ${targetMonth}, clicks: ${diff}`);

      if (diff < 0) {
        log(`Cannot navigate backward — skipping ${targetMonth}`);
        await browser.close();
        browser = null;
        continue;
      }

      for (let i = 0; i < diff; i++) {
        try { await clickNextMonth(page); } catch (e) {
          log(`clickNextMonth failed at step ${i}: ${e.message}`);
          break;
        }
      }

      const days = await getAvailableDays(page);
      log(`${targetMonth} available days: ${days.join(', ') || 'none'}`);

      const matchingDays = watchedDays.filter(d => days.includes(d));

      await browser.close();
      browser = null;

      for (const day of matchingDays) {
        if (!hasTimeFilter) {
          foundMatches.push({ month: targetMonth, day, times: null });
          log(`MATCH: ${targetMonth} day ${day}`);
          continue;
        }

        let timeBrowser = null;
        try {
          const p2 = await openAndPreparePage(appt.url, tracking.city);
          timeBrowser = p2.browser;
          const timePage = p2.page;

          const openLabel2 = await getOpenMonthLabel(timePage);
          const detectedLabel2 = openLabel2 || todayMonthLabel();
          const diff2 = monthDiff(detectedLabel2, targetMonth);
          for (let k = 0; k < diff2; k++) {
            try { await clickNextMonth(timePage); } catch { break; }
          }

          await clickOnDay(timePage, day);

          const rawTimes = await getAvailableTimes(timePage);
          log(`${targetMonth} day ${day} raw times: ${rawTimes.join(', ') || 'none'}`);

          const allMatching = filterTimesByRange(rawTimes, tracking.timeFrom, tracking.timeTo);
          const matchingTimes = allMatching;
          log(`Filtered times (${tracking.timeFrom}:00-${tracking.timeTo}:00): ${allMatching.join(', ') || 'none'} → ${matchingTimes.length} slot`);

          if (matchingTimes.length > 0) {
            foundMatches.push({ month: targetMonth, day, times: matchingTimes });
            log(`MATCH: ${targetMonth} day ${day} @ ${matchingTimes.join(', ')}`);
          } else {
            log(`Day ${day} available but no slots in time range`);
          }
        } catch (err) {
          log(`Time check error day ${day}: ${err.message}`);
        } finally {
          if (timeBrowser) await timeBrowser.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  if (foundMatches.length === 0) {
    log(`No matches for days: ${watchedDays.join(', ')}`);
    return { found: false };
  }

  const slotKey = foundMatches.map(m => `${m.month}|${m.day}|${(m.times || []).join('+')}`).join(',');

  const lines = foundMatches.map(m => {
    const base = t(lang, 'notifDayLine', m.month, m.day);
    return m.times && m.times.length > 0 ? `${base}\n  ⏰ ${m.times.join(', ')}` : base;
  });

  const timeInfo = hasTimeFilter
    ? `${t(lang, 'notifTimeFilter', tracking.timeFrom, tracking.timeTo)}\n\n`
    : '';

  const message =
    `${t(lang, 'notifTitle')}\n\n` +
    `📋 ${appt.label}\n` +
    `🏢 ${tracking.city}\n\n` +
    `${timeInfo}` +
    `${lines.join('\n')}\n\n` +
    `🔗 ${appt.url}`;

  return { found: true, slotKey, message };
}

module.exports = {
  checkTracking,
  APPOINTMENT_TYPES,
  DESKS,
  MONTH_NAMES,
  openAndPreparePage,
  getAvailableDesks,
  getAvailableDays,
  getAvailableTimes,
  clickOnDay,
  clickNextMonth,
  getOpenMonthLabel,
  todayMonthLabel,
  monthDiff,
  filterTimesByRange,
  buildMonthSequence
};
