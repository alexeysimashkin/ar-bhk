let currentMode = 'departure';
let editingId = null;
let showDepartedDep = false;
let showDepartedArr = false;
let currentTabDep = 'today';
let currentTabArr = 'today';
let flightsDep = [];
let flightsArr = [];
let audioEnabled = localStorage.getItem('audioEnabled') !== 'false';
const API = '/api/flights';

const $ = id => document.getElementById(id);

// Скрыть спиннер загрузки
const spinnerOverlay = $('spinnerOverlay');
setTimeout(() => {
  if (spinnerOverlay) spinnerOverlay.style.display = 'none';
}, 1500);

const clockTime = $('clockTime');
const LOCAL_OFFSET = 5 * 60;
function getLocalNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (LOCAL_OFFSET * 60000));
}

setInterval(() => {
  const now = getLocalNow();
  if (clockTime) clockTime.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}, 1000);

function fmtTm(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDt(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDateOnly(s) {
  if (!s) return '—';
  const d = new Date(s);
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ============ ТЁМНАЯ ТЕМА ============
const themeToggle = $('themeToggle');
if (themeToggle) {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  }
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
  });
}

// ============ АУДИО ============
const audioToggle = $('audioToggle');
if (audioToggle) {
  audioToggle.textContent = audioEnabled ? '🔊' : '🔇';
  audioToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    localStorage.setItem('audioEnabled', audioEnabled);
    audioToggle.textContent = audioEnabled ? '🔊' : '🔇';
  });
}

let isSpeaking = false;
let speechQueue = [];

function speak(text, lang = 'ru-RU') {
  if (!audioEnabled) return;
  if ('speechSynthesis' in window) {
    speechQueue.push({ text, lang });
    processQueue();
  }
}

function processQueue() {
  if (isSpeaking || speechQueue.length === 0) return;
  isSpeaking = true;
  const { text, lang } = speechQueue.shift();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = lang === 'en-US' ? 0.85 : 0.9;
  u.pitch = 1;
  u.onend = () => {
    isSpeaking = false;
    setTimeout(() => processQueue(), 300);
  };
  u.onerror = () => {
    isSpeaking = false;
    setTimeout(() => processQueue(), 300);
  };
  window.speechSynthesis.speak(u);
}

