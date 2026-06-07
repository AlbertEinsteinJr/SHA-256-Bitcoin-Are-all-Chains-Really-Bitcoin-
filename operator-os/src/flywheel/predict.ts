// Inspection → breakdown-likelihood predictor. The link from inspection defects
// to future dispatch demand (the slow compounding loop). Heuristic baseline now;
// TODO: train on (inspection_defects, mileage) → actual breakdowns once seeded.
export interface DefectInput {
  component: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface PredictionInput {
  make?: string;
  model?: string;
  mileage?: number;
  defects: DefectInput[];
}

const SEVERITY_WEIGHT: Record<string, number> = { low: 0.05, medium: 0.15, high: 0.35, critical: 0.6 };

/** Returns breakdown likelihood in [0,1] and the dominant component. */
export function predictBreakdown(input: PredictionInput): { probability: number; component: string; windowDays: number } {
  let p = 0;
  let topComponent = "unknown";
  let topW = 0;
  for (const d of input.defects) {
    const w = SEVERITY_WEIGHT[d.severity] ?? 0.1;
    p += w * (1 - p); // diminishing combination
    if (w > topW) {
      topW = w;
      topComponent = d.component;
    }
  }
  // Mileage pressure: every 100k miles adds risk (capped).
  const mileageFactor = Math.min(0.25, (input.mileage ?? 0) / 100_000 * 0.1);
  p = Math.min(0.99, p + mileageFactor * (1 - p));
  const windowDays = p > 0.5 ? 14 : p > 0.25 ? 30 : 60;
  return { probability: Number(p.toFixed(3)), component: topComponent, windowDays };
}
