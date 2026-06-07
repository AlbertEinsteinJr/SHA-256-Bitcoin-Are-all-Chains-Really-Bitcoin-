// Breakdown/Repair Graph — the moat. The ONLY write path into the spine, so
// every dispatch / inspection / conversion lands here (validated).
import type { DbClient } from "../contracts/index";
import {
  BreakdownInsert,
  DispatchInsert,
  InspectionInsert,
  DirectoryConversionInsert,
} from "../contracts/schemas/skills";
import { validate } from "../core/reliability";

export class FlywheelGraph {
  constructor(private readonly db: DbClient) {}

  async recordBreakdown(input: unknown): Promise<{ id: string }> {
    const b = validate(BreakdownInsert, input);
    return this.db.insert("breakdowns", {
      location_geo: b.locationGeo ?? null,
      truck_make: b.truckMake ?? null,
      truck_model: b.truckModel ?? null,
      symptom: b.symptom,
      component: b.component ?? null,
      severity: b.severity,
      region: b.region ?? null,
      source: b.source,
      correlation_id: b.correlationId ?? null,
    });
  }

  async recordDispatch(input: unknown): Promise<{ id: string }> {
    const d = validate(DispatchInsert, input);
    const slaMet =
      d.responseMin != null && d.slaTargetMin != null ? d.responseMin <= d.slaTargetMin : null;
    return this.db.insert("dispatches", {
      breakdown_id: d.breakdownId,
      mechanic_id: d.mechanicId ?? null,
      response_min: d.responseMin ?? null,
      repair_min: d.repairMin ?? null,
      parts_used: d.partsUsed ?? null,
      price_cents: d.priceCents ?? null,
      rating: d.rating ?? null,
      outcome: d.outcome ?? null,
      region: d.region ?? null,
      sla_target_min: d.slaTargetMin ?? null,
      sla_met: slaMet,
    });
  }

  async recordInspection(input: unknown): Promise<{ id: string }> {
    const i = validate(InspectionInsert, input);
    return this.db.insert("inspections", {
      fleet_id: i.fleetId ?? null,
      asset_id: i.assetId ?? null,
      truck_make: i.truckMake ?? null,
      truck_model: i.truckModel ?? null,
      mileage: i.mileage ?? null,
      inspector: i.inspector ?? null,
      defects: i.defects,
    });
  }

  async recordDirectoryConversion(input: unknown): Promise<{ id: string }> {
    const c = validate(DirectoryConversionInsert, input);
    return this.db.insert("directory_conversions", {
      page_slug: c.pageSlug,
      query: c.query ?? null,
      location_geo: c.locationGeo ?? null,
      channel: c.channel ?? null,
      converted: c.converted,
    });
  }
}