function formatCountersForSpeech(counters) {
  if (!counters) return '';
  return counters.replace(/\./g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ');
}

let lastAnnounced = {};

function announceStatusChange(f, statusType) {
  const now = getLocalNow();
  const timeKey = f.id + '-' + statusType;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  
  if (lastAnnounced[timeKey] && nowMinutes - lastAnnounced[timeKey] < 2) return;
  lastAnnounced[timeKey] = nowMinutes;

  const airline = f.airline || '';
  const flight = f.flightNumber || '';
  const city = f.destination || '';
  const counters = formatCountersForSpeech(f.checkInCounters || '');
  const gate = f.boardingGate || '';
  const delayTime = f.expectedDeparture ? fmtTm(f.expectedDeparture) : '';

  let textRu = '';
  let textEn = '';

  switch (statusType) {
    case 'checkin':
      textRu = `Уважаемые пассажиры! Начинается регистрация билетов и оформление багажа на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}. Приглашаем вас пройти к стойкам номер ${counters}.`;
      textEn = `Attention please! Check-in for ${airline} flight ${flight} to ${city} is open now at check-in counter number ${counters}.`;
      break;
    case 'checkin_completed':
      textRu = `Уважаемые пассажиры! Закончилась регистрация билетов и оформление багажа на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}.`;
      textEn = `Attention please! Check-in for ${airline} flight ${flight} to ${city} is finished.`;
      break;
    case 'boarding':
      textRu = `Уважаемые пассажиры! Начинается посадка на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}. Приглашаем вас пройти к выходу на посадку номер ${gate}.`;
      textEn = `Attention please! Boarding for ${airline} flight ${flight} to ${city} is open now at gate number ${gate}.`;
      break;
    case 'boarding_completed':
      textRu = `Уважаемые пассажиры! Закончилась посадка на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}.`;
      textEn = `Attention please! Boarding for ${airline} flight ${flight} to ${city} is finished.`;
      break;
    case 'delayed':
      textRu = `Внимание! К сведению пассажиров, вылетающих рейсом авиакомпании ${airline} ${flight} в ${city}, вылет вашего рейса задерживается до ${delayTime}. От имени авиакомпании мы приносим свои извинения за доставленные неудобства!`;
      textEn = `Attention please! Information for ${airline} flight ${flight} to ${city} has been delayed till ${delayTime}. On behalf of the airline, we apologise for the inconvenience.`;
      break;
    case 'cancelled':
      textRu = `Внимание! К сведению пассажиров, вылетающих рейсом авиакомпании ${airline} ${flight} в ${city}, ваш рейс отменён. Просим вас обращаться в представительство авиакомпании за получением более подробной информации.`;
      textEn = `Attention please! ${airline} flight ${flight} to ${city} has been cancelled! Please go to the ${airline} office for more information.`;
      break;
    case 'departed':
      textRu = `Уважаемые пассажиры! Рейс авиакомпании ${airline} ${flight} в ${city} вылетел.`;
      textEn = `${airline} flight ${flight} to ${city} has departed.`;
      break;
    case 'feeding':
      textRu = `Уважаемые пассажиры! Для пассажиров рейса авиакомпании ${airline} ${flight} в ${city} предоставляется питание.`;
      textEn = `Attention please! Meal service is provided for ${airline} flight ${flight} to ${city}.`;
      break;
  }

  if (textRu) speak(textRu, 'ru-RU');
  if (textEn) speak(textEn, 'en-US');
}

function checkScheduleForAudio() {
  if (!audioEnabled) return;
  const now = getLocalNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  flightsDep.forEach(f => {
    if (f.status === 'departed' || f.status === 'early_departed' || f.status === 'cancelled') return;

    if (f.checkInStart) {
      const t = new Date(f.checkInStart);
      const tm = t.getHours() * 60 + t.getMinutes();
      if (nowMinutes === tm) announceStatusChange(f, 'checkin');
    }
    if (f.checkInEnd) {
      const t = new Date(f.checkInEnd);
      const tm = t.getHours() * 60 + t.getMinutes();
      if (nowMinutes === tm) announceStatusChange(f, 'checkin_completed');
    }
    if (f.boardingStart) {
      const t = new Date(f.boardingStart);
      const tm = t.getHours() * 60 + t.getMinutes();
      if (nowMinutes === tm) announceStatusChange(f, 'boarding');
    }
    if (f.boardingEnd) {
      const t = new Date(f.boardingEnd);
      const tm = t.getHours() * 60 + t.getMinutes();
      if (nowMinutes === tm) announceStatusChange(f, 'boarding_completed');
    }
  });
}

// ============ АЭРОПОРТ ОТКРЫТ/ЗАКРЫТ ============
async function loadAirportStatus() {
  try {
    const r = await fetch('/api/airport-status');
    const data = await r.json();
    updateBanner(data.status);
  } catch(e) {}
}

function updateBanner(status) {
  const banner = $('airportBanner');
  if (!banner) return;
  if (status === 'closed') {
    banner.classList.add('closed');
    banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span id="airportBannerText">Аэропорт закрыт</span>';
    $('btnAirportClosed').style.display = 'none';
    $('btnAirportOpen').style.display = 'flex';
  } else {
    banner.classList.remove('closed');
    banner.innerHTML = '<i class="fas fa-check-circle"></i> <span id="airportBannerText">Аэропорт открыт</span>';
    $('btnAirportOpen').style.display = 'none';
    $('btnAirportClosed').style.display = 'flex';
  }
}

async function setAirportStatus(status) {
  await fetch('/api/airport-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  updateBanner(status);
}

if ($('btnAirportClosed')) $('btnAirportClosed').addEventListener('click', () => setAirportStatus('closed'));
if ($('btnAirportOpen')) $('btnAirportOpen').addEventListener('click', () => setAirportStatus('open'));

// ============ СРОЧНАЯ ИНФОРМАЦИЯ ============
async function loadUrgent() {
  try {
    const r = await fetch('/api/urgent');
    const data = await r.json();
    if (data.text) {
      $('urgentInfo').style.display = 'flex';
      $('urgentInfoText').textContent = data.text;
      $('urgentInput').value = data.text;
      $('btnUrgentDelete').style.display = 'flex';
    } else {
      $('urgentInfo').style.display = 'none';
      $('urgentInput').value = '';
      $('btnUrgentDelete').style.display = 'none';
    }
  } catch(e) {}
}

if ($('btnUrgentSave')) {
  $('btnUrgentSave').addEventListener('click', async () => {
    const text = $('urgentInput').value.trim();
    if (!text) return;
    await fetch('/api/urgent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    loadUrgent();
  });
}

if ($('btnUrgentDelete')) {
  $('btnUrgentDelete').addEventListener('click', async () => {
    await fetch('/api/urgent', { method: 'DELETE' });
    loadUrgent();
  });
}

// ============ PUSH-УВЕДОМЛЕНИЯ ============
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BNcC-bM8H_Py4XHqFzFcGK_kYfHKjLeZqFpZ8YrFqWXqKpFzFpFzA')
      });
    }
    console.log('Push подписка оформлена');
  } catch(e) {
    console.log('Push не поддерживается:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

// ============ ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ ============
document.querySelectorAll('.main-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    $('modeDeparture').style.display = currentMode === 'departure' ? '' : 'none';
    $('modeArrival').style.display = currentMode === 'arrival' ? '' : 'none';
    if (currentMode === 'departure') loadDep();
    else loadArr();
  });
});

