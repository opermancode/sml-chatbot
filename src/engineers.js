// ─────────────────────────────────────────────────────────────────────────────
// engineers.js — Registered engineer list
//
// Each engineer has:
//   phone  → international format, no +, no spaces (91XXXXXXXXXX for India)
//   name   → display name used in WhatsApp messages
//   site   → site name shown in reports
//   lat    → site latitude  (used as default location)
//   lon    → site longitude (used as default location)
//
// Engineers can override lat/lon by sharing their GPS from WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

const engineers = [
  {
    phone: "919876543210",
    name:  "Rajan Patil",
    site:  "Pune Industrial Zone",
    lat:   18.6298,
    lon:   73.7997,
  },
  {
    phone: "919812345678",
    name:  "Suresh Mane",
    site:  "Hinjewadi Tower Block",
    lat:   18.5912,
    lon:   73.7389,
  },
  {
    phone: "919898765432",
    name:  "Amit Chavan",
    site:  "Pimpri Infra Site",
    lat:   18.6279,
    lon:   73.8009,
  },

  // ── Add more engineers below ──
  // {
  //   phone: "91XXXXXXXXXX",
  //   name:  "Engineer Name",
  //   site:  "Site Name",
  //   lat:   18.0000,
  //   lon:   73.0000,
  // },
];

function findEngineer(phone) {
  const normalized = phone.replace(/^\+/, "");
  return engineers.find(e => e.phone === normalized) || null;
}

function getAllEngineers() {
  return engineers;
}

function getEngineersBySite(siteName) {
  return engineers.filter(e => e.site === siteName);
}

module.exports = { findEngineer, getAllEngineers, getEngineersBySite };
