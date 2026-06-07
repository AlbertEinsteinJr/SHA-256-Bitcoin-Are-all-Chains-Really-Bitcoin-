"use client";
import { useState } from "react";

export function ControlPanel({ halted }: { halted: boolean }) {
  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setOut("running…");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      setOut(JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button disabled={busy} onClick={() => call("/api/eval")}>
          ▶ Run eval
        </button>
        <button disabled={busy} onClick={() => call("/api/loop")}>
          ⟳ Run loop iteration
        </button>
        <button className="kill" disabled={busy} onClick={() => call("/api/kill", { action: "trip", reason: "dashboard" })}>
          ⏻ KILL
        </button>
        {halted && (
          <button disabled={busy} onClick={() => call("/api/kill", { action: "reset", token: prompt("APPROVED-kill.reset-YYYYMMDD") ?? "" })}>
            reset (token)
          </button>
        )}
      </div>
      {out && <pre>{out}</pre>}
    </div>
  );
}