// ============ ВЫЛЕТ ============
async function loadDep() {
  try {
    const r = await fetch(`${API}?type=departure&showDeparted=${showDepartedDep}`);
    const oldFlights = flightsDep;
    flightsDep = await r.json();
    renderAllDep();
    const now = getLocalNow();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    if ($('lastUpdatedDep')) $('lastUpdatedDep').textContent = ts;
    if ($('lastUpdatedDep2')) $('lastUpdatedDep2').textContent = ts;
    
    if (oldFlights.length > 0) {
      flightsDep.forEach(f => {
        const old = oldFlights.find(o => o.id === f.id);
        if (old) {
          if (f.status !== old.status && f.status !== 'scheduled') {
            announceStatusChange(f, f.status);
          }
          if (f.expectedDeparture && f.expectedDeparture !== old.expectedDeparture) {
            const newExp = new Date(f.expectedDeparture);
            const sched = new Date(f.scheduledDeparture);
            if (newExp > sched) announceStatusChange(f, 'delayed');
          }
          if (f.boardingGate && f.boardingGate !== old.boardingGate) {
            const textRu = `Внимание! К сведению пассажиров, вылетающих рейсом авиакомпании ${f.airline} ${f.flightNumber}, вылетающих в ${f.destination}, ваш выход на посадку был изменён. Новый номер выхода на посадку ${f.boardingGate}.`;
            const textEn = `Attention please! Information for ${f.airline} flight ${f.flightNumber} to ${f.destination}, your boarding gate has been changed to gate number ${f.boardingGate}.`;
            speak(textRu, 'ru-RU');
            speak(textEn, 'en-US');
          }
        }
      });
    }
    checkScheduleForAudio();
  } catch(e) { console.log(e); }
}

function getTagClass(f) {
  if (f.status === 'cancelled') return 'tag-cancel';
  if (f.status === 'departed' || f.status === 'early_departed') return 'tag-departed';
  if (f.status === 'suspended') return 'tag-suspended';
  if (f.computedStatus === 'early') return 'tag-early';
  if (f.computedStatus === 'checkin') return 'tag-checkin';
  if (f.computedStatus === 'checkin_completed') return 'tag-checkin-end';
  if (f.computedStatus === 'boarding') return 'tag-boarding';
  if (f.computedStatus === 'boarding_completed') return 'tag-boarding-end';
  if (f.computedStatus === 'delayed') return 'tag-delay';
  return 'tag-ok';
}

