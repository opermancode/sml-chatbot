// ─────────────────────────────────────────────────────────────────────────────
// index.js — Main server
//
// Flow:
//   1. WhatsApp sends webhook → POST /webhook
//   2. Extract sender phone + message type
//   3. CHECK if phone is in our engineer list  ← THE GATE
//      • Not found → silently ignore (bot does nothing)
//      • Found     → continue
//   4. If message is "hi" / "hello" / "weather"
//      → Ask them to share their location
//   5. If message is a GPS location
//      → Fetch weather → send report
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const express   = require("express");
const cron      = require("node-cron");
const { findEngineer, getAllEngineers } = require("./engineers");
const { getWeatherReport }             = require("./weather");
const { sendMessage }                  = require("./whatsapp");

const app  = express();
app.use(express.json());

// ── In-memory store: last known location per engineer phone ───────────────────
// Used for scheduled daily pushes (if engineer already shared location before)
const lastLocation = {}; // { "919876543210": { lat, lon } }

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK VERIFICATION (one-time setup — Meta calls this to verify your server)
// ─────────────────────────────────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INCOMING MESSAGE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  // Always acknowledge immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return; // Not a message event (e.g. status update), skip

    const senderPhone = message.from; // e.g. "919876543210"
    const msgType     = message.type; // "text" | "location" | "image" | etc.

    // ── GATE: Is this phone registered? ─────────────────────────────────────
    const engineer = findEngineer(senderPhone);

    if (!engineer) {
      // Unknown number — bot stays silent. Do NOT reply.
      console.log(`🚫 Ignored message from unregistered number: ${senderPhone}`);
      return;
    }

    console.log(`📩 Message from ${engineer.name} (${senderPhone}) — type: ${msgType}`);

    // ── Handle TEXT messages ─────────────────────────────────────────────────
    if (msgType === "text") {
      const text = message.text.body.trim().toLowerCase();

      const greetings = ["hi", "hello", "hey", "helo", "hii", "weather", "report"];
      const isGreeting = greetings.some((g) => text.startsWith(g));

      if (isGreeting) {
        await sendMessage(
          senderPhone,
          `👋 Hello ${engineer.name}!\n\n` +
          `I'm the *CraneWeather Bot* 🏗️\n\n` +
          `Please share your *current location* so I can send you the weather report for your site.\n\n` +
          `📍 *How to share location:*\n` +
          `Tap the 📎 attachment icon → Location → Send your current location`
        );
      } else {
        // Unknown text from a registered engineer
        await sendMessage(
          senderPhone,
          `Hi ${engineer.name}! 👷\n\n` +
          `Send *"hi"* and then share your location to get the weather report.\n\n` +
          `📍 Tap 📎 → Location → Send current location`
        );
      }
      return;
    }

    // ── Handle LOCATION messages ─────────────────────────────────────────────
    if (msgType === "location") {
      const { latitude: lat, longitude: lon } = message.location;

      // Save last known location for this engineer (for scheduled reports)
      lastLocation[senderPhone] = { lat, lon };

      await sendMessage(senderPhone, `⏳ Fetching weather for your location...`);

      const report = await getWeatherReport(lat, lon, engineer.name, engineer.site);
      await sendMessage(senderPhone, report);
      return;
    }

    // ── Any other message type from a registered engineer ────────────────────
    await sendMessage(
      senderPhone,
      `Hi ${engineer.name}! Please share your *location* to get the weather report.\n\n` +
      `📍 Tap 📎 → Location → Send current location`
    );

  } catch (err) {
    console.error("❌ Error handling webhook:", err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED DAILY WEATHER PUSH
// Runs every day at 7:00 AM IST (01:30 UTC)
// Sends weather to engineers who have previously shared their location
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule("30 1 * * *", async () => {
  console.log("⏰ Running scheduled morning weather push...");

  const engineers = getAllEngineers();

  for (const engineer of engineers) {
    const loc = lastLocation[engineer.phone];

    if (!loc) {
      // Engineer hasn't shared location yet — skip silently
      console.log(`⚠️  No saved location for ${engineer.name}, skipping`);
      continue;
    }

    try {
      const report = await getWeatherReport(
        loc.lat,
        loc.lon,
        engineer.name,
        engineer.site
      );

      await sendMessage(engineer.phone, `🌅 *Good morning, ${engineer.name}!*\n\nHere is your daily site weather report:\n\n` + report);
      console.log(`✅ Morning report sent to ${engineer.name}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${engineer.name}:`, err.message);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 CraneWeather Bot is running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://YOUR_DOMAIN/webhook\n`);
});
