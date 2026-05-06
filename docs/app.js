/* ============================================================
   WeatherOrNot — app.js
   Multi-source weather aggregator
   Sources: Open-Meteo (always), OpenWeatherMap (opt key),
            WeatherAPI (opt key), NWS (US only, free)
   Radar:   RainViewer
   Maps:    Leaflet + OpenStreetMap
   Charts:  Chart.js
   ============================================================ */

'use strict';

// ═══════════════════════════════════════════════════════════
// APP CONSTANTS
// ═══════════════════════════════════════════════════════════

const NWS_USER_AGENT      = 'WeatherOrNot/1.0 (weather-aggregator)';
const GEOLOCATION_TIMEOUT = 10000; // ms

// ═══════════════════════════════════════════════════════════
// WMO WEATHER INTERPRETATION CODES
// ═══════════════════════════════════════════════════════════

const WMO = {
  0:  { label: 'Clear sky',                    icon: '☀️',  sev: 0 },
  1:  { label: 'Mainly clear',                 icon: '🌤️', sev: 0 },
  2:  { label: 'Partly cloudy',                icon: '⛅',  sev: 0 },
  3:  { label: 'Overcast',                     icon: '☁️',  sev: 0 },
  45: { label: 'Foggy',                        icon: '🌫️', sev: 1 },
  48: { label: 'Rime fog',                     icon: '🌫️', sev: 1 },
  51: { label: 'Light drizzle',                icon: '🌦️', sev: 0 },
  53: { label: 'Moderate drizzle',             icon: '🌦️', sev: 0 },
  55: { label: 'Dense drizzle',                icon: '🌧️', sev: 1 },
  56: { label: 'Light freezing drizzle',       icon: '🌨️', sev: 2 },
  57: { label: 'Heavy freezing drizzle',       icon: '🌨️', sev: 2 },
  61: { label: 'Slight rain',                  icon: '🌦️', sev: 0 },
  63: { label: 'Moderate rain',                icon: '🌧️', sev: 1 },
  65: { label: 'Heavy rain',                   icon: '🌧️', sev: 2 },
  66: { label: 'Light freezing rain',          icon: '🌨️', sev: 2 },
  67: { label: 'Heavy freezing rain',          icon: '🌨️', sev: 3 },
  71: { label: 'Slight snowfall',              icon: '🌨️', sev: 1 },
  73: { label: 'Moderate snowfall',            icon: '❄️',  sev: 2 },
  75: { label: 'Heavy snowfall',               icon: '❄️',  sev: 3 },
  77: { label: 'Snow grains',                  icon: '🌨️', sev: 1 },
  80: { label: 'Slight rain showers',          icon: '🌦️', sev: 0 },
  81: { label: 'Moderate rain showers',        icon: '🌧️', sev: 1 },
  82: { label: 'Violent rain showers',         icon: '⛈️',  sev: 3 },
  85: { label: 'Slight snow showers',          icon: '🌨️', sev: 1 },
  86: { label: 'Heavy snow showers',           icon: '❄️',  sev: 3 },
  95: { label: 'Thunderstorm',                 icon: '⛈️',  sev: 3 },
  96: { label: 'Thunderstorm with slight hail',icon: '⛈️',  sev: 4 },
  99: { label: 'Thunderstorm with heavy hail', icon: '🌩️', sev: 4 },
};

const COMPASS_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

// ═══════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════

const state = {
  loc: null,        // { lat, lon, name, countryCode }
  sources: {
    openmeteo: null,
    owm:       null,
    wapi:      null,
  },
  config: {
    owmKey:  '',
    wapiKey: '',
    unit:    'C',
  },
  map:         null,
  chart:       null,
  radarData:   null,
  radarLayers: [],
  radarTimer:  null,
  radarFrame:  0,
  radarPlay:   true,
  satLayer:    null,
};

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

const toF     = c  => (c * 9 / 5 + 32).toFixed(1);
const fmtTemp = (c, unit) => unit === 'F' ? `${toF(c)}°F` : `${Math.round(c)}°C`;
const fmtSpd  = (kmh, unit) => unit === 'F'
  ? `${Math.round(kmh * 0.621371)} mph`
  : `${Math.round(kmh)} km/h`;
const deg2dir = d => COMPASS_DIRS[Math.round(d / 22.5) % 16];
const pad2    = n => String(n).padStart(2, '0');

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDayLabel(isoStr, idx) {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  return new Date(isoStr).toLocaleDateString('en-GB', { weekday: 'short' });
}

