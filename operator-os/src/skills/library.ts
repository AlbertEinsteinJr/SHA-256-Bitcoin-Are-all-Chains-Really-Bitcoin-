// Skill library (Voyager). Admission ONLY after verified + passing eval.
// Lineage via parent_id; never delete (archive). pgvector search via match_skills.
import type { DbClient, EmbeddingsClient, CallContext, Skill, SkillSearchHit } from "../contracts/index";
import { Skill as SkillSchema, SkillSearchHit as HitSchema } from "../contracts/schemas/skills";
import { validate } from "../core/reliability";
import { ConstitutionViolation } from "../contracts/index";
import { ctx as mkctx } from "../contracts/schemas/common";

export class SkillLibrary {
  constructor(
    private readonly db: DbClient,
    private readonly embeddings: EmbeddingsClient,
  ) {}

  /** Admit a skill — refuses unless verified === true AND eval_score present. */
  async addSkill(skill: Skill, context: CallContext = mkctx({ actor: "agent" })): Promise<Skill> {
    const s = validate(SkillSchema, skill);
    if (!s.verified || s.evalScore == null) {
      throw new ConstitutionViolation(
        "skill admission requires verified=true AND eval_score present (CLAUDE.md §3)",
        { name: s.name },
      );
    }
    const [embedding] = await this.embeddings.embed([`${s.name}: ${s.description}\n${s.body}`], context);
    const row = await this.db.insert<Skill>("skills", {
      name: s.name,
      version: s.version,
      parent_id: s.parentId ?? null,
      description: s.description,
      body: s.body,
      language: s.language,
      embedding,
      verified: true,
      eval_score: s.evalScore,
      admit_eval_id: s.admitEvalId ?? null,
      archived: false,
    });
    return row;
  }

  async searchSkills(query: string, k = 5, context: CallContext = mkctx({ actor: "agent" })): Promise<SkillSearchHit[]> {
    const [embedding] = await this.embeddings.embed([query], context);
    const hits = await this.db.rpc<SkillSearchHit[]>("match_skills", { query_embedding: embedding, match_count: k });
    return (hits ?? []).map((h) => validate(HitSchema, h));
  }

  async archiveSkill(id: string): Promise<void> {
    const raw = (this.db as { raw?: () => { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Promise<unknown> } } } }).raw;
    if (raw) await raw().from("skills").update({ archived: true }).eq("id", id);
  }

  /** Promote = new row, version+1, parent_id set, parent archived (never overwrite). */
  async promoteSkill(parent: Skill, improvedBody: string, evalScore: number, admitEvalId: string): Promise<Skill> {
    const next: Skill = {
      ...parent,
      id: undefined,
      version: (parent.version ?? 1) + 1,
      parentId: parent.id,
      body: improvedBody,
      verified: true,
      evalScore,
      admitEvalId,
      archived: false,
    };
    const created = await this.addSkill(next);
    if (parent.id) await this.archiveSkill(parent.id);
    return created;
  }
}
