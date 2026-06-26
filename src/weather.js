// ─────────────────────────────────────────────────────────────────────────────
// weather.js — Fetches weather from OpenWeatherMap and formats the report
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");

const API_KEY = process.env.OPENWEATHER_API_KEY;

// Wind speed thresholds for crane operations (km/h)
const WIND_CAUTION  = 30;  // Yellow alert
const WIND_DANGER   = 50;  // Red alert — stop lifts

/**
 * Fetch current weather for given GPS coordinates.
 * Returns a formatted WhatsApp message string.
 */
async function getWeatherReport(lat, lon, engineerName, siteName) {
  const url = `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;

  const res = await axios.get(url);
  const d = res.data;

  const temp        = Math.round(d.main.temp);
  const feelsLike   = Math.round(d.main.feels_like);
  const humidity    = d.main.humidity;
  const description = d.weather[0].description;
  const windKmh     = Math.round(d.wind.speed * 3.6);      // m/s → km/h
  const gustKmh     = d.wind.gust ? Math.round(d.wind.gust * 3.6) : windKmh;
  const visibility  = d.visibility ? Math.round(d.visibility / 1000) : "N/A";
  const cityName    = d.name || "Your location";

  // ── Weather emoji ────────────────────────────────────────────
  const weatherEmoji = getWeatherEmoji(d.weather[0].id);

  // ── Crane advisory based on wind ─────────────────────────────
  let craneAdvisory;
  if (gustKmh >= WIND_DANGER) {
    craneAdvisory =
      `🔴 *RED ALERT — STOP ALL CRANE LIFTS*\n` +
      `Wind gusts at ${gustKmh} km/h. Unsafe for all lift operations.\n` +
      `Contact site supervisor immediately.`;
  } else if (gustKmh >= WIND_CAUTION) {
    craneAdvisory =
      `🟡 *CAUTION — High wind advisory*\n` +
      `Gusts at ${gustKmh} km/h. Verify lift plan before any pick above 15m.`;
  } else {
    craneAdvisory =
      `🟢 *Wind conditions acceptable for crane operations.*`;
  }

  // ── Rain warning ─────────────────────────────────────────────
  let rainNote = "";
  if (d.rain && d.rain["1h"] > 0) {
    rainNote = `\n🌧️ *Rain in last 1h:* ${d.rain["1h"]} mm — check ground conditions`;
  }

  // ── Format timestamp in IST ───────────────────────────────────
  const now = new Date();
  const timeIST = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const dateIST = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  // ── Build the message ────────────────────────────────────────
  const message =
    `🏗️ *Weather Report*\n` +
    `👷 ${engineerName} | ${siteName}\n` +
    `📍 ${cityName}  •  ${dateIST}, ${timeIST} IST\n` +
    `─────────────────────\n` +
    `${weatherEmoji} *${capitalize(description)}*\n` +
    `🌡️ *Temp:* ${temp}°C  (feels ${feelsLike}°C)\n` +
    `💨 *Wind:* ${windKmh} km/h  |  Gusts: ${gustKmh} km/h\n` +
    `💧 *Humidity:* ${humidity}%\n` +
    `👁️ *Visibility:* ${visibility} km` +
    rainNote + "\n" +
    `─────────────────────\n` +
    craneAdvisory;

  return message;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeatherEmoji(code) {
  if (code >= 200 && code < 300) return "⛈️";   // Thunderstorm
  if (code >= 300 && code < 400) return "🌦️";   // Drizzle
  if (code >= 500 && code < 600) return "🌧️";   // Rain
  if (code >= 600 && code < 700) return "❄️";   // Snow
  if (code >= 700 && code < 800) return "🌫️";   // Fog/haze
  if (code === 800)               return "☀️";   // Clear
  if (code === 801)               return "🌤️";   // Few clouds
  if (code === 802)               return "⛅";   // Scattered clouds
  return "☁️";                                   // Overcast
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { getWeatherReport };
