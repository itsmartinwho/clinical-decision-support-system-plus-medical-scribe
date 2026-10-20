import { NextRequest, NextResponse } from 'next/server';
import { GuidelineSearchService } from '@/services/guidelines/search-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, specialty, matchCount = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Falls back to text search when the query cannot be embedded.
    const outcome = await new GuidelineSearchService().semanticSearchWithFallback(query, specialty, matchCount);

    return NextResponse.json({
      success: true,
      results: outcome.results,
      query,
      specialty,
      matchCount,
      ...(outcome.fallback ? { fallback: outcome.fallback, reason: outcome.reason } : {}),
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