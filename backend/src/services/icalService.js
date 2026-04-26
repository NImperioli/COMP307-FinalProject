// Nicholas Imperioli - 261120345

// Generates a minimal RFC 5545 .ics file
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}@mybookings`;

const buildICS = (events) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyBookings//McGill//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid()}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(ev.start)}`,
      `DTEND:${formatDate(ev.end)}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${(ev.description || "").replace(/\n/g, "\\n")}`,
      ev.organizer ? `ORGANIZER:mailto:${ev.organizer}` : "",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
};

module.exports = { buildICS };