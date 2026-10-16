import { describe, expect, it, vi } from "vitest";
import { withOpenColumn } from "@/lib/stations";

describe("withOpenColumn (databases that have not had migration 0007 yet)", () => {
  it("asks for the open_status column first", async () => {
    const load = vi.fn(async (columns: string) => columns);
    expect(await withOpenColumn(load)).toMatch(/open_status/);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falls back to the columns without it when the database says the column does not exist", async () => {
    const load = vi.fn(async (columns: string) => {
      if (columns.includes("open_status")) throw new Error("column reports.open_status does not exist");
      return columns;
    });
    const used = await withOpenColumn(load);
    expect(used).not.toMatch(/open_status/);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not hide other errors", async () => {
    const load = vi.fn(async () => {
      throw new Error("connection refused");
    });
    await expect(withOpenColumn(load)).rejects.toThrow("connection refused");
    expect(load).toHaveBeenCalledTimes(1);
  });
});
