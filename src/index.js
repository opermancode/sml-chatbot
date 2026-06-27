// ─────────────────────────────────────────────────────────────────────────────
// index.js — Main server
//
// Quick-reply button routing:
//   "current weather"  → OWM ground conditions only
//   "wind report"      → Open-Meteo 4-height wind only
//   "full report"      → OWM + Open-Meteo merged
//   "use my gps"       → ask for location → run full report on GPS coords
//   [location shared]  → run full report on received GPS coords
//   "hi" / "hello"     → show the 4 quick-reply buttons
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const cron    = require("node-cron");

const { findEngineer, getAllEngineers } = require("./engineers");
const { getFullReport, getGroundReport, getWindReport } = require("./weather");
const { sendMessage, sendQuickReplies }                 = require("./whatsapp");

const app = express();
app.use(express.json());

// Track engineers who have requested GPS mode
// { "919876543210": true }
const awaitingGPS = {};

// ── Webhook verification ───────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── Incoming message handler ───────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Always respond immediately

  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;

    const phone   = message.from;
    const msgType = message.type;

    // ── GATE: registered engineers only ──────────────────────────────────
    const engineer = findEngineer(phone);
    if (!engineer) {
      console.log(`🚫 Ignored unregistered number: ${phone}`);
      return;
    }

    const { name, site, lat, lon } = engineer;
    console.log(`📩 [${name}] type=${msgType}`);

    // ── LOCATION message (GPS share) ──────────────────────────────────────
    if (msgType === "location") {
      const { latitude, longitude } = message.location;
      awaitingGPS[phone] = false;

      await sendMessage(phone, `📍 Got your location. Fetching full report...`);
      const report = await getFullReport(latitude, longitude, name, `${site} (GPS)`);
      await sendMessage(phone, report);
      return;
    }

    // ── TEXT message ──────────────────────────────────────────────────────
    if (msgType === "text") {
      const text = message.text.body.trim().toLowerCase();

      // Greeting → show 4 quick-reply buttons
      if (isGreeting(text)) {
        await sendQuickReplies(phone,
          `👋 Hi ${name}!\n📍 Site: *${site}*\n\nWhat do you need?`,
          [
            { id: "current_weather", title: "Current weather" },
            { id: "wind_report",     title: "Wind report" },
            { id: "full_report",     title: "Full report" },
            { id: "use_gps",         title: "Use my GPS" },
          ]
        );
        return;
      }

      // If engineer is in GPS-awaiting mode and sends text instead of location
      if (awaitingGPS[phone]) {
        await sendMessage(phone,
          `📍 Still waiting for your location.\n` +
          `Tap the 📎 attachment icon → *Location* → *Send current location*\n\n` +
          `Or send *"hi"* to go back to the menu.`
        );
        return;
      }

      // Handle button replies (come as interactive messages, but some clients send text)
      await routeCommand(text, phone, engineer);
      return;
    }

    // ── INTERACTIVE message (button tap) ─────────────────────────────────
    if (msgType === "interactive") {
      const buttonId = message.interactive?.button_reply?.id
        || message.interactive?.list_reply?.id
        || "";
      await routeCommand(buttonId, phone, engineer);
      return;
    }

  } catch (err) {
    console.error("❌ Webhook error:", err.message);
  }
});

// ── Route a command string to the right report ─────────────────────────────
async function routeCommand(cmd, phone, engineer) {
  const { name, site, lat, lon } = engineer;

  if (cmd === "current_weather" || cmd.includes("current weather")) {
    await sendMessage(phone, `⏳ Fetching ground conditions...`);
    const report = await getGroundReport(lat, lon, name, site);
    await sendMessage(phone, report);
    return;
  }

  if (cmd === "wind_report" || cmd.includes("wind")) {
    await sendMessage(phone, `⏳ Fetching wind data at all heights...`);
    const report = await getWindReport(lat, lon, name, site);
    await sendMessage(phone, report);
    return;
  }

  if (cmd === "full_report" || cmd.includes("full")) {
    await sendMessage(phone, `⏳ Fetching full site report...`);
    const report = await getFullReport(lat, lon, name, site);
    await sendMessage(phone, report);
    return;
  }

  if (cmd === "use_gps" || cmd.includes("gps")) {
    awaitingGPS[phone] = true;
    await sendMessage(phone,
      `📍 Share your current location:\n\n` +
      `Tap the 📎 *attachment icon* → *Location* → *Send current location*`
    );
    return;
  }

  // Fallback: unknown input — show the menu again
  await sendQuickReplies(phone,
    `Hi ${name}! Choose an option:`,
    [
      { id: "current_weather", title: "Current weather" },
      { id: "wind_report",     title: "Wind report" },
      { id: "full_report",     title: "Full report" },
      { id: "use_gps",         title: "Use my GPS" },
    ]
  );
}

// ── Greeting detector ──────────────────────────────────────────────────────
function isGreeting(text) {
  const triggers = ["hi", "hello", "hey", "helo", "hii", "menu", "start", "help"];
  return triggers.some(t => text.startsWith(t));
}

// ── Scheduled morning report — 7:00 AM IST daily ──────────────────────────
cron.schedule("30 1 * * *", async () => {
  console.log("⏰ Sending morning wind reports...");
  const engineers = getAllEngineers();

  for (const eng of engineers) {
    try {
      const report = await getFullReport(eng.lat, eng.lon, eng.name, eng.site);
      const msg    = `🌅 *Good morning, ${eng.name}!*\n\n` + report;
      await sendMessage(eng.phone, msg);
      // Small delay between sends to avoid rate limits
      await sleep(500);
    } catch (err) {
      console.error(`❌ Morning report failed for ${eng.name}:`, err.message);
    }
  }
});

// ── Auto wind-alert check — every 30 minutes ──────────────────────────────
// If any site hits red-alert wind at any height, auto-broadcast to that site
cron.schedule("*/30 * * * *", async () => {
  const engineers = getAllEngineers();
  const { fetchWindData } = require("./wind");

  // Group by site to avoid re-fetching same coords multiple times
  const sitesSeen = {};

  for (const eng of engineers) {
    const siteKey = `${eng.lat},${eng.lon}`;
    if (sitesSeen[siteKey]) continue;
    sitesSeen[siteKey] = true;

    try {
      const wind    = await fetchWindData(eng.lat, eng.lon);
      const redLevels = wind.levels.filter(l => l.advisory.label === "Danger");

      if (redLevels.length > 0) {
        const heights = redLevels.map(l => `${l.height}m`).join(", ");
        const worst   = Math.max(...redLevels.map(l => l.speedKmh));
        const alert   =
          `🚨 *AUTO WIND ALERT — ${eng.site}*\n` +
          `─────────────────\n` +
          `Danger wind detected at: *${heights}*\n` +
          `Max speed: *${worst} km/h*\n\n` +
          `*Suspend all crane lifts* until conditions improve.\n` +
          `Check again in 30 minutes.`;

        // Send to all engineers on this site
        const siteEngineers = engineers.filter(
          e => `${e.lat},${e.lon}` === siteKey
        );
        for (const e of siteEngineers) {
          await sendMessage(e.phone, alert);
          await sleep(500);
        }
        console.log(`🚨 Auto-alert sent for site ${eng.site} (${redLevels.length} red heights)`);
      }
    } catch (err) {
      console.error(`❌ Wind check failed for ${eng.site}:`, err.message);
    }
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 CraneWeather Bot running on port ${PORT}`);
  console.log(`📡 Webhook: https://YOUR_DOMAIN/webhook\n`);
});
