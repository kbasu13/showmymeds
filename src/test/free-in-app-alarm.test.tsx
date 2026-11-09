import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The on-screen alarm must never depend on a Premium record, so the mocks below
// deliberately provide no premium_users row and no QueryClient at all.
vi.mock("@/components/MedImage", () => ({ MedImage: () => null }));

vi.mock("@/lib/meds", () => {
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const med = {
    id: "m1",
    name: "Metformin",
    dosage: "500 mg",
    form: "tablet",
    image_url: null,
    times: [hm],
    start_date: "2020-01-01",
    end_date: null,
    stock: 30,
    dose_qty: 1,
  };
  return {
    useMeds: () => ({ data: [med], isLoading: false }),
    useLogs: () => ({ data: [] }),
    useRefreshMeds: () => () => {},
    takeDose: vi.fn(),
  };
});

import { AlarmWatcher } from "@/components/AlarmWatcher";

describe("In-app reminders are free", () => {
  it("rings the on-screen alarm at dose time with no Premium record", async () => {
    render(<AlarmWatcher userId="u1" />);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Metformin");
    expect(screen.getByRole("button", { name: /I've taken it/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Snooze 10 minutes/i })).toBeInTheDocument();
  });
});