function formatDateShort(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function moonPhaseEmoji(isoStr) {
  const date = new Date(isoStr);
  let y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  if (m < 3) { y--; m += 12; }
  const e  = 2 - Math.floor(y / 100) + Math.floor(y / 400);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + e - 1524.5;
  const phase = ((jd - 2451549.5) / 29.53059) % 1;
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.0625) return '🌑';
  if (p < 0.1875) return '🌒';
  if (p < 0.3125) return '🌓';
  if (p < 0.4375) return '🌔';
  if (p < 0.5625) return '🌕';
  if (p < 0.6875) return '🌖';
  if (p < 0.8125) return '🌗';
  if (p < 0.9375) return '🌘';
  return '🌑';
}

function uvLabel(uv) {
  const v = Math.round(uv);
  if (uv < 3)  return `${v} — Low`;
  if (uv < 6)  return `${v} — Moderate`;
  if (uv < 8)  return `${v} — High`;
  if (uv < 11) return `${v} — Very High`;
  return `${v} — Extreme`;
}

function uvClass(uv) {
  if (uv < 3)  return 'uv-low';
  if (uv < 6)  return 'uv-moderate';
  if (uv < 8)  return 'uv-high';
  if (uv < 11) return 'uv-very-high';
  return 'uv-extreme';
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ═══════════════════════════════════════════════════════════
// CONFIG — localStorage persistence
// ═══════════════════════════════════════════════════════════

function saveConfig() {
  try { localStorage.setItem('won_cfg', JSON.stringify(state.config)); } catch (_) {}
}

function loadConfig() {
  try {
    const raw = localStorage.getItem('won_cfg');
    if (raw) Object.assign(state.config, JSON.parse(raw));
  } catch (_) {}
  el('owm-key').value  = state.config.owmKey  || '';
  el('wapi-key').value = state.config.wapiKey || '';
  updateUnitToggle();
}

// ═══════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════

const el   = id => document.getElementById(id);
const setText = (id, val) => { const e = el(id); if (e) e.textContent = val; };

function showError(msg) {
  const e = el('error-message');
  e.textContent = msg;
  e.classList.remove('hidden');
  setTimeout(() => e.classList.add('hidden'), 7000);
}

function showLoading(show) {
  el('loading').classList.toggle('hidden', !show);
  if (show) el('main-content').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
// API — GEOCODING (Open-Meteo)
// ═══════════════════════════════════════════════════════════

async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  return (await res.json()).results || [];
}

// ═══════════════════════════════════════════════════════════
// API — OPEN-METEO (primary, always free, no key)
// ═══════════════════════════════════════════════════════════

async function fetchOpenMeteo(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'is_day', 'precipitation', 'rain', 'showers', 'snowfall',
      'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m', 'relative_humidity_2m', 'dew_point_2m',
      'apparent_temperature', 'precipitation_probability', 'precipitation',
      'weather_code', 'visibility', 'wind_speed_10m', 'wind_direction_10m',
      'wind_gusts_10m', 'uv_index', 'cloud_cover',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'apparent_temperature_max', 'apparent_temperature_min',
      'sunrise', 'sunset', 'uv_index_max',
      'precipitation_sum', 'precipitation_hours', 'precipitation_probability_max',
      'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
      'shortwave_radiation_sum',
    ].join(','),
    timezone:       'auto',
    forecast_days:  14,
    wind_speed_unit: 'kmh',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return await res.json();
}

// ═══════════════════════════════════════════════════════════
// API — OPENWEATHERMAP (optional, free key)
// ═══════════════════════════════════════════════════════════

async function fetchOWM(lat, lon) {
  if (!state.config.owmKey) return null;
  const base = 'https://api.openweathermap.org/data/2.5';
  const key  = state.config.owmKey;
  const [curRes, foresRes] = await Promise.all([
    fetch(`${base}/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`),
    fetch(`${base}/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`),
  ]);
  const cur  = await curRes.json();
  const fore = await foresRes.json();
  if (cur.cod && cur.cod !== 200)  throw new Error(`OWM: ${cur.message}`);
  if (fore.cod && fore.cod !== '200') throw new Error(`OWM forecast: ${fore.message}`);
  return { current: cur, forecast: fore };
}

// ═══════════════════════════════════════════════════════════
// API — WEATHERAPI.COM (optional, free key)
// ═══════════════════════════════════════════════════════════

