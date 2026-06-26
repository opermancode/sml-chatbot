// ─────────────────────────────────────────────────────────────────────────────
// engineers.js — Your "database" of registered engineers
//
// ADD your engineers here. The phone number MUST be in international format
// with country code, NO + sign, NO spaces, NO dashes.
//
// India example:  91XXXXXXXXXX  (91 = country code, then 10-digit number)
// ─────────────────────────────────────────────────────────────────────────────

const engineers = [
  {
    phone: "919876543210",       // <-- replace with real number
    name: "Rajan Patil",
    site: "Pimpri Industrial Site",
  },
  {
    phone: "919812345678",       // <-- replace with real number
    name: "Suresh Mane",
    site: "Pune Highway Project",
  },
  {
    phone: "919898765432",       // <-- replace with real number
    name: "Amit Chavan",
    site: "Hinjewadi Tower Block",
  },

  // ── Add more engineers below ──
  // {
  //   phone: "91XXXXXXXXXX",
  //   name: "Engineer Name",
  //   site: "Site Name",
  // },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Returns the engineer object if the phone is registered, else null.
 * This is the GATE — if null, the bot ignores the message completely.
 */
function findEngineer(phone) {
  // Normalize: strip any leading + if present
  const normalized = phone.replace(/^\+/, "");
  return engineers.find((e) => e.phone === normalized) || null;
}

/**
 * Returns all registered engineers (used by the daily scheduler).
 */
function getAllEngineers() {
  return engineers;
}

module.exports = { findEngineer, getAllEngineers };
