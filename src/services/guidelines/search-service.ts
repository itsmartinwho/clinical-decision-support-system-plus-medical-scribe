import { getSupabaseClient } from '@/lib/supabaseClient';
import { EmbeddingService } from './embedding-service';
import { 
  GuidelineSearchResult, 
  GuidelineTextSearchResult, 
  GuidelineDoc,
  Specialty 
} from '@/types/guidelines';

export interface CombinedSearchResult {
  semanticResults: GuidelineSearchResult[];
  textResults: GuidelineTextSearchResult[];
  totalResults: number;
}

export class GuidelineSearchService {
  private embeddingServiceInstance: EmbeddingService | null = null;

  // Both are made on first use, so that building the app needs no keys.
  private get supabase() {
    return getSupabaseClient();
  }

  private get embeddingService(): EmbeddingService {
    return (this.embeddingServiceInstance ??= new EmbeddingService());
  }

  /**
   * Perform semantic search using embeddings
   */
  async semanticSearch(
    query: string,
    specialty?: Specialty,
    limit: number = 5
  ): Promise<GuidelineSearchResult[]> {
    return await this.embeddingService.searchSimilar(query, specialty, limit);
  }

  /**
   * Perform text-based search
   */
  async textSearch(
    query: string,
    specialty?: Specialty,
    limit: number = 10
  ): Promise<GuidelineTextSearchResult[]> {
    try {
      let rpcQuery = this.supabase.rpc('search_guidelines_text', {
        search_query: query,
        match_count: limit
      });

      const { data, error } = await rpcQuery;

      if (error) {
        throw new Error(`Text search failed: ${error.message}`);
      }

      let results = data || [];

      // Filter by specialty if specified
      if (specialty && specialty !== 'All') {
        results = results.filter((result: GuidelineTextSearchResult) => 
          result.specialty === specialty
        );
      }

      return results;
    } catch (error) {
      console.error('Text search error:', error);
      throw error;
    }
  }

  /**
   * Combined search that returns both semantic and text results
   */
  async combinedSearch(
    query: string,
    specialty?: Specialty,
    semanticLimit: number = 3,
    textLimit: number = 5
  ): Promise<CombinedSearchResult> {
    try {
      const [semanticResults, textResults] = await Promise.all([
        this.semanticSearch(query, specialty, semanticLimit),
        this.textSearch(query, specialty, textLimit)
      ]);

      return {
        semanticResults,
        textResults,
        totalResults: semanticResults.length + textResults.length
      };
    } catch (error) {
      console.error('Combined search error:', error);
      return {
        semanticResults: [],
        textResults: [],
        totalResults: 0
      };
    }
  }

  /**
   * Get all guidelines by specialty
   */
  async getGuidelinesBySpecialty(
    specialty: Specialty,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ guidelines: GuidelineDoc[]; total: number }> {
    try {
      let query = this.supabase
        .from('guidelines_docs')
        .select('*', { count: 'exact' })
        .order('last_updated', { ascending: false })
        .range(offset, offset + limit - 1);

      if (specialty !== 'All') {
        query = query.eq('specialty', specialty);
      }

      const { data: guidelines, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch guidelines: ${error.message}`);
      }

      return {
        guidelines: guidelines || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error fetching guidelines by specialty:', error);
      throw error;
    }
  }

  /**
   * Get a specific guideline by ID
   */
  async getGuidelineById(id: number): Promise<GuidelineDoc | null> {
    try {
      const { data, error } = await this.supabase
        .from('guidelines_docs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch guideline: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error fetching guideline by ID:', error);
      return null;
    }
  }

  /**
   * Get guidelines statistics
   */
  async getStatistics(): Promise<{
    totalGuidelines: number;
    bySpecialty: Record<string, number>;
    bySource: Record<string, number>;
    lastUpdated: string | null;
  }> {
    try {
      const { data: guidelines, error } = await this.supabase
        .from('guidelines_docs')
        .select('specialty, source, last_updated');

      if (error) {
        throw new Error(`Failed to fetch statistics: ${error.message}`);
      }

      const bySpecialty: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      let lastUpdated: string | null = null;

      guidelines?.forEach(guideline => {
        // Count by specialty
        bySpecialty[guideline.specialty] = (bySpecialty[guideline.specialty] || 0) + 1;
        
        // Count by source
        bySource[guideline.source] = (bySource[guideline.source] || 0) + 1;
        
        // Track most recent update
        if (!lastUpdated || guideline.last_updated > lastUpdated) {
          lastUpdated = guideline.last_updated;
        }
      });

      return {
        totalGuidelines: guidelines?.length || 0,
        bySpecialty,
        bySource,
        lastUpdated
      };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error;
    }
  }

  /**
   * Get recent guidelines
   */
  async getRecentGuidelines(limit: number = 10): Promise<GuidelineDoc[]> {
    try {
      const { data, error } = await this.supabase
        .from('guidelines_docs')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch recent guidelines: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching recent guidelines:', error);
      return [];
    }
  }
}

// Convenience function for direct import
const searchService = new GuidelineSearchService();

export async function searchGuidelines(params: {
  query: string;
  specialty?: Specialty;
  limit?: number;
  searchType?: 'semantic' | 'text' | 'combined';
}): Promise<GuidelineSearchResult[]> {
  const { query, specialty, limit = 5, searchType = 'semantic' } = params;
  
  if (searchType === 'semantic') {
    return await searchService.semanticSearch(query, specialty, limit);
  } else if (searchType === 'text') {
    const textResults = await searchService.textSearch(query, specialty, limit);
    // Convert text results to search results format
    return textResults.map(result => ({
      id: result.id,
      content: result.content,
      metadata: {
        title: result.title,
        source: result.source,
        specialty: result.specialty,
      },
      similarity: result.similarity
    }));
  } else { // combined
    const combined = await searchService.combinedSearch(query, specialty, Math.ceil(limit / 2), Math.ceil(limit / 2));
    // Merge and deduplicate results
    const allResults = [...combined.semanticResults];
    
    // Add text results that aren't already in semantic results
    const semanticIds = new Set(combined.semanticResults.map(r => r.id));
    const additionalTextResults = combined.textResults
      .filter(result => !semanticIds.has(result.id))
      .map(result => ({
        id: result.id,
        content: result.content,
        metadata: {
          title: result.title,
          source: result.source,
          specialty: result.specialty,
        },
        similarity: result.similarity
      }));
    
    return [...allResults, ...additionalTextResults].slice(0, limit);
  }
}