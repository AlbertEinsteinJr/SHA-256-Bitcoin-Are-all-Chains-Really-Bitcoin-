// Seed the live flywheel with realistic data and run the predictor, so the
// owner dashboard and eval/loop/audit are genuinely populated on day 1.
import { createClient } from "@supabase/supabase-js";
import { predictBreakdown } from "../src/flywheel/predict";

// Load .env.local for CLI/script runs (Next loads it automatically for the app).
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* ignore */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("seed requires NEXT_PUBLIC_SUPABASE_URL and a key");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const REGIONS = ["TX-DAL", "TX-HOU", "OK-OKC", "AR-LIT", "LA-NOL"];
const MAKES = ["Freightliner", "Peterbilt", "Kenworth", "Volvo", "Mack"];
const COMPONENTS = ["brakes", "tires", "cooling", "electrical", "transmission"];
const rand = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;
const ri = (n: number) => Math.floor(Math.random() * n);

async function main() {
  console.log("seeding fleets + assets…");
  const fleets = [];
  for (const name of ["Lone Star Logistics", "Gulf Coast Freight", "Red River Haul", "Sooner Transit"]) {
    const { data } = await sb.from("fleets").insert({ name, region: rand(REGIONS), sla_tier: rand(["standard", "premium"]) }).select().single();
    if (data) fleets.push(data);
  }
  const assets = [];
  for (let i = 0; i < 40; i++) {
    const f = rand(fleets);
    const { data } = await sb.from("assets").insert({
      fleet_id: f.id, asset_type: rand(["truck", "trailer"]), make: rand(MAKES),
      model: `M${300 + ri(500)}`, year: 2016 + ri(9), unit_no: `U${1000 + i}`,
      region: f.region, mileage: 80000 + ri(600000),
    }).select().single();
    if (data) assets.push(data);
  }

  console.log("seeding breakdowns + dispatches…");
  for (let i = 0; i < 220; i++) {
    const a = rand(assets);
    const { data: b } = await sb.from("breakdowns").insert({
      asset_id: a.id, fleet_id: a.fleet_id, truck_make: a.make, truck_model: a.model,
      symptom: rand(["flat tire", "won't start", "overheating", "brake failure", "out of fuel"]),
      component: rand(COMPONENTS), severity: rand(["low", "medium", "high", "critical"]),
      region: a.region, source: rand(["dispatch", "directory", "inspection"]),
    }).select().single();
    if (!b) continue;
    const response = 20 + ri(160);
    const target = 90;
    await sb.from("dispatches").insert({
      breakdown_id: b.id, mechanic_id: `tech-${ri(12)}`, status: rand(["resolved", "billed", "resolved"]),
      response_min: response, repair_min: 30 + ri(120), price_cents: 15000 + ri(60000),
      rating: 3 + ri(3), outcome: "resolved", region: a.region, sla_target_min: target, sla_met: response <= target,
    });
  }

  console.log("seeding inspections + defects, running predictor…");
  for (const a of assets) {
    if (Math.random() > 0.6) continue;
    const { data: insp } = await sb.from("inspections").insert({
      fleet_id: a.fleet_id, asset_id: a.id, truck_make: a.make, truck_model: a.model, mileage: a.mileage, inspector: `insp-${ri(5)}`,
    }).select().single();
    if (!insp) continue;
    const defects = Array.from({ length: 1 + ri(3) }, () => ({ component: rand(COMPONENTS), severity: rand(["low", "medium", "high", "critical"]) as "low" | "medium" | "high" | "critical" }));
    for (const d of defects) {
      await sb.from("inspection_defects").insert({ inspection_id: insp.id, asset_id: a.id, component: d.component, severity: d.severity });
    }
    const p = predictBreakdown({ make: a.make, model: a.model, mileage: a.mileage, defects });
    await sb.from("predicted_breakdowns").insert({
      asset_id: a.id, component: p.component, probability: p.probability, model_version: "predict-v1",
      window_start: new Date().toISOString(),
      window_end: new Date(Date.now() + p.windowDays * 864e5).toISOString(),
    });
  }

  console.log("seeding directory conversions…");
  for (let i = 0; i < 120; i++) {
    await sb.from("directory_conversions").insert({
      page_slug: rand(["dallas-truck-repair", "houston-roadside", "okc-tire-service", "diesel-mechanic-near-me"]),
      query: rand(["truck tire blowout", "semi won't start", "mobile diesel repair"]),
      channel: rand(["rankradar", "shopbid", "quotedrop"]), converted: Math.random() > 0.7,
    });
  }
  console.log("seed complete.");
}
main().catch((e) => { console.error(e); process.exit(1); });
