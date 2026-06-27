// ─────────────────────────────────────────────────────────────────────────────
// weather.js — Fetches OWM (ground conditions) + Open-Meteo (wind heights)
//              and merges them into one WhatsApp report.
//
// OWM  → temp, humidity, rain, visibility, cloud cover, ground wind
// Open-Meteo → wind speed + direction at 10m / 80m / 120m / 180m
// ─────────────────────────────────────────────────────────────────────────────

const axios                               = require("axios");
const { fetchWindData, formatWindBlock, formatWindReport, buildOverallAdvisory } = require("./wind");

const OWM_KEY = process.env.OPENWEATHER_API_KEY;

// ── Fetch OWM ground conditions ────────────────────────────────────────────
async function fetchGroundWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;

  const res = await axios.get(url);
  const d   = res.data;

  return {
    temp:        Math.round(d.main.temp),
    feelsLike:   Math.round(d.main.feels_like),
    humidity:    d.main.humidity,
    description: d.weather[0].description,
    weatherCode: d.weather[0].id,
    windGround:  Math.round((d.wind.speed || 0) * 3.6),   // m/s → km/h
    gustGround:  Math.round((d.wind.gust  || d.wind.speed || 0) * 3.6),
    visibility:  d.visibility ? Math.round(d.visibility / 1000) : "N/A",
    rainMm:      d.rain ? (d.rain["1h"] || 0) : 0,
    cityName:    d.name || "",
  };
}

// ── Full combined report ────────────────────────────────────────────────────
/**
 * Fetches OWM + Open-Meteo IN PARALLEL, merges, returns formatted WhatsApp string.
 */
async function getFullReport(lat, lon, engineerName, siteName) {
  // Fire both API calls at the same time — no waiting for one then the other
  const [ground, wind] = await Promise.all([
    fetchGroundWeather(lat, lon),
    fetchWindData(lat, lon),
  ]);

  const now     = new Date();
  const timeIST = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
  const dateIST = now.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const weatherEmoji = getWeatherEmoji(ground.weatherCode);
  const rainLine     = ground.rainMm > 0
    ? `\n🌧️ *Rain (last 1h):* ${ground.rainMm} mm — check ground stability`
    : "";

  const windBlock    = formatWindBlock(wind);
  const advisory     = buildCraneAdvisory(wind.levels);

  return (
    `🏗️ *Full Site Report*\n` +
    `👷 ${engineerName} | ${siteName}\n` +
    `📍 ${ground.cityName}  •  ${dateIST}, ${timeIST} IST\n` +
    `─────────────────\n` +
    `${weatherEmoji} *${capitalize(ground.description)}*\n` +
    `🌡️ *Temp:* ${ground.temp}°C  (feels ${ground.feelsLike}°C)\n` +
    `💧 *Humidity:* ${ground.humidity}%\n` +
    `👁️ *Visibility:* ${ground.visibility} km` +
    rainLine + "\n" +
    `─────────────────\n` +
    windBlock + "\n" +
    `─────────────────\n` +
    advisory
  );
}

// ── Ground-only report (quick weather) ─────────────────────────────────────
async function getGroundReport(lat, lon, engineerName, siteName) {
  const ground  = await fetchGroundWeather(lat, lon);
  const emoji   = getWeatherEmoji(ground.weatherCode);
  const rainLine = ground.rainMm > 0
    ? `\n🌧️ *Rain (1h):* ${ground.rainMm} mm`
    : "";

  const now     = new Date();
  const timeIST = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

  return (
    `⛅ *Current Weather*\n` +
    `👷 ${engineerName} | ${siteName}\n` +
    `🕐 ${timeIST} IST\n` +
    `─────────────────\n` +
    `${emoji} *${capitalize(ground.description)}*\n` +
    `🌡️ *Temp:* ${ground.temp}°C  (feels ${ground.feelsLike}°C)\n` +
    `💧 *Humidity:* ${ground.humidity}%\n` +
    `👁️ *Visibility:* ${ground.visibility} km` +
    rainLine
  );
}

// ── Wind-only report ────────────────────────────────────────────────────────
async function getWindReport(lat, lon, engineerName, siteName) {
  const { fetchWindData, formatWindReport } = require("./wind");
  const wind = await fetchWindData(lat, lon);
  return formatWindReport(wind, engineerName, siteName);
}

// ── Crane advisory from wind levels ─────────────────────────────────────────
function buildCraneAdvisory(levels) {
  const red    = levels.filter(l => l.advisory.label === "Danger");
  const yellow = levels.filter(l => l.advisory.label === "Caution");

  if (red.length > 0) {
    const heights = red.map(l => `${l.height}m`).join(", ");
    const worst   = Math.max(...red.map(l => l.speedKmh));
    return (
      `🔴 *RED ALERT — STOP ALL CRANE LIFTS*\n` +
      `Danger wind at: ${heights}  (max ${worst} km/h)\n` +
      `Contact site supervisor immediately.`
    );
  }
  if (yellow.length > 0) {
    const heights = yellow.map(l => `${l.height}m`).join(", ");
    return (
      `🟡 *CAUTION — High wind at: ${heights}*\n` +
      `Verify lift plan before picks at those heights.`
    );
  }
  return `🟢 *All heights clear.* Normal operations permitted.`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getWeatherEmoji(code) {
  if (code >= 200 && code < 300) return "⛈️";
  if (code >= 300 && code < 400) return "🌦️";
  if (code >= 500 && code < 600) return "🌧️";
  if (code >= 600 && code < 700) return "❄️";
  if (code >= 700 && code < 800) return "🌫️";
  if (code === 800)               return "☀️";
  if (code === 801)               return "🌤️";
  if (code === 802)               return "⛅";
  return "☁️";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  getFullReport,
  getGroundReport,
  getWindReport,
};
