import { describe, it, expect } from "vitest";
import { isDueOn, stockLevel, isRunning } from "./schedule";

const base = { start_date: "2026-11-01", end_date: null, repeat_every: 1, week_days: null } as never as Parameters<typeof isDueOn>[0];

describe("medicine pause and stop", () => {
  it("paused medicine is not due from its pause date but was due before", () => {
    const m = { ...base, status: "paused", paused_from: "2026-11-10" };
    expect(isDueOn(m, "2026-11-09")).toBe(true);
    expect(isDueOn(m, "2026-11-10")).toBe(false);
  });
  it("stopped medicine keeps past days until its end date", () => {
    const m = { ...base, status: "discontinued", end_date: "2026-11-10" };
    expect(isDueOn(m, "2026-11-05")).toBe(true);
    expect(isDueOn(m, "2026-11-11")).toBe(false);
  });
  it("paused or stopped medicines raise no low-stock alert", () => {
    expect(isRunning({ status: "paused" })).toBe(false);
    const m = { ...base, status: "paused", paused_from: "2026-11-10", stock: 0, dose_qty: 1, times: ["08:00"] } as never;
    expect(stockLevel(m, "2026-11-12")).toBeNull();
  });
});
