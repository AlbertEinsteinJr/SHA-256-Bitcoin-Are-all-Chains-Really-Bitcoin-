// Voyage embeddings (Anthropic has no embeddings endpoint). Falls back to a
// deterministic hash-embedding (same 1024 dims) so skill search works offline.
import type { EmbeddingsClient, CallContext } from "../../contracts/index";
import { ExternalServiceError } from "../../contracts/index";
import { env, hasVoyage } from "../env";
import { FakeEmbeddingsClient } from "../../contracts/testing/index";

const VOYAGE_MODEL = "voyage-3.5";
const DIM = 1024;

export class VoyageEmbeddingsClient implements EmbeddingsClient {
  readonly dimensions = DIM;
  constructor(private readonly apiKey: string) {}
  async embed(texts: string[], _ctx: CallContext): Promise<number[][]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, output_dimension: DIM }),
    });
    if (!res.ok) throw new ExternalServiceError(`voyage failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

export function createEmbeddings(): EmbeddingsClient {
  if (hasVoyage()) return new VoyageEmbeddingsClient(env().VOYAGE_API_KEY!);
  return new FakeEmbeddingsClient();
}
