import { NextRequest, NextResponse } from 'next/server';
import { GuidelineSearchService } from '@/services/guidelines/search-service';
import { Specialty } from '@/types/guidelines';

// Mark route as dynamic to allow request.url usage
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const specialty = searchParams.get('specialty') as Specialty | null;
    const searchType = searchParams.get('type') || 'combined'; // 'semantic', 'text', or 'combined'
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const searchService = new GuidelineSearchService();

    switch (searchType) {
      case 'semantic':
        const semanticResults = await searchService.semanticSearch(
          query,
          specialty || undefined,
          limit
        );
        return NextResponse.json({ results: semanticResults, type: 'semantic' });

      case 'text':
        const textResults = await searchService.textSearch(
          query,
          specialty || undefined,
          limit
        );
        return NextResponse.json({ results: textResults, type: 'text' });

      case 'combined':
      default:
        const combinedResults = await searchService.combinedSearch(
          query,
          specialty || undefined,
          Math.ceil(limit / 2),
          Math.ceil(limit / 2)
        );
        return NextResponse.json({ 
          results: combinedResults, 
          type: 'combined',
          totalResults: combinedResults.totalResults
        });
    }
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search guidelines' },
      { status: 500 }
    );
  }
} 