function renderFlightRow(f) {
  const delayed = f.expectedDeparture && new Date(f.expectedDeparture) > new Date(f.scheduledDeparture);
  const early = f.computedStatus === 'early';
  const departed = f.status === 'departed' || f.status === 'early_departed';
  const cancelled = f.status === 'cancelled';
  const feeding = f.status === 'feeding';
  
  let timeHtml;
  if (cancelled || departed) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span>`;
  } else if (delayed || early) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span><br><span class="time-new">${fmtTm(f.expectedDeparture)}</span>`;
  } else {
    timeHtml = fmtTm(f.scheduledDeparture);
  }
  
  let statusHtml = `<span class="status-tag ${getTagClass(f)}">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span>`;
  if (feeding) statusHtml += `<span class="status-feeding-sub">Предоставление питания</span>`;
  
  return `<tr onclick="showDetail('${f.id}', 'departure')" style="${departed ? 'opacity:0.6;' : ''}">
    <td class="time-cell">${timeHtml}</td>
    <td><div class="dest-cell"><span class="dest-name">${f.destination}</span><span class="dest-iata">${f.iataCode || ''}</span></div></td>
    <td class="flight-num">${f.flightNumber}</td>
    <td><div class="airline-cell"><div class="airline-avatar">${(f.airline || 'A').charAt(0)}</div>${f.airline || ''}</div></td>
    <td><span class="gate-cell">${f.boardingGate || '—'}</span></td>
    <td>${statusHtml}</td>
  </tr>`;
}

