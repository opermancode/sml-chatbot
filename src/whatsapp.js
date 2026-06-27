// ─────────────────────────────────────────────────────────────────────────────
// whatsapp.js — WhatsApp Cloud API sender
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN           = process.env.WHATSAPP_TOKEN;
const API_URL         = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// ── Plain text message ──────────────────────────────────────────────────────
async function sendMessage(to, text) {
  await axios.post(API_URL, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  }, { headers: HEADERS });
  console.log(`✅ Text sent → ${to}`);
}

// ── Interactive message with quick-reply buttons (max 3 per message) ────────
// WhatsApp allows max 3 buttons per interactive message.
// If more than 3 options, use a list message instead (see sendListMessage).
//
// buttons: [{ id: "button_id", title: "Button Label" }, ...]  (max 3)
async function sendQuickReplies(to, bodyText, buttons) {
  if (buttons.length <= 3) {
    await axios.post(API_URL, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }, { headers: HEADERS });

  } else {
    // More than 3 options → use a list message (supports up to 10 items)
    await axios.post(API_URL, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: "Choose option",
          sections: [{
            title: "Options",
            rows: buttons.map(b => ({
              id:          b.id,
              title:       b.title,
              description: b.description || "",
            })),
          }],
        },
      },
    }, { headers: HEADERS });
  }

  console.log(`✅ Quick-reply sent → ${to} (${buttons.length} buttons)`);
}

// ── Broadcast: send same message to a list of phone numbers ─────────────────
// Uses a pre-approved template for admin-initiated messages.
// templateName: the approved template name in your Meta dashboard
// templateParams: array of parameter strings to fill placeholders
async function broadcastTemplate(phones, templateName, templateParams = []) {
  const results = [];

  for (const phone of phones) {
    try {
      await axios.post(API_URL, {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name:     templateName,
          language: { code: "en" },
          components: templateParams.length > 0 ? [{
            type: "body",
            parameters: templateParams.map(p => ({ type: "text", text: p })),
          }] : [],
        },
      }, { headers: HEADERS });

      results.push({ phone, status: "sent" });
      await sleep(300); // Stay within rate limits
    } catch (err) {
      console.error(`❌ Broadcast failed → ${phone}:`, err.response?.data || err.message);
      results.push({ phone, status: "failed", error: err.message });
    }
  }

  return results;
}

// ── Free-form broadcast (only works inside 24h service window) ──────────────
// Use this for admin alerts AFTER engineers have messaged the bot today.
async function broadcastFreeText(phones, text) {
  const results = [];
  for (const phone of phones) {
    try {
      await sendMessage(phone, text);
      results.push({ phone, status: "sent" });
      await sleep(300);
    } catch (err) {
      results.push({ phone, status: "failed", error: err.message });
    }
  }
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  sendMessage,
  sendQuickReplies,
  broadcastTemplate,
  broadcastFreeText,
};
