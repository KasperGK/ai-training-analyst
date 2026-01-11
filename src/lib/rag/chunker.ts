/**
 * Text Chunker
 *
 * Splits text content into smaller chunks suitable for embedding.
 * Uses semantic boundaries (paragraphs, sections) when possible.
 */

export interface Chunk {
  index: number
  content: string
  metadata?: Record<string, unknown>
}

interface ChunkerOptions {
  /** Maximum characters per chunk (default: 1000) */
  maxChunkSize?: number
  /** Overlap between chunks in characters (default: 100) */
  overlap?: number
  /** Minimum chunk size - don't create tiny chunks (default: 100) */
  minChunkSize?: number
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  maxChunkSize: 1000,
  overlap: 100,
  minChunkSize: 100,
}

/**
 * Split text into chunks by paragraphs/sections first, then by size
 */
export function chunkText(text: string, options: ChunkerOptions = {}): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chunks: Chunk[] = []

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, '\n').trim()

  // Split by markdown headers first (## and ###)
  const sections = splitBySections(normalizedText)

  let chunkIndex = 0

  for (const section of sections) {
    // If section is small enough, keep it as one chunk
    if (section.length <= opts.maxChunkSize) {
      if (section.length >= opts.minChunkSize) {
        chunks.push({
          index: chunkIndex++,
          content: section.trim(),
        })
      }
      continue
    }

    // Section is too big - split by paragraphs
    const paragraphs = section.split(/\n\n+/)
    let currentChunk = ''

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim()
      if (!trimmedParagraph) continue

      // If adding this paragraph exceeds max size, save current chunk
      if (currentChunk && (currentChunk.length + trimmedParagraph.length + 2) > opts.maxChunkSize) {
        chunks.push({
          index: chunkIndex++,
          content: currentChunk.trim(),
        })

        // Start new chunk with overlap from end of previous
        const overlapText = getOverlapText(currentChunk, opts.overlap)
        currentChunk = overlapText ? overlapText + '\n\n' + trimmedParagraph : trimmedParagraph
      } else {
        // Add paragraph to current chunk
        currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedParagraph : trimmedParagraph
      }
    }

    // Don't forget the last chunk
    if (currentChunk.length >= opts.minChunkSize) {
      chunks.push({
        index: chunkIndex++,
        content: currentChunk.trim(),
      })
    }
  }

  return chunks
}

/**
 * Split text by markdown section headers
 */
function splitBySections(text: string): string[] {
  // Split on ## headers but keep the header with its content
  const sections: string[] = []
  const lines = text.split('\n')
  let currentSection = ''

  for (const line of lines) {
    // Check if this is a header (## or ###)
    if (/^#{2,3}\s/.test(line) && currentSection.trim()) {
      sections.push(currentSection)
      currentSection = line
    } else {
      currentSection = currentSection ? currentSection + '\n' + line : line
    }
  }

  // Don't forget the last section
  if (currentSection.trim()) {
    sections.push(currentSection)
  }

  return sections
}

/**
 * Get the last N characters for overlap, breaking at word boundary
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) return text

  const lastPart = text.slice(-overlapSize)
  // Try to break at a word boundary
  const firstSpace = lastPart.indexOf(' ')
  if (firstSpace > 0 && firstSpace < overlapSize / 2) {
    return lastPart.slice(firstSpace + 1)
  }
  return lastPart
}

/**
 * Chunk a wiki article with its title prepended to each chunk
 */
export function chunkWikiArticle(
  title: string,
  content: string,
  options: ChunkerOptions = {}
): Chunk[] {
  const chunks = chunkText(content, options)

  // Prepend title context to each chunk for better retrieval
  return chunks.map((chunk) => ({
    ...chunk,
    content: `# ${title}\n\n${chunk.content}`,
  }))
}
