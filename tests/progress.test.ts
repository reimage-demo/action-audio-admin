import { describe, it, expect } from "vitest";
import { journeyProgress, easternDate } from "../shared/progress.js";
const at = (day: string) => Date.parse(day + "T16:00:00Z");
const appointment = (status = "in_progress", target = "2026-10-15") => ({
  status,
  createdAt: at("2026-10-10"),
  estimatedReadyDate: target,
  updates: [
    { status: "requested", at: at("2026-10-09") },
    { status, at: at("2026-10-10") },
  ],
});
describe("honest four-stage customer progress", () => {
  it("advances estimates daily but never crosses the confirmed stage", () => {
    const a = appointment();
    expect(journeyProgress(a, at("2026-10-10")).percent).toBe(40);
    expect(journeyProgress(a, at("2026-10-12")).percent).toBe(53);
    expect(journeyProgress(a, at("2026-10-30"))).toMatchObject({
      percent: 74,
      stage: 1,
      estimated: true,
      overdue: true,
    });
    expect(
      journeyProgress(appointment("quality_check"), at("2026-10-30")).percent,
    ).toBe(94);
  });
  it("shows milestone percentages without a valid target and staff-confirmed completion only", () => {
    for (const target of ["", "invalid", "2026-02-30"])
      expect(
        journeyProgress(appointment("in_progress", target), at("2026-10-30")),
      ).toMatchObject({ percent: 40, estimated: false });
    expect(
      journeyProgress(appointment("ready"), at("2026-10-10")),
    ).toMatchObject({ percent: 100, stage: 3, estimated: false });
    expect(
      journeyProgress(appointment("requested"), at("2026-10-30")).percent,
    ).toBe(5);
    expect(
      journeyProgress(appointment("cancelled"), at("2026-10-30")),
    ).toMatchObject({ percent: 0, stage: -1 });
  });
  it("freezes parts holds, including repeated notes, until a team update resumes work", () => {
    const a = appointment();
    a.status = "waiting_parts";
    a.updates.push(
      { status: "waiting_parts", at: at("2026-10-12") },
      { status: "waiting_parts", at: at("2026-10-14") },
    );
    expect(journeyProgress(a, at("2026-10-14"))).toMatchObject({
      paused: true,
      percent: 53,
      stage: 1,
    });
    expect(journeyProgress(a, at("2026-10-30")).percent).toBe(53);
  });
  it("does not restart the estimate clock for a same-status customer note", () => {
    const a = appointment();
    a.updates.push({ status: "in_progress", at: at("2026-10-12") });
    expect(journeyProgress(a, at("2026-10-13")).percent).toBe(60);
  });
  it("uses Eastern calendar days through midnight and daylight saving transitions", () => {
    expect(easternDate(Date.parse("2026-10-11T02:00:00Z"))).toBe("2026-10-10");
    expect(easternDate(Date.parse("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
    const a = appointment("confirmed", "2026-11-04");
    a.updates[1].at = at("2026-10-31");
    expect(journeyProgress(a, at("2026-11-02")).percent).toBe(19);
  });
});
