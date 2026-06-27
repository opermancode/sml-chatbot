// ─────────────────────────────────────────────────────────────────────────────
// wind.js — Fetches multi-height wind data from Open-Meteo API
//
// Heights fetched:
//   10m  → ground level (matches OWM for cross-check)
//   80m  → common crane boom / turbine hub height
//   120m → tall crane / offshore height
//   180m → max height Open-Meteo provides (research / aviation)
//
// Open-Meteo is FREE — no API key required.
// Docs: https://open-meteo.com/en/docs
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

// ── Wind thresholds for crane operations (km/h) ────────────────────────────
// Adjust these to match your crane manufacturer's limits
const THRESHOLDS = {
  GREEN:  { max: 30,  label: "Safe",        emoji: "🟢" },
  YELLOW: { max: 50,  label: "Caution",     emoji: "🟡" },
  RED:    { max: Infinity, label: "Danger", emoji: "🔴" },
};

// ── Heights to fetch ───────────────────────────────────────────────────────
const HEIGHTS = [10, 80, 120, 180];

/**
 * Fetch current wind speed + direction at all 4 heights for a given location.
 *
 * @param {number} lat   - Latitude
 * @param {number} lon   - Longitude
 * @returns {Promise<WindData>}
 */
async function fetchWindData(lat, lon) {
  // Build the parameter list: speed + direction for each height
  const windspeedParams = HEIGHTS.map(h => `wind_speed_${h}m`).join(",");
  const winddirParams   = HEIGHTS.map(h => `wind_direction_${h}m`).join(",");

  const url =
    `${BASE_URL}` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=${windspeedParams},${winddirParams}` +
    `&wind_speed_unit=kmh` +   // return km/h directly — no conversion needed
    `&timezone=Asia%2FKolkata`; // IST

  const res  = await axios.get(url);
  const curr = res.data.current;

  // Parse into a clean object per height
  const levels = HEIGHTS.map(h => {
    const speedKmh    = Math.round(curr[`wind_speed_${h}m`]);
    const directionDeg = Math.round(curr[`wind_direction_${h}m`]);

    return {
      height:       h,
      speedKmh,
      directionDeg,
      directionText: degreesToCompass(directionDeg),
      advisory:      getAdvisory(speedKmh),
    };
  });

  return {
    levels,
    fetchedAt: new Date(),
    worstLevel: getWorstLevel(levels),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT — WhatsApp message string
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a formatted WhatsApp string from the wind data.
 * Call this after fetchWindData().
 */
function formatWindReport(windData, engineerName, siteName) {
  const { levels, worstLevel, fetchedAt } = windData;

  const timeIST = fetchedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

  // Build the per-height table
  const heightLines = levels.map(l => {
    const bar = speedBar(l.speedKmh);
    return (
      `${l.advisory.emoji} *${l.height}m* → ${l.speedKmh} km/h ${l.directionText} ${bar}`
    );
  });

  // Overall crane advisory
  const overallAdvisory = buildOverallAdvisory(levels);

  return (
    `🌬️ *Wind Report*\n` +
    `👷 ${engineerName} | ${siteName}\n` +
    `🕐 ${timeIST} IST\n` +
    `─────────────────\n` +
    `*Height &nbsp;&nbsp;→ Speed &nbsp;&nbsp;Direction*\n` +
    heightLines.join("\n") +
    `\n─────────────────\n` +
    overallAdvisory
  );
}

/**
 * Returns just the 4-height wind table block (used inside the full report).
 */
function formatWindBlock(windData) {
  const { levels } = windData;

  const lines = levels.map(l =>
    `${l.advisory.emoji} ${l.height}m → ${l.speedKmh} km/h ${l.directionText}`
  );

  return (
    `*Wind profile:*\n` +
    lines.join("\n")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getAdvisory(speedKmh) {
  if (speedKmh < THRESHOLDS.GREEN.max)  return { ...THRESHOLDS.GREEN };
  if (speedKmh < THRESHOLDS.YELLOW.max) return { ...THRESHOLDS.YELLOW };
  return { ...THRESHOLDS.RED };
}

function getWorstLevel(levels) {
  // Returns the level object with the highest wind speed
  return levels.reduce((worst, l) =>
    l.speedKmh > worst.speedKmh ? l : worst
  );
}

/**
 * Build the overall crane advisory message based on which heights are affected.
 */
function buildOverallAdvisory(levels) {
  const redLevels    = levels.filter(l => l.advisory.label === "Danger");
  const yellowLevels = levels.filter(l => l.advisory.label === "Caution");

  if (redLevels.length > 0) {
    const heights = redLevels.map(l => `${l.height}m`).join(", ");
    return (
      `🔴 *RED ALERT — STOP ALL CRANE LIFTS*\n` +
      `Wind exceeds safe limits at: ${heights}\n` +
      `Max recorded: ${redLevels[0].speedKmh} km/h\n` +
      `Contact site supervisor immediately.`
    );
  }

  if (yellowLevels.length > 0) {
    const heights = yellowLevels.map(l => `${l.height}m`).join(", ");
    return (
      `🟡 *CAUTION — Elevated wind at: ${heights}*\n` +
      `Verify lift plan before any pick at these heights.\n` +
      `Re-check conditions before each lift.`
    );
  }

  return `🟢 *All heights within safe limits.*\nNormal crane operations permitted.`;
}

/**
 * Converts wind degrees to 16-point compass direction.
 * e.g. 270° → "W", 315° → "NW"
 */
function degreesToCompass(deg) {
  const dirs = [
    "N","NNE","NE","ENE",
    "E","ESE","SE","SSE",
    "S","SSW","SW","WSW",
    "W","WNW","NW","NNW",
  ];
  const index = Math.round(deg / 22.5) % 16;
  return dirs[index];
}

/**
 * Returns a mini visual bar to show relative wind intensity.
 * ▁▃▅▇ scale — purely cosmetic in the WhatsApp message.
 */
function speedBar(kmh) {
  if (kmh < 10)  return "▁";
  if (kmh < 20)  return "▁▃";
  if (kmh < 30)  return "▁▃▅";
  if (kmh < 40)  return "▁▃▅▆";
  if (kmh < 50)  return "▁▃▅▆▇";
  return "▁▃▅▆▇█";
}

module.exports = {
  fetchWindData,
  formatWindReport,
  formatWindBlock,
  HEIGHTS,
  THRESHOLDS,
};
