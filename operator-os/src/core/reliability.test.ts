import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validate, withReflection, chain, parallel } from "./reliability";

describe("reliability runtime (§2)", () => {
  it("validate rejects invalid input", () => {
    expect(() => validate(z.object({ a: z.number() }), { a: "x" })).toThrow();
  });
  it("chain rejects >5 steps", async () => {
    const steps = Array.from({ length: 6 }, (_, i) => ({ name: `s${i}`, run: async (c: number) => c + 1 }));
    await expect(chain(steps, 0)).rejects.toThrow(/5 steps/);
  });
  it("chain runs verification at index 2 and 4", async () => {
    const verified: number[] = [];
    const steps = Array.from({ length: 5 }, (_, i) => ({ name: `s${i}`, run: async (c: number) => c + 1 }));
    await chain(steps, 0, async (_c, i) => {
      verified.push(i);
    });
    expect(verified).toEqual([2, 4]);
  });
  it("withReflection retries once then succeeds (~99.75%)", async () => {
    let n = 0;
    const r = await withReflection(async () => {
      n++;
      if (n < 2) throw new Error("x");
      return "ok";
    });
    expect(r.value).toBe("ok");
    expect(r.attempts).toBe(2);
  });
  it("parallel runs branches concurrently", async () => {
    const r = await parallel([async () => 1, async () => 2, async () => 3]);
    expect(r).toEqual([1, 2, 3]);
  });
});
