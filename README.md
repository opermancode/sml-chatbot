[README.md](https://github.com/user-attachments/files/29412487/README.md)
# 🏗️ CraneWeather WhatsApp Bot

A WhatsApp bot for crane rental companies. Engineers share their GPS location → bot replies with a full weather report including a **crane wind advisory**.

Only engineers whose phone number is registered in `src/engineers.js` can use the bot. All other numbers are silently ignored.

---

## Project structure

```
whatsapp-weather-bot/
├── src/
│   ├── index.js        ← Main server (webhook + scheduler)
│   ├── engineers.js    ← Your registered engineers list  ← EDIT THIS
│   ├── weather.js      ← Weather fetching + formatting
│   └── whatsapp.js     ← WhatsApp API sender
├── .env.example        ← Copy to .env and fill in values
└── package.json
```

---

## Setup (step by step)

### Step 1 — Get your API keys

**WhatsApp (Meta):**
1. Go to https://developers.facebook.com → Create App → Business type
2. Add "WhatsApp" product
3. Go to WhatsApp → API Setup
4. Copy your **Access Token** and **Phone Number ID**

**Weather:**
1. Sign up at https://openweathermap.org
2. Go to API Keys → copy your key (free tier is enough)

---

### Step 2 — Configure the project

```bash
# Clone / download the project, then:
cd whatsapp-weather-bot
cp .env.example .env
```

Open `.env` and fill in:
```
WHATSAPP_TOKEN=EAAxxxxxxx...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WEBHOOK_VERIFY_TOKEN=mycranesecret123
OPENWEATHER_API_KEY=abc123...
PORT=3000
```

---

### Step 3 — Add your engineers

Open `src/engineers.js` and add your engineers:

```js
const engineers = [
  {
    phone: "919876543210",  // 91 + 10-digit Indian number, no + or spaces
    name: "Rajan Patil",
    site: "Pimpri Industrial Site",
  },
  // add more...
];
```

---

### Step 4 — Deploy and run

```bash
npm install
npm start
```

Your server needs a **public HTTPS URL** for Meta's webhook.
Easiest free options:
- **Railway**: https://railway.app (deploy from GitHub, free tier)
- **Render**: https://render.com (free tier, auto-deploys)
- **ngrok** (for local testing): `ngrok http 3000`

---

### Step 5 — Register your webhook with Meta

1. In Meta Developer dashboard → WhatsApp → Configuration
2. Set **Callback URL**: `https://your-domain.com/webhook`
3. Set **Verify Token**: same as `WEBHOOK_VERIFY_TOKEN` in your `.env`
4. Click Verify and Save
5. Subscribe to **messages** under Webhook Fields

---

## How engineers use it

1. Engineer opens WhatsApp → messages your bot number
2. Types **"hi"** (or "hello", "weather")
3. Bot replies asking for location
4. Engineer taps 📎 → Location → Send current location
5. Bot replies with full weather report + crane wind advisory

---

## What the weather message looks like

```
🏗️ Weather Report
👷 Rajan Patil | Pimpri Industrial Site
📍 Pune  •  27 Jun 2026, 09:15 AM IST
─────────────────────
⛅ Partly cloudy
🌡️ Temp: 29°C  (feels 33°C)
💨 Wind: 18 km/h  |  Gusts: 34 km/h
💧 Humidity: 72%
👁️ Visibility: 8 km
─────────────────────
🟡 CAUTION — High wind advisory
Gusts at 34 km/h. Verify lift plan before any pick above 15m.
```

---

## Wind advisory thresholds

| Condition          | Threshold     | Action                         |
|--------------------|---------------|--------------------------------|
| 🟢 Safe            | < 30 km/h     | Normal operations              |
| 🟡 Caution         | 30–49 km/h    | Check lift plan above 15m      |
| 🔴 Red Alert       | ≥ 50 km/h     | Stop all crane lifts           |

You can adjust these thresholds in `src/weather.js`:
```js
const WIND_CAUTION = 30;
const WIND_DANGER  = 50;
```