async function fetchWeatherAPI(lat, lon) {
  if (!state.config.wapiKey) return null;
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${state.config.wapiKey}&q=${lat},${lon}&days=10&aqi=no&alerts=yes`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WeatherAPI error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`WeatherAPI: ${json.error.message}`);
  return json;
}

// ═══════════════════════════════════════════════════════════
// API — NWS ALERTS (US only, always free, no key)
// ═══════════════════════════════════════════════════════════

async function fetchNWSAlerts(lat, lon) {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { 'User-Agent': NWS_USER_AGENT } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.features || [];
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════
// WARNINGS — collate from all sources
// ═══════════════════════════════════════════════════════════

function warnFromWMO(daily) {
  const out = [];
  // Check today + next 6 days for severe WMO codes
  for (let i = 0; i < Math.min(7, daily.weather_code.length); i++) {
    const code = daily.weather_code[i];
    const wmo  = WMO[code];
    if (!wmo || wmo.sev < 2) continue;
    const when = i === 0 ? 'Today' : `on ${formatDayLabel(daily.time[i], i)} ${formatDateShort(daily.time[i])}`;
    let level = 'warning';
    if (wmo.sev >= 4) level = 'extreme';
    else if (wmo.sev >= 3) level = 'severe';
    out.push({ level, title: `${wmo.icon} Weather ${level.charAt(0).toUpperCase() + level.slice(1)} ${when}`, text: wmo.label });
  }
  // UV warning (today's max)
  const uv = daily.uv_index_max?.[0];
  if (uv >= 11) out.push({ level: 'warning', title: '☀️ Extreme UV Index', text: `UV Index ${Math.round(uv)} — avoid prolonged sun exposure and wear maximum protection.` });
  else if (uv >= 8) out.push({ level: 'advisory', title: '☀️ High UV Index', text: `UV Index ${Math.round(uv)} — wear sunscreen SPF 30+, hat, and sunglasses.` });
  return out;
}

function warnFromNWS(features) {
  return features.slice(0, 5).map(f => {
    const p   = f.properties;
    const sev = (p.severity || '').toLowerCase();
    const level = sev === 'extreme' ? 'extreme' : sev === 'severe' ? 'severe' : 'warning';
    const title = `🇺🇸 ${p.headline || p.event || 'NWS Alert'}`;
    const text  = (p.description || '').replace(/\n/g, ' ').substring(0, 220) + '…';
    return { level, title, text };
  });
}

function warnFromWAPI(wapi) {
  if (!wapi?.alerts?.alert?.length) return [];
  return wapi.alerts.alert.slice(0, 3).map(a => ({
    level: 'warning',
    title: `⚠️ ${a.headline || a.msgtype || 'Alert'}`,
    text: (a.desc || '').replace(/\n/g, ' ').substring(0, 220) + '…',
  }));
}

// ═══════════════════════════════════════════════════════════
// BACKGROUND THEME
// ═══════════════════════════════════════════════════════════

function updateBackground(code, isDay) {
  const cls = (() => {
    if (code <= 1)  return isDay ? 'bg-clear-day'  : 'bg-clear-night';
    if (code <= 3)  return isDay ? 'bg-cloudy-day' : 'bg-cloudy-night';
    if (code <= 48) return 'bg-fog';
    if (code <= 67) return 'bg-rain';
    if (code <= 77) return 'bg-snow';
    if (code <= 82) return 'bg-rain';
    if (code <= 86) return 'bg-snow';
    return 'bg-storm';
  })();
  document.body.className = cls;
}

// ═══════════════════════════════════════════════════════════
// UI — DISPLAY WARNINGS
// ═══════════════════════════════════════════════════════════

function displayWarnings(warnings) {
  const section    = el('warnings-section');
  const container  = el('warnings-container');
  if (!warnings.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  container.innerHTML = warnings.map(w => `
    <div class="warning warning-${w.level}">
      <strong>${w.title}</strong>
      <p>${w.text}</p>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// UI — CURRENT WEATHER
// ═══════════════════════════════════════════════════════════

function displayCurrentWeather(om) {
  const { current, hourly, daily } = om;
  const u   = state.config.unit;
  const wmo = WMO[current.weather_code] || { label: 'Unknown', icon: '🌡️' };

  setText('current-icon', wmo.icon);
  setText('current-temp',  fmtTemp(current.temperature_2m, u));
  setText('current-desc',  wmo.label);
  setText('feels-like',    `Feels like ${fmtTemp(current.apparent_temperature, u)}`);

  // Wind compass
  const needle = document.querySelector('.compass-needle');
  if (needle) needle.style.transform = `rotate(${current.wind_direction_10m}deg)`;
  setText('compass-speed', fmtSpd(current.wind_speed_10m, u));
  setText('compass-dir',   deg2dir(current.wind_direction_10m));

  // Metrics
  setText('metric-humidity',   `${current.relative_humidity_2m}%`);
  setText('metric-wind',       `${fmtSpd(current.wind_speed_10m, u)} ${deg2dir(current.wind_direction_10m)}`);
  setText('metric-gusts',      fmtSpd(current.wind_gusts_10m, u));
  setText('metric-pressure',   `${Math.round(current.pressure_msl)} hPa`);
  setText('metric-cloud',      `${current.cloud_cover}%`);
  setText('metric-precip',     `${current.precipitation} mm`);

  // Visibility + UV from nearest hourly slot
  const now  = new Date();
  const hIdx = Math.max(0, hourly.time.findIndex(t => new Date(t) >= now));
  const vis  = hourly.visibility?.[hIdx];
  const uv   = hourly.uv_index?.[hIdx] ?? daily.uv_index_max?.[0];
  setText('metric-visibility', vis != null ? `${(vis / 1000).toFixed(1)} km` : '—');
  setText('metric-uv',         uv  != null ? uvLabel(uv) : '—');

  // Sun / Moon
  setText('sunrise',    formatTime(daily.sunrise?.[0]));
  setText('sunset',     formatTime(daily.sunset?.[0]));
  setText('moon-phase', moonPhaseEmoji(daily.time?.[0] || new Date().toISOString()));
}

// ═══════════════════════════════════════════════════════════
// UI — SOURCES COMPARISON TABLE
// ═══════════════════════════════════════════════════════════

function displaySourcesComparison() {
  const container = el('sources-comparison');
  const u   = state.config.unit;
  const om  = state.sources.openmeteo;
  const owm = state.sources.owm;
  const wp  = state.sources.wapi;

  const sources = [
    { key: 'om',  name: 'Open-Meteo',     link: 'https://open-meteo.com',          active: !!om  },
    { key: 'owm', name: 'OpenWeatherMap', link: 'https://openweathermap.org',      active: !!owm },
    { key: 'wp',  name: 'WeatherAPI',     link: 'https://www.weatherapi.com',      active: !!wp  },
  ];
  const active = sources.filter(s => s.active);

  const rows = [
    {
      label: '🌡️ Temperature',
      om:  om  ? fmtTemp(om.current.temperature_2m, u)          : null,
      owm: owm ? fmtTemp(owm.current.main.temp, u)              : null,
      wp:  wp  ? fmtTemp(wp.current.temp_c, u)                  : null,
    },
    {
      label: '🤔 Feels Like',
      om:  om  ? fmtTemp(om.current.apparent_temperature, u)    : null,
      owm: owm ? fmtTemp(owm.current.main.feels_like, u)        : null,
      wp:  wp  ? fmtTemp(wp.current.feelslike_c, u)             : null,
    },
    {
      label: '💧 Humidity',
      om:  om  ? `${om.current.relative_humidity_2m}%`          : null,
      owm: owm ? `${owm.current.main.humidity}%`                : null,
      wp:  wp  ? `${wp.current.humidity}%`                      : null,
    },
    {
      label: '🌬️ Wind Speed',
      om:  om  ? fmtSpd(om.current.wind_speed_10m, u)           : null,
      owm: owm ? fmtSpd(owm.current.wind.speed * 3.6, u)        : null,
      wp:  wp  ? fmtSpd(wp.current.wind_kph, u)                 : null,
    },
    {
      label: '💨 Wind Gusts',
      om:  om  ? fmtSpd(om.current.wind_gusts_10m, u)           : null,
      owm: owm ? '—'                                             : null,
      wp:  wp  ? fmtSpd(wp.current.gust_kph, u)                 : null,
    },
    {
      label: '📊 Pressure',
      om:  om  ? `${Math.round(om.current.pressure_msl)} hPa`   : null,
      owm: owm ? `${owm.current.main.pressure} hPa`             : null,
      wp:  wp  ? `${wp.current.pressure_mb} hPa`                : null,
    },
    {
      label: '☁️ Cloud Cover',
      om:  om  ? `${om.current.cloud_cover}%`                   : null,
      owm: owm ? `${owm.current.clouds.all}%`                   : null,
      wp:  wp  ? `${wp.current.cloud}%`                         : null,
    },
    {
      label: '🌤️ Conditions',
      om:  om  ? (WMO[om.current.weather_code]?.label || '—')   : null,
      owm: owm ? owm.current.weather[0]?.description            : null,
      wp:  wp  ? wp.current.condition.text                      : null,
    },
  ];

  const inactive = sources.filter(s => !s.active);

  container.innerHTML = `
    <div class="comparison-table-wrapper">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${active.map(s => `<th><a href="${s.link}" target="_blank">${s.name}</a></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${row.label}</td>
              ${active.map(s => `<td>${row[s.key] ?? '<span class="na">—</span>'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${inactive.length ? `
      <p class="source-hint">
        ➕ Add
        ${inactive.map(s => `<a href="${s.link}" target="_blank">${s.name}</a>`).join(' and ')}
        data by entering your free API key above.
      </p>` : ''}
  `;
}

// ═══════════════════════════════════════════════════════════
// UI — HOURLY CHART (Chart.js)
// ═══════════════════════════════════════════════════════════

function displayHourlyChart(hourly) {
  const now   = new Date();
  const start = Math.max(0, hourly.time.findIndex(t => new Date(t) >= now));
  const end   = Math.min(start + 48, hourly.time.length);
  const u     = state.config.unit;

  const labels = hourly.time.slice(start, end).map(t => {
    const d = new Date(t);
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)} ${pad2(d.getHours())}:00`;
  });

  const temps  = hourly.temperature_2m.slice(start, end).map(v =>
    u === 'F' ? parseFloat(toF(v)) : Math.round(v * 10) / 10
  );
  const precip = hourly.precipitation_probability.slice(start, end);
  const winds  = hourly.wind_speed_10m.slice(start, end).map(v =>
    u === 'F' ? Math.round(v * 0.621371) : Math.round(v)
  );

  const ctx = el('hourly-chart').getContext('2d');
  if (state.chart) { state.chart.destroy(); state.chart = null; }

  state.chart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: `Temp (°${u})`,
          data: temps,
          borderColor: '#ff7043',
          backgroundColor: 'rgba(255,112,67,.12)',
          yAxisID: 'yTemp',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          borderWidth: 2.5,
          order: 1,
        },
        {
          type: 'bar',
          label: 'Precip. Chance (%)',
          data: precip,
          backgroundColor: 'rgba(79,195,247,.35)',
          borderColor: 'rgba(79,195,247,.7)',
          yAxisID: 'yPrecip',
          borderWidth: 1,
          order: 2,
        },
        {
          type: 'line',
          label: `Wind (${u === 'F' ? 'mph' : 'km/h'})`,
          data: winds,
          borderColor: '#66bb6a',
          backgroundColor: 'transparent',
          yAxisID: 'yWind',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [5, 3],
          order: 3,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: '#cdd6e0', font: { size: 11 }, boxWidth: 16 } },
        tooltip: {
          backgroundColor: 'rgba(10,20,30,.92)',
          titleColor: '#fff',
          bodyColor: '#cdd6e0',
          borderColor: 'rgba(255,255,255,.12)',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: '#8fa3b8', maxTicksLimit: 10, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        yTemp: {
          position: 'left',
          ticks:    { color: '#ff7043', font: { size: 10 } },
          grid:     { color: 'rgba(255,255,255,.05)' },
          title:    { display: true, text: `°${u}`, color: '#ff7043', font: { size: 10 } },
        },
        yPrecip: {
          position: 'right',
          min: 0, max: 100,
          ticks:    { color: '#4fc3f7', font: { size: 10 } },
          grid:     { display: false },
          title:    { display: true, text: '%', color: '#4fc3f7', font: { size: 10 } },
        },
        yWind: {
          position: 'right',
          ticks:    { color: '#66bb6a', font: { size: 10 } },
          grid:     { display: false },
          title:    { display: true, text: u === 'F' ? 'mph' : 'km/h', color: '#66bb6a', font: { size: 10 } },
          offset:   true,
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════
// UI — 14-DAY FORECAST CARDS
// ═══════════════════════════════════════════════════════════

function displayDailyForecast(daily) {
  const container = el('daily-cards');
  const u = state.config.unit;

  container.innerHTML = daily.time.map((t, i) => {
    const wmo  = WMO[daily.weather_code[i]] || { icon: '🌡️', label: 'Unknown' };
    const prec = daily.precipitation_probability_max?.[i];
    const wind = daily.wind_speed_10m_max?.[i];
    const uv   = daily.uv_index_max?.[i];
    return `
      <div class="day-card${i === 0 ? ' today' : ''}">
        <div class="day-name">${formatDayLabel(t, i)}</div>
        <div class="day-date">${formatDateShort(t)}</div>
        <div class="day-icon">${wmo.icon}</div>
        <div class="day-desc">${wmo.label}</div>
        <div class="day-temps">
          <span class="day-max">${fmtTemp(daily.temperature_2m_max[i], u)}</span>
          <span class="day-min">${fmtTemp(daily.temperature_2m_min[i], u)}</span>
        </div>
        <div class="day-meta">
          ${prec != null ? `<span class="day-rain">💧 ${prec}%</span>` : ''}
          ${wind != null ? `<span class="day-wind">🌬️ ${fmtSpd(wind, u)}</span>` : ''}
          ${uv   != null ? `<span class="day-uv ${uvClass(uv)}">UV ${Math.round(uv)}</span>` : ''}
        </div>
        <div class="day-moon">${moonPhaseEmoji(t)}</div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// RADAR MAP — Leaflet + RainViewer
// ═══════════════════════════════════════════════════════════

function initMap(lat, lon) {
  const mapEl = el('radar-map');

  if (state.map) {
    state.map.setView([lat, lon], 8);
    if (state.loc) {
      state.map.eachLayer(l => { if (l instanceof L.Marker) state.map.removeLayer(l); });
      L.marker([lat, lon]).addTo(state.map).bindPopup(`📍 ${state.loc.name}`).openPopup();
    }
    return;
  }

  state.map = L.map(mapEl, { zoomControl: true }).setView([lat, lon], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    opacity: 0.75,
  }).addTo(state.map);

  L.marker([lat, lon])
    .addTo(state.map)
    .bindPopup(`📍 ${state.loc?.name || 'Location'}`)
    .openPopup();

  loadRainViewer();
}

async function loadRainViewer() {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    state.radarData = await res.json();
    buildRadarControls();
    addRadarFrames();
  } catch (e) {
    console.warn('RainViewer unavailable:', e);
    el('radar-controls').innerHTML = '<span style="color:#8fa3b8;font-size:.85rem">Radar currently unavailable</span>';
  }
}

function buildRadarControls() {
  el('radar-controls').innerHTML = `
    <button id="radar-play-btn" class="btn btn-secondary"
      onclick="toggleRadarPlay()">⏸ Pause</button>
    <button id="sat-toggle-btn" class="btn btn-secondary"
      onclick="toggleSatellite()">🛰️ Satellite</button>
    <span class="radar-time" id="radar-time-label">Loading frames…</span>
  `;
}

function addRadarFrames() {
  // Clear old radar layers
  state.radarLayers.forEach(l => state.map.removeLayer(l));
  state.radarLayers = [];

  const frames = state.radarData?.radar?.past || [];
  if (!frames.length) return;

  frames.forEach(frame => {
    const layer = L.tileLayer(
      `${state.radarData.host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`,
      { opacity: 0, zIndex: 200, tileSize: 256, attribution: 'RainViewer' }
    );
    layer.addTo(state.map);
    state.radarLayers.push({ layer, time: frame.time });
  });

  state.radarFrame = state.radarLayers.length - 1;
  showRadarFrame(state.radarFrame);
  startRadarAnimation();
}

function showRadarFrame(idx) {
  state.radarLayers.forEach((f, i) => f.layer.setOpacity(i === idx ? 0.7 : 0));
  const frameData = state.radarLayers[idx];
  if (frameData) {
    const d = new Date(frameData.time * 1000);
    const label = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    const timeEl = el('radar-time-label');
    if (timeEl) timeEl.textContent = `Radar: ${label}`;
  }
}

function startRadarAnimation() {
  if (state.radarTimer) clearInterval(state.radarTimer);
  state.radarTimer = setInterval(() => {
    if (!state.radarPlay || !state.radarLayers.length) return;
    state.radarFrame = (state.radarFrame + 1) % state.radarLayers.length;
    showRadarFrame(state.radarFrame);
  }, 600);
}

window.toggleRadarPlay = function () {
  state.radarPlay = !state.radarPlay;
  const btn = el('radar-play-btn');
  if (btn) btn.textContent = state.radarPlay ? '⏸ Pause' : '▶ Play';
};

window.toggleSatellite = function () {
  if (state.satLayer) {
    state.map.removeLayer(state.satLayer);
    state.satLayer = null;
    const btn = el('sat-toggle-btn');
    if (btn) btn.style.opacity = '1';
    return;
  }
  const infrared = state.radarData?.satellite?.infrared;
  if (!infrared?.length) return;
  const latest = infrared[infrared.length - 1];
  state.satLayer = L.tileLayer(
    `${state.radarData.host}${latest.path}/256/{z}/{x}/{y}/0/0_0.png`,
    { opacity: 0.5, zIndex: 100, tileSize: 256, attribution: 'RainViewer satellite' }
  );
  state.satLayer.addTo(state.map);
  const btn = el('sat-toggle-btn');
  if (btn) btn.style.opacity = '0.6';
};

// ═══════════════════════════════════════════════════════════
// SEARCH AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════

const debouncedAutocomplete = debounce(async query => {
  if (query.length < 2) { el('search-results').classList.add('hidden'); return; }
  try {
    const results = await geocode(query);
    renderSearchResults(results);
  } catch (_) {}
}, 320);

function renderSearchResults(results) {
  const container = el('search-results');
  if (!results.length) { container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  container.innerHTML = results.map((r, i) => `
    <div class="search-result-item" onclick="pickResult(${i})">
      <span class="result-flag">${countryFlag(r.country_code)}</span>
      <span class="result-name">${r.name}</span>
      <span class="result-detail">${[r.admin1, r.country].filter(Boolean).join(', ')}</span>
    </div>
  `).join('');
  window._geocodeResults = results;
}

window.pickResult = function (idx) {
  const r = (window._geocodeResults || [])[idx];
  if (!r) return;
  const name = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
  el('location-input').value = name;
  el('search-results').classList.add('hidden');
  state.loc = { lat: r.latitude, lon: r.longitude, name, countryCode: r.country_code };
  loadWeather(r.latitude, r.longitude, name);
};

// ═══════════════════════════════════════════════════════════
// MAIN — LOAD WEATHER
// ═══════════════════════════════════════════════════════════

async function loadWeather(lat, lon, locationName) {
  el('error-message').classList.add('hidden');
  showLoading(true);
  el('main-content').classList.add('hidden');

  try {
    const [omRes, owmRes, wapiRes, nwsRes] = await Promise.allSettled([
      fetchOpenMeteo(lat, lon),
      fetchOWM(lat, lon),
      fetchWeatherAPI(lat, lon),
      fetchNWSAlerts(lat, lon),
    ]);

    if (omRes.status !== 'fulfilled') throw new Error(omRes.reason?.message || 'Failed to load Open-Meteo data');

    state.sources.openmeteo = omRes.value;
    state.sources.owm  = owmRes.status  === 'fulfilled' ? owmRes.value  : null;
    state.sources.wapi = wapiRes.status === 'fulfilled' ? wapiRes.value : null;

    // Surface any non-primary API errors as hints
    if (owmRes.status === 'rejected' && state.config.owmKey) {
      console.warn('OWM error:', owmRes.reason?.message);
    }
    if (wapiRes.status === 'rejected' && state.config.wapiKey) {
      console.warn('WeatherAPI error:', wapiRes.reason?.message);
    }

    const om  = state.sources.openmeteo;
    const nws = nwsRes.status === 'fulfilled' ? nwsRes.value : [];

    // Warnings
    const warnings = [
      ...warnFromNWS(nws),
      ...warnFromWAPI(state.sources.wapi),
      ...warnFromWMO(om.daily),
    ];
    displayWarnings(warnings);

    // Location header — use textContent to avoid XSS with user-provided location name
    const nameEl = el('location-name');
    nameEl.textContent = '';
    nameEl.append(
      document.createTextNode(`📍 ${locationName} `),
      document.createTextNode(countryFlag(state.loc?.countryCode || '')),
    );
    el('location-time').textContent = new Date().toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Background
    updateBackground(om.current.weather_code, om.current.is_day);

    // Sections
    displayCurrentWeather(om);
    displaySourcesComparison();
    displayHourlyChart(om.hourly);
    displayDailyForecast(om.daily);

    // Show main content
    showLoading(false);
    el('main-content').classList.remove('hidden');

    // Map (deferred)
    setTimeout(() => initMap(lat, lon), 80);

    // Page title + URL
    document.title = `${WMO[om.current.weather_code]?.icon || ''} ${locationName} — WeatherOrNot`;
    const url = new URL(window.location.href);
    url.searchParams.set('lat', lat.toFixed(4));
    url.searchParams.set('lon', lon.toFixed(4));
    url.searchParams.set('name', locationName);
    window.history.pushState({}, '', url);

  } catch (err) {
    showLoading(false);
    showError(`❌ ${err.message}`);
    console.error(err);
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════

function updateUnitToggle() {
  const btn = el('unit-toggle');
  if (btn) btn.textContent = state.config.unit === 'C' ? '°F' : '°C';
}

async function handleSearch() {
  const query = el('location-input').value.trim();
  if (!query) return;
  el('search-results').classList.add('hidden');
  try {
    const results = await geocode(query);
    if (!results.length) { showError('❌ Location not found. Try a city name, town, or postcode.'); return; }
    if (results.length === 1) {
      window._geocodeResults = results;
      window.pickResult(0);
    } else {
      renderSearchResults(results);
    }
  } catch (e) {
    showError(`❌ ${e.message}`);
  }
}

async function handleGeolocate() {
  if (!navigator.geolocation) { showError('❌ Geolocation is not supported by your browser.'); return; }
  const btn = el('locate-btn');
  btn.textContent = '📍 Locating…';
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      let name = 'Your Location';
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const json = await res.json();
        const a    = json.address || {};
        const city = a.city || a.town || a.village || a.county || a.state_district || a.state;
        name = [city, a.country].filter(Boolean).join(', ');
      } catch (_) {}
      el('location-input').value = name;
      state.loc = { lat, lon, name };
      btn.textContent = '📍 My Location';
      btn.disabled = false;
      loadWeather(lat, lon, name);
    },
    err => {
      showError(`❌ Could not get location: ${err.message}`);
      btn.textContent = '📍 My Location';
      btn.disabled = false;
    },
    { timeout: GEOLOCATION_TIMEOUT }
  );
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

function init() {
  loadConfig();

  // Resolve source link from current page URL (works across forks/renames)
  const sourceLink = el('source-link');
  if (sourceLink) {
    const repoBase = window.location.href.replace(/\/docs\/.*$/, '');
    if (repoBase.includes('github.io')) {
      // GitHub Pages URL: https://user.github.io/repo/ → infer repo source
      const parts = window.location.hostname.split('.');
      const user  = parts[0];
      const repo  = window.location.pathname.split('/').filter(Boolean)[0] || user;
      sourceLink.href = `https://github.com/${user}/${repo}/tree/main/docs`;
    }
  }

  // Search input events
  const searchInput = el('location-input');
  searchInput.addEventListener('input', e => debouncedAutocomplete(e.target.value));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
    if (e.key === 'Escape') el('search-results').classList.add('hidden');
  });

  el('search-btn').addEventListener('click', handleSearch);
  el('locate-btn').addEventListener('click', handleGeolocate);

  // Unit toggle
  el('unit-toggle').addEventListener('click', () => {
    state.config.unit = state.config.unit === 'C' ? 'F' : 'C';
    saveConfig();
    updateUnitToggle();
    const om = state.sources.openmeteo;
    if (om) {
      displayCurrentWeather(om);
      displaySourcesComparison();
      displayHourlyChart(om.hourly);
      displayDailyForecast(om.daily);
    }
  });

  // API keys panel
  el('toggle-api-keys').addEventListener('click', () => {
    el('api-keys-panel').classList.toggle('hidden');
  });
  el('save-api-keys').addEventListener('click', () => {
    state.config.owmKey  = el('owm-key').value.trim();
    state.config.wapiKey = el('wapi-key').value.trim();
    saveConfig();
    el('api-keys-panel').classList.add('hidden');
    if (state.loc) loadWeather(state.loc.lat, state.loc.lon, state.loc.name);
  });

  // Close autocomplete when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) {
      el('search-results').classList.add('hidden');
    }
  });

  // URL params → auto-load
  const params = new URLSearchParams(window.location.search);
  const lat  = parseFloat(params.get('lat'));
  const lon  = parseFloat(params.get('lon'));
  const name = params.get('name');
  if (!isNaN(lat) && !isNaN(lon) && name) {
    el('location-input').value = name;
    state.loc = { lat, lon, name };
    loadWeather(lat, lon, name);
  }
}

document.addEventListener('DOMContentLoaded', init);
