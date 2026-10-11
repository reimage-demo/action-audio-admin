// Four customer-facing milestones. Estimated movement never advances a staff-confirmed stage.
export const progressStages = [
  {
    id: "appointment",
    label: "Appointment",
    description: "Your request and appointment details.",
  },
  {
    id: "service",
    label: "In service",
    description: "Your vehicle is with our team.",
  },
  {
    id: "checks",
    label: "Final checks",
    description: "Finishing touches and quality checks.",
  },
  {
    id: "ready",
    label: "Ready",
    description: "The team has confirmed pickup.",
  },
];
const thresholds = {
  requested: { stage: 0, min: 5, max: 5 },
  confirmed: { stage: 0, min: 15, max: 24 },
  checked_in: { stage: 1, min: 25, max: 39 },
  in_progress: { stage: 1, min: 40, max: 74 },
  quality_check: { stage: 2, min: 75, max: 94 },
  ready: { stage: 3, min: 100, max: 100 },
  completed: { stage: 3, min: 100, max: 100 },
};
export const easternDate = (timestamp = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
const dayNumber = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const timestamp = Date.parse(date + "T12:00:00Z");
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === date
    ? Math.floor(timestamp / 86400000)
    : null;
};
export function journeyProgress(appointment, now = Date.now()) {
  const updates = appointment.updates || [];
  if (appointment.status === "cancelled")
    return {
      stage: -1,
      percent: 0,
      estimated: false,
      paused: false,
      overdue: false,
      label: "Appointment cancelled",
    };
  const paused = appointment.status === "waiting_parts";
  let current = appointment.status;
  let effectiveNow = now;
  if (paused) {
    let lastActive = updates.length - 1;
    while (lastActive >= 0 && updates[lastActive].status === "waiting_parts")
      lastActive--;
    current = lastActive >= 0 ? updates[lastActive].status : "in_progress";
    effectiveNow = updates[lastActive + 1]?.at ?? appointment.createdAt ?? now;
    if (current === "ready" || current === "completed")
      current = "quality_check";
  }
  const range = thresholds[current] || thresholds.requested;
  let start = appointment.createdAt ?? updates[0]?.at ?? effectiveNow;
  // Same-stage customer notes don't restart the estimate clock.
  for (let i = updates.length - 1; i >= 0; i--) {
    if (updates[i].status !== current) continue;
    start = updates[i].at;
    if (i === 0 || updates[i - 1].status !== current) break;
  }
  const startDay = dayNumber(easternDate(start));
  const targetDay = dayNumber(appointment.estimatedReadyDate);
  const currentDay = dayNumber(easternDate(effectiveNow));
  const estimated = targetDay !== null && range.min !== range.max;
  const fraction = estimated
    ? Math.max(
        0,
        Math.min(
          1,
          (currentDay - startDay) / Math.max(1, targetDay - startDay),
        ),
      )
    : 0;
  const percent = Math.min(
    range.max,
    range.min + Math.floor((range.max - range.min) * fraction),
  );
  const overdue =
    targetDay !== null &&
    dayNumber(easternDate(now)) > targetDay &&
    range.stage !== 3;
  return {
    stage: range.stage,
    percent,
    estimated,
    paused,
    overdue,
    label: paused ? "Waiting for parts" : progressStages[range.stage].label,
  };
}
