// ─────────────────────────────────────────────────────────────────────────────
// whatsapp.js — Sends messages via the WhatsApp Business Cloud API
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN           = process.env.WHATSAPP_TOKEN;
const API_URL         = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

/**
 * Send a plain text message to a WhatsApp number.
 * @param {string} to    - Recipient phone in international format (no +)
 * @param {string} text  - Message body (supports WhatsApp markdown: *bold*, _italic_)
 */
async function sendMessage(to, text) {
  await axios.post(
    API_URL,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
  console.log(`✅ Message sent to ${to}`);
}

module.exports = { sendMessage };
