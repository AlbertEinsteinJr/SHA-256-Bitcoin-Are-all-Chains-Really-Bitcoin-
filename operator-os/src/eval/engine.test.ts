import { describe, it, expect } from "vitest";
import { scoreComponent, suiteHash } from "./engine";
import { loadSuite } from "./loadSuite";
import { DEFAULT_PROMPT } from "./components/vapi-dispatch-intent";
import { beats } from "../contracts/schemas/eval";
import { FakeLLMClient } from "../contracts/testing/index";

describe("eval engine (§3)", () => {
  it("scores the seed suite with all deterministic cases passing", async () => {
    const suite = await loadSuite("vapi-dispatch-intent");
    const r = await scoreComponent(suite, new FakeLLMClient(), { promptBody: DEFAULT_PROMPT, runJudge: false });
    expect(r.detTotal).toBeGreaterThanOrEqual(16);
    expect(r.detPassed).toBe(r.detTotal);
  });
  it("suiteHash is stable for the same suite", async () => {
    const suite = await loadSuite("vapi-dispatch-intent");
    expect(suiteHash(suite)).toBe(suiteHash(suite));
  });
  it("rational beats() is strict (ties do not promote)", () => {
    expect(beats({ passed: 18, total: 20 }, { passed: 17, total: 20 })).toBe(true);
    expect(beats({ passed: 18, total: 20 }, { passed: 18, total: 20 })).toBe(false);
    expect(beats({ passed: 9, total: 10 }, { passed: 18, total: 20 })).toBe(false);
  });
});
