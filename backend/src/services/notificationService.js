// Nicholas Imperioli - 261120345
const fmt = (date) => new Date(date).toLocaleString("en-CA", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto",
});

const buildMailto = ({ to, subject, body }) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// Owner events 
const slotDeletedNotification = (bookerEmail, slot) =>
  buildMailto({
    to:      bookerEmail,
    subject: `Your booking "${slot.title}" has been cancelled`,
    body:    [
      `Hi,`,
      ``,
      `Unfortunately, the booking slot "${slot.title}" scheduled for ${fmt(slot.startTime)} has been removed by the owner.`,
      ``,
      `Please visit the booking page to reserve another available slot.`,
      ``,
      `Sorry for the inconvenience.`,
    ].join("\n"),
  });

const recurringGroupDeletedNotification = (bookerEmail, affectedSlots) => {
  const slotList = affectedSlots
    .map(s => `  • ${s.title} — ${fmt(s.startTime)}`)
    .join("\n");

  return buildMailto({
    to:      bookerEmail,
    subject: `Your recurring booking has been cancelled`,
    body:    [
      `Hi,`,
      ``,
      `The following recurring office hour slot(s) you had booked have been removed by the owner:`,
      ``,
      slotList,
      ``,
      `Please visit the booking page to find another available slot.`,
      ``,
      `Sorry for the inconvenience.`,
    ].join("\n"),
  });
};

const ownerMessageToBooker = (bookerEmail, slot) =>
  buildMailto({
    to:      bookerEmail,
    subject: `Message about your booking — "${slot.title}"`,
    body:    [
      `Hi,`,
      ``,
      `This is a message regarding your booking "${slot.title}" on ${fmt(slot.startTime)}.`,
      ``,
      `[Write your message here]`,
    ].join("\n"),
  });

// User events
const reservationCancelledNotification = (ownerEmail, slot, bookerEmail) =>
  buildMailto({
    to:      ownerEmail,
    subject: `Booking cancelled — "${slot.title}"`,
    body:    [
      `Hi,`,
      ``,
      `${bookerEmail} has cancelled their reservation for:`,
      ``,
      `  "${slot.title}" on ${fmt(slot.startTime)}`,
      ``,
      `This slot is now available for others to book.`,
    ].join("\n"),
  });


const slotReservedNotification = (ownerEmail, slot, bookerEmail) =>
  buildMailto({
    to:      ownerEmail,
    subject: `New booking — "${slot.title}"`,
    body:    [
      `Hi,`,
      ``,
      `${bookerEmail} has reserved your office hour slot:`,
      ``,
      `  "${slot.title}" on ${fmt(slot.startTime)}`,
      ``,
      `This appointment will appear on both your and the student's dashboard.`,
    ].join("\n"),
  });

const userMessageToOwner = (ownerEmail, slot) =>
  buildMailto({
    to:      ownerEmail,
    subject: `Question about your slot — "${slot.title}"`,
    body:    [
      `Hi,`,
      ``,
      `I have a question about your office hour slot:`,
      ``,
      `  "${slot.title}" on ${fmt(slot.startTime)}`,
      ``,
      `[Write your question here]`,
    ].join("\n"),
  });

// Invitation URL builder 
const buildInviteUrl = (baseUrl, token, ownerId) =>
  `${baseUrl.replace(/\/$/, "")}/frontend/owner-slots.html` + `?token=${encodeURIComponent(token)}&ownerId=${ownerId}`;

module.exports = {
  slotDeletedNotification,
  recurringGroupDeletedNotification,
  ownerMessageToBooker,
  reservationCancelledNotification,
  slotReservedNotification,
  userMessageToOwner,
  buildInviteUrl,
};
