import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "Process queued estimate emails",
  { minutes: 5 },
  internal.emails.drain,
);
export default crons;
