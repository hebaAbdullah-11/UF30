import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const DIMENSIONS = 384;
let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

async function extractor() {
  extractorPromise ??= pipeline("feature-extraction", MODEL, { dtype: "q8" });
  return extractorPromise;
}

export async function createMultilingualEmbedding(text: string): Promise<number[]> {
  const output = await (await extractor())(text, { pooling: "mean", normalize: true });
  const values = output.tolist();
  const vector = Array.isArray(values[0]) ? values[0] : values;
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS || vector.some((value) => typeof value !== "number")) {
    throw new Error(`Embedding model returned an invalid vector; expected ${DIMENSIONS} dimensions.`);
  }
  return vector as number[];
}