function renderAllDep() {
  const adminFlights = showDepartedDep ? flightsDep : flightsDep.filter(f => f.status !== 'departed' && f.status !== 'early_departed');
  
  if ($('adminFlightsListDep')) {
    if (!adminFlights.length) {
      $('adminFlightsListDep').innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Нет рейсов</p>';
    } else {
      $('adminFlightsListDep').innerHTML = adminFlights.map(f => `
        <div class="admin-row">
          <div class="admin-row-info">
            <span class="admin-row-number">${f.flightNumber}</span>
            <span class="admin-row-route">${f.destination} (${f.iataCode || ''})</span>
            <span class="status-tag ${getTagClass(f)}" style="font-size:10px;">${(f.statusText || '').replace(/\n/g,' ')}</span>
          </div>
          <div class="admin-row-actions">
            <button class="btn-icon" onclick="event.stopPropagation();editFlightDep('${f.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" onclick="event.stopPropagation();deleteFlightDep('${f.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');
    }
  }
  
  const todayFlights = flightsDep.filter(f => {
    if (f.status === 'departed' || f.status === 'early_departed') return showDepartedDep;
    const day = f.flightDay || 'today';
    return day === 'today';
  });
  
  if ($('flightsTodayDep')) {
    $('flightsTodayDep').innerHTML = todayFlights.length === 0
      ? `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов на сегодня</p></div></td></tr>`
      : todayFlights.map(renderFlightRow).join('');
  }
  
  const tomorrowFlights = flightsDep.filter(f => {
    if (f.status === 'departed' || f.status === 'early_departed') return false;
    const day = f.flightDay || 'today';
    return day === 'tomorrow';
  });
  
  if ($('flightsTomorrowDep')) {
    $('flightsTomorrowDep').innerHTML = tomorrowFlights.length === 0
      ? `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов на завтра</p></div></td></tr>`
      : tomorrowFlights.map(renderFlightRow).join('');
  }
}

// ============ ПРИЛЁТ ============
async function loadArr() {
  try {
    const r = await fetch(`${API}?type=arrival&showDeparted=${showDepartedArr}`);
    flightsArr = await r.json();
    renderAllArr();
    const now = getLocalNow();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    if ($('lastUpdatedArr')) $('lastUpdatedArr').textContent = ts;
    if ($('lastUpdatedArr2')) $('lastUpdatedArr2').textContent = ts;
  } catch(e) { console.log(e); }
}

function getTagClassArr(f) {
  if (f.status === 'cancelled') return 'tag-cancel';
  if (f.status === 'arrived') return 'tag-departed';
  if (f.status === 'diverted') return 'tag-diverted';
  if (f.status === 'suspended') return 'tag-suspended';
  if (f.status === 'expected') return 'tag-ok';
  if (f.status === 'delayed') return 'tag-delay';
  if (f.status === 'early') return 'tag-early';
  return 'tag-ok';
}

function renderFlightRowArr(f) {
  const delayed = f.expectedDeparture && new Date(f.expectedDeparture) > new Date(f.scheduledDeparture);
  const early = f.status === 'early';
  const arrived = f.status === 'arrived';
  const cancelled = f.status === 'cancelled';
  
  let timeHtml;
  if (cancelled || arrived) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span>`;
  } else if (delayed || early) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span><br><span class="time-new">${fmtTm(f.expectedDeparture)}</span>`;
  } else {
    timeHtml = fmtTm(f.scheduledDeparture);
  }
  
  return `<tr onclick="showDetail('${f.id}', 'arrival')" style="${arrived ? 'opacity:0.6;' : ''}">
    <td class="time-cell">${timeHtml}</td>
    <td><div class="dest-cell"><span class="dest-name">${f.destination}</span><span class="dest-iata">${f.iataCode || ''}</span></div></td>
    <td class="flight-num">${f.flightNumber}</td>
    <td><div class="airline-cell"><div class="airline-avatar">${(f.airline || 'A').charAt(0)}</div>${f.airline || ''}</div></td>
    <td><span class="gate-cell">${f.baggageBelt || '—'}</span></td>
    <td><span class="status-tag ${getTagClassArr(f)}">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span></td>
  </tr>`;
}

function renderAllArr() {
  const adminFlights = showDepartedArr ? flightsArr : flightsArr.filter(f => f.status !== 'arrived');
  
  if ($('adminFlightsListArr')) {
    if (!adminFlights.length) {
      $('adminFlightsListArr').innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Нет рейсов</p>';
    } else {
      $('adminFlightsListArr').innerHTML = adminFlights.map(f => `
        <div class="admin-row">
          <div class="admin-row-info">
            <span class="admin-row-number">${f.flightNumber}</span>
            <span class="admin-row-route">${f.destination} (${f.iataCode || ''})</span>
            <span class="status-tag ${getTagClassArr(f)}" style="font-size:10px;">${(f.statusText || '').replace(/\n/g,' ')}</span>
          </div>
          <div class="admin-row-actions">
            <button class="btn-icon" onclick="event.stopPropagation();editFlightArr('${f.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" onclick="event.stopPropagation();deleteFlightArr('${f.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');
    }
  }
  
  const todayFlights = flightsArr.filter(f => {
    if (f.status === 'arrived') return showDepartedArr;
    const day = f.flightDay || 'today';
    return day === 'today';
  });
  
  if ($('flightsTodayArr')) {
    $('flightsTodayArr').innerHTML = todayFlights.length === 0
      ? `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane-arrival"></i><p>Нет рейсов на сегодня</p></div></td></tr>`
      : todayFlights.map(renderFlightRowArr).join('');
  }
  
  const tomorrowFlights = flightsArr.filter(f => {
    if (f.status === 'arrived') return false;
    const day = f.flightDay || 'today';
    return day === 'tomorrow';
  });
  
  if ($('flightsTomorrowArr')) {
    $('flightsTomorrowArr').innerHTML = tomorrowFlights.length === 0
      ? `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane-arrival"></i><p>Нет рейсов на завтра</p></div></td></tr>`
      : tomorrowFlights.map(renderFlightRowArr).join('');
  }
}

