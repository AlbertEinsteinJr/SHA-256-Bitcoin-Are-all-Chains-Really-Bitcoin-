// THE composition root — the only place concrete clients are constructed.
// Everything else receives ports via DI.
import type {
  LLMClient,
  EmbeddingsClient,
  Logger,
  AuditSink,
  KillSwitch,
  CapsEnforcer,
  SafetyKernel,
  DbClient,
} from "../contracts/index";
import { env, hasSupabase } from "../core/env";
import { ConsoleLogger } from "../core/infra/logger";
import { createSupabaseDb } from "../core/infra/db";
import { createLLM } from "../core/infra/llm";
import { createEmbeddings } from "../core/infra/embeddings";
import { DbAuditSink } from "../core/infra/audit";
import { DbCapsEnforcer } from "../core/caps";
import { DbKillSwitch } from "../core/kill";
import { DefaultSafetyKernel } from "../core/safety";
import { RecordingAuditSink, FakeCapsEnforcer, FakeKillSwitch } from "../contracts/testing/index";

export interface Container {
  logger: Logger;
  db: DbClient | null;
  llm: LLMClient;
  embeddings: EmbeddingsClient;
  audit: AuditSink;
  caps: CapsEnforcer;
  kill: KillSwitch;
  safety: SafetyKernel;
  online: boolean;
}

let singleton: Container | null = null;

export function buildContainer(): Container {
  if (singleton) return singleton;
  const logger = new ConsoleLogger({ app: "operator-os" });
  const online = hasSupabase();

  let db: DbClient | null = null;
  let audit: AuditSink;
  let caps: CapsEnforcer;
  let kill: KillSwitch;

  if (online) {
    db = createSupabaseDb(true);
    audit = new DbAuditSink(db);
    caps = new DbCapsEnforcer(db, env().LOOP_RATE_PER_MIN);
    kill = new DbKillSwitch(db, audit);
  } else {
    audit = new RecordingAuditSink();
    caps = new FakeCapsEnforcer();
    kill = new FakeKillSwitch();
  }

  const safety = new DefaultSafetyKernel(audit, env().OPERATOR_TZ);
  singleton = {
    logger,
    db,
    llm: createLLM(),
    embeddings: createEmbeddings(),
    audit,
    caps,
    kill,
    safety,
    online,
  };
  return singleton;
}
