import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingService } from '@/services/guidelines/embedding-service';
import { openAIKeyMissingResponse } from '@/lib/serverGuards';

export async function POST(request: NextRequest) {
  const noKey = openAIKeyMissingResponse();
  if (noKey) return noKey;
  try {
    const body = await request.json();
    const { query, specialty, matchCount = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Create embedding service (this will run on server side)
    const embeddingService = new EmbeddingService();
    
    // Perform similarity search
    const results = await embeddingService.searchSimilar(query, specialty, matchCount);
    
    return NextResponse.json({ 
      success: true,
      results,
      query,
      specialty,
      matchCount 
    });
  } catch (error) {
    console.error('Semantic search API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform semantic search' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to perform semantic search',
    parameters: {
      query: 'string (required) - Search query text',
      specialty: 'string (optional) - Medical specialty filter',
      matchCount: 'number (optional) - Number of results to return (default: 5)'
    }
  });
} 