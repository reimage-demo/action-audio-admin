import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "Process queued estimate emails",
  { minutes: 5 },
  internal.emails.drain,
);
crons.interval("Process queued promotions", { minutes: 5 }, internal.campaigns.drain);
export default crons;