// ============ ДЕТАЛИ РЕЙСА ============
window.showDetail = function(id, type) {
  const flights = type === 'departure' ? flightsDep : flightsArr;
  const f = flights.find(x => x.id === id);
  if (!f) return;
  
  $('modalTitle').textContent = `Рейс ${f.flightNumber}`;
  
  const delayed = f.expectedDeparture && new Date(f.expectedDeparture) > new Date(f.scheduledDeparture);
  const early = f.computedStatus === 'early' || f.status === 'early';
  const delayHtml = (delayed || early) ? `<div class="modal-delay-banner"><i class="fas fa-clock"></i><span>${early ? 'Ранний вылет' : 'Задержан до ' + fmtTm(f.expectedDeparture)}</span></div>` : '';
  
  const tagClass = type === 'departure' ? getTagClass(f) : getTagClassArr(f);
  const isDeparture = type === 'departure';
  
  $('modalBody').innerHTML = `
    <div class="modal-flight-top">
      <div>
        <div class="modal-flight-num">${f.flightNumber}</div>
        <div class="modal-flight-airline">${f.airline || '—'}</div>
      </div>
      <span class="status-tag ${tagClass}" style="font-size:14px;">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span>
    </div>
    ${delayHtml}
    <div class="modal-fs-destination">
      <h2>${f.destination}</h2>
      <span class="modal-fs-iata">${f.iataCode || ''}</span>
    </div>
    <div class="modal-fs-info-row"><span>Россия</span></div>
    <div class="modal-fs-table">
      <div class="modal-fs-table-row header">
        <div>Дата</div><div>Время по расписанию</div><div>Ожидаемое время</div><div>${isDeparture ? 'Выход' : 'Лента'}</div><div>Терминал</div>
      </div>
      <div class="modal-fs-table-row">
        <div><strong>${fmtDateOnly(f.scheduledDeparture)}</strong></div>
        <div><strong>${fmtTm(f.scheduledDeparture)}</strong></div>
        <div><strong>${fmtTm(f.expectedDeparture || f.scheduledDeparture)}</strong></div>
        <div><strong>${isDeparture ? (f.boardingGate || '—') : (f.baggageBelt || '—')}</strong></div>
        <div><strong>А</strong></div>
      </div>
    </div>
    <div class="modal-fs-extra">
      <div class="modal-fs-extra-item"><span class="extra-label">Авиакомпания</span><span class="extra-value">${f.airline || '—'}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">По расписанию</span><span class="extra-value">${fmtDt(f.scheduledDeparture)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Ожидаемое</span><span class="extra-value">${fmtDt(f.expectedDeparture)}</span></div>
      ${isDeparture ? `
      <div class="modal-fs-extra-item"><span class="extra-label">Регистрация</span><span class="extra-value">${fmtTm(f.checkInStart)} — ${fmtTm(f.checkInEnd)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Посадка</span><span class="extra-value">${fmtTm(f.boardingStart)} — ${fmtTm(f.boardingEnd)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Стойки</span><span class="extra-value">${f.checkInCounters || '—'}</span></div>
      ` : `
      <div class="modal-fs-extra-item"><span class="extra-label">Лента выдачи багажа</span><span class="extra-value">${f.baggageBelt || '—'}</span></div>
      `}
    </div>
    <button class="btn-share" onclick="event.stopPropagation(); shareFlight('${f.id}', '${type}')">
      <i class="fas fa-share-alt"></i> Поделиться рейсом
    </button>`;

  $('modalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.shareFlight = function(id, type) {
  const flights = type === 'departure' ? flightsDep : flightsArr;
  const f = flights.find(x => x.id === id);
  if (!f) return;
  const isDeparture = type === 'departure';
  const text = `🛫 Рейс ${f.flightNumber}
📍 ${f.destination} (${f.iataCode || ''})
🕐 По расписанию: ${fmtTm(f.scheduledDeparture)}
🕐 Ожидаемый: ${fmtTm(f.expectedDeparture || f.scheduledDeparture)}
${isDeparture ? '🏷️ Стойки: ' + (f.checkInCounters || '—') : '🎒 Лента: ' + (f.baggageBelt || '—')}
${isDeparture ? '🚪 Выход: ' + (f.boardingGate || '—') : ''}
📌 Статус: ${(f.statusText || 'По расписанию').replace(/\n/g, ' ')}
🔗 ar-bhk.ru`;
  
  if (navigator.share) {
    navigator.share({ title: `Рейс ${f.flightNumber}`, text });
  } else {
    navigator.clipboard.writeText(text).then(() => alert('Информация скопирована!'));
  }
};

$('modalClose').onclick = () => { $('modalOverlay').classList.remove('show'); document.body.style.overflow = ''; };
$('modalOverlay').onclick = e => { if (e.target === $('modalOverlay')) { $('modalOverlay').classList.remove('show'); document.body.style.overflow = ''; } };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('modalOverlay').classList.remove('show'); document.body.style.overflow = ''; } });

