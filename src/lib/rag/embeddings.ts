/**
 * Embeddings Module
 *
 * Supports two embedding providers:
 * - 'local': Free local model (all-MiniLM-L6-v2, 384 dimensions)
 * - 'voyage': Voyage AI (voyage-3-lite, 1024 dimensions) - Anthropic's partner
 *
 * Set EMBEDDING_PROVIDER=voyage and VOYAGE_API_KEY=... to use Voyage AI
 * Default is 'local' (free, no API key needed)
 */

type EmbeddingProvider = 'local' | 'voyage'

const PROVIDER: EmbeddingProvider =
  (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'local'

// Dimensions per provider
const DIMENSIONS: Record<EmbeddingProvider, number> = {
  local: 384,
  voyage: 1024,
}

export const EMBEDDING_DIMENSIONS = DIMENSIONS[PROVIDER]

// ============================================
// Local Embeddings (all-MiniLM-L6-v2)
// ============================================

let pipeline: typeof import('@xenova/transformers').pipeline | null = null
let embeddingPipeline: Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>> | null = null

const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2'

async function getLocalPipeline() {
  if (embeddingPipeline) return embeddingPipeline

  if (!pipeline) {
    const transformers = await import('@xenova/transformers')
    pipeline = transformers.pipeline
  }

  console.log('[Embeddings] Loading local model (first time may take a moment)...')
  embeddingPipeline = await pipeline('feature-extraction', LOCAL_MODEL, {
    quantized: true,
  })
  console.log('[Embeddings] Local model loaded')

  return embeddingPipeline
}

async function generateLocalEmbedding(text: string): Promise<number[]> {
  const extractor = await getLocalPipeline()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = await (extractor as any)(text, {
    pooling: 'mean',
    normalize: true,
  })
  return Array.from(output.data as Float32Array)
}

async function generateLocalEmbeddings(texts: string[]): Promise<number[][]> {
  const extractor = await getLocalPipeline()
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = await (extractor as any)(texts[i], {
      pooling: 'mean',
      normalize: true,
    })
    embeddings.push(Array.from(output.data as Float32Array))

    if (texts.length > 20 && (i + 1) % 10 === 0) {
      console.log(`[Embeddings] Processed ${i + 1}/${texts.length}`)
    }
  }

  return embeddings
}

// ============================================
// Voyage AI Embeddings
// ============================================

const VOYAGE_MODEL = 'voyage-3-lite'

async function generateVoyageEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY is not configured')
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: text,
      input_type: 'document',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage AI error: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

async function generateVoyageEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY is not configured')
  }

  // Voyage supports up to 128 texts per request
  const BATCH_SIZE = 50
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: batch,
        input_type: 'document',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Voyage AI error: ${error}`)
    }

    const data = await response.json()
    const sortedEmbeddings = data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((item: { embedding: number[] }) => item.embedding)

    allEmbeddings.push(...sortedEmbeddings)

    if (texts.length > 50) {
      console.log(`[Embeddings] Processed ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`)
    }
  }

  return allEmbeddings
}

// ============================================
// Unified API
// ============================================

/**
 * Generate embedding for a single text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (PROVIDER === 'voyage') {
    return generateVoyageEmbedding(text)
  }
  return generateLocalEmbedding(text)
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  console.log(`[Embeddings] Using ${PROVIDER} provider (${EMBEDDING_DIMENSIONS} dimensions)`)

  if (PROVIDER === 'voyage') {
    return generateVoyageEmbeddings(texts)
  }
  return generateLocalEmbeddings(texts)
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Get current provider info
 */
export function getProviderInfo() {
  return {
    provider: PROVIDER,
    dimensions: EMBEDDING_DIMENSIONS,
    model: PROVIDER === 'voyage' ? VOYAGE_MODEL : LOCAL_MODEL,
  }
}
