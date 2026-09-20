/* Comms — channel connection state. Read-only status derived from config; the
   actual message adapters (Gmail API / Telegram MTProto / WhatsApp Web) light up
   once Alex completes each sign-in. Honest: nothing here fakes messages — it
   reports what's connected and exactly what each needs. */

function status(config) {
  config = config || {};
  return [
    {
      id: "gmail", name: "Gmail", hue: 8,
      connected: (() => { try { return require("./gmail").connected(); } catch { return false; } })(),
      need: "One Google sign-in — an OAuth client is already on file (shift_tracker/client_secret.json). Grant read access and Donna shows unread threads needing a reply.",
      difficulty: "easy",
    },
    {
      id: "telegram", name: "Telegram", hue: 214,
      connected: !!config.telegramSession,
      need: "api_id + api_hash from my.telegram.org, then a one-time phone login. Reads your own DMs/chats via the user API.",
      difficulty: "medium",
    },
    {
      id: "whatsapp", name: "WhatsApp", hue: 150,
      connected: !!config.whatsappSession,
      need: "Scan a QR from WhatsApp → Linked Devices (WhatsApp Web bridge). Fragile + unofficial — connect last.",
      difficulty: "fragile",
    },
  ];
}

module.exports = { status };