document.querySelectorAll('#modeDeparture .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#modeDeparture .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTabDep = btn.dataset.tab;
    $('boardTodayDep').style.display = currentTabDep === 'today' ? '' : 'none';
    $('boardTomorrowDep').style.display = currentTabDep === 'tomorrow' ? '' : 'none';
  });
});

document.querySelectorAll('#modeArrival .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#modeArrival .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTabArr = btn.dataset.tab;
    $('boardTodayArr').style.display = currentTabArr === 'today' ? '' : 'none';
    $('boardTomorrowArr').style.display = currentTabArr === 'tomorrow' ? '' : 'none';
  });
});

$('toggleDepartedDep').addEventListener('click', () => {
  showDepartedDep = !showDepartedDep;
  $('toggleDepartedDep').classList.toggle('active', showDepartedDep);
  $('toggleDepartedDep').innerHTML = showDepartedDep ? '<i class="fas fa-eye-slash"></i> Скрыть вылетевшие' : '<i class="fas fa-eye"></i> Показать вылетевшие';
  loadDep();
});

$('toggleDepartedArr').addEventListener('click', () => {
  showDepartedArr = !showDepartedArr;
  $('toggleDepartedArr').classList.toggle('active', showDepartedArr);
  $('toggleDepartedArr').innerHTML = showDepartedArr ? '<i class="fas fa-eye-slash"></i> Скрыть прибывшие' : '<i class="fas fa-eye"></i> Показать прибывшие';
  loadArr();
});

$('adminToggleDep').onclick = () => { $('adminDeparture').style.display = $('adminDeparture').style.display !== 'none' ? 'none' : 'block'; };
$('adminToggleArr').onclick = () => { $('adminArrival').style.display = $('adminArrival').style.display !== 'none' ? 'none' : 'block'; };

$('addFlightDep').onclick = () => { editingId = null; $('formTitleDep').textContent = 'Новый рейс'; $('flightFormInnerDep').reset(); $('flightIdDep').value = ''; $('statusDep').value = 'scheduled'; $('flightFormDep').style.display = 'block'; };
$('cancelFormDep').onclick = () => { $('flightFormDep').style.display = 'none'; };

window.editFlightDep = function(id) {
  const f = flightsDep.find(x => x.id === id);
  if (!f) return;
  editingId = id;
  $('formTitleDep').textContent = 'Редактировать рейс';
  $('flightIdDep').value = f.id;
  $('flightNumberDep').value = f.flightNumber;
  $('airlineDep').value = f.airline;
  $('destinationDep').value = f.destination;
  $('iataCodeDep').value = f.iataCode || '';
  $('scheduledDepartureDep').value = f.scheduledDeparture ? f.scheduledDeparture.slice(0, 16) : '';
  $('expectedDepartureDep').value = f.expectedDeparture ? f.expectedDeparture.slice(0, 16) : '';
  $('checkInStartDep').value = f.checkInStart ? f.checkInStart.slice(0, 16) : '';
  $('checkInEndDep').value = f.checkInEnd ? f.checkInEnd.slice(0, 16) : '';
  $('checkInCountersDep').value = f.checkInCounters || '';
  $('boardingStartDep').value = f.boardingStart ? f.boardingStart.slice(0, 16) : '';
  $('boardingEndDep').value = f.boardingEnd ? f.boardingEnd.slice(0, 16) : '';
  $('boardingGateDep').value = f.boardingGate || '';
  $('statusDep').value = f.status;
  $('flightFormDep').style.display = 'block';
};

window.deleteFlightDep = async function(id) {
  if (!confirm('Удалить рейс?')) return;
  await fetch(`${API}/${id}?type=departure`, { method:'DELETE' });
  loadDep();
};

$('flightFormInnerDep').onsubmit = async function(e) {
  e.preventDefault();
  const body = {
    flightNumber: $('flightNumberDep').value, airline: $('airlineDep').value,
    destination: $('destinationDep').value, iataCode: $('iataCodeDep').value.toUpperCase(),
    scheduledDeparture: $('scheduledDepartureDep').value ? $('scheduledDepartureDep').value + ':00' : null,
    expectedDeparture: $('expectedDepartureDep').value ? $('expectedDepartureDep').value + ':00' : null,
    checkInStart: $('checkInStartDep').value ? $('checkInStartDep').value + ':00' : null,
    checkInEnd: $('checkInEndDep').value ? $('checkInEndDep').value + ':00' : null,
    checkInCounters: $('checkInCountersDep').value,
    boardingStart: $('boardingStartDep').value ? $('boardingStartDep').value + ':00' : null,
    boardingEnd: $('boardingEndDep').value ? $('boardingEndDep').value + ':00' : null,
    boardingGate: $('boardingGateDep').value,
    status: $('statusDep').value
  };
  const url = editingId ? `${API}/${editingId}?type=departure` : `${API}?type=departure`;
  await fetch(url, { method: editingId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  $('flightFormDep').style.display = 'none'; editingId = null; loadDep();
};

$('addFlightArr').onclick = () => { editingId = null; $('formTitleArr').textContent = 'Новый рейс'; $('flightFormInnerArr').reset(); $('flightIdArr').value = ''; $('statusArr').value = 'scheduled'; $('flightFormArr').style.display = 'block'; };
$('cancelFormArr').onclick = () => { $('flightFormArr').style.display = 'none'; };

window.editFlightArr = function(id) {
  const f = flightsArr.find(x => x.id === id);
  if (!f) return;
  editingId = id;
  $('formTitleArr').textContent = 'Редактировать рейс';
  $('flightIdArr').value = f.id;
  $('flightNumberArr').value = f.flightNumber;
  $('airlineArr').value = f.airline;
  $('destinationArr').value = f.destination;
  $('iataCodeArr').value = f.iataCode || '';
  $('scheduledDepartureArr').value = f.scheduledDeparture ? f.scheduledDeparture.slice(0, 16) : '';
  $('expectedDepartureArr').value = f.expectedDeparture ? f.expectedDeparture.slice(0, 16) : '';
  $('baggageBeltArr').value = f.baggageBelt || '';
  $('statusArr').value = f.status;
  $('flightFormArr').style.display = 'block';
};

window.deleteFlightArr = async function(id) {
  if (!confirm('Удалить рейс?')) return;
  await fetch(`${API}/${id}?type=arrival`, { method:'DELETE' });
  loadArr();
};

$('flightFormInnerArr').onsubmit = async function(e) {
  e.preventDefault();
  const body = {
    flightNumber: $('flightNumberArr').value, airline: $('airlineArr').value,
    destination: $('destinationArr').value, iataCode: $('iataCodeArr').value.toUpperCase(),
    scheduledDeparture: $('scheduledDepartureArr').value ? $('scheduledDepartureArr').value + ':00' : null,
    expectedDeparture: $('expectedDepartureArr').value ? $('expectedDepartureArr').value + ':00' : null,
    baggageBelt: $('baggageBeltArr').value,
    status: $('statusArr').value
  };
  const url = editingId ? `${API}/${editingId}?type=arrival` : `${API}?type=arrival`;
  await fetch(url, { method: editingId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  $('flightFormArr').style.display = 'none'; editingId = null; loadArr();
};

if ($('btnDeleteOldFlights')) {
  $('btnDeleteOldFlights').addEventListener('click', async () => {
    if (!confirm('Удалить прошлые рейсы без статуса «Вылетел»?')) return;
    try {
      const r = await fetch('/api/old-flights', { method: 'DELETE' });
      const data = await r.json();
      alert(`Удалено: ${data.deleted}. Оставлено: ${data.kept}.`);
      loadDep();
    } catch(e) {
      alert('Ошибка при удалении');
    }
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => {
    subscribeToPush();
  });
}

setInterval(() => { if (currentMode === 'departure') loadDep(); else loadArr(); }, 30000);
loadAirportStatus();
loadUrgent();
loadDep();
loadArr();
