import { NextRequest, NextResponse } from 'next/server';
import { GuidelineSearchService } from '@/services/guidelines/search-service';
import { 
  EnhancedSearchResult, 
  GuidelineSearchResultItem,
  Specialty,
  GuidelineSource 
} from '@/types/guidelines';

// Mark route as dynamic to allow request.url usage
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const categories = searchParams.get('categories')?.split(',') || ['guideline', 'patient', 'note'];
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'relevance';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const results: EnhancedSearchResult[] = [];
    const searchService = new GuidelineSearchService();

    // Search Guidelines
    if (categories.includes('guideline')) {
      try {
        // Try both semantic and text search
        const [semanticResults, textResults] = await Promise.all([
          searchService.semanticSearch(query, undefined, Math.ceil(limit / categories.length / 2)).catch(() => []),
          searchService.textSearch(query, undefined, Math.ceil(limit / categories.length / 2)).catch(() => [])
        ]);
        
        // Combine results, prioritizing semantic search
        const combinedResults = [...semanticResults, ...textResults];
        const seenIds = new Set();
        const uniqueResults = combinedResults.filter(result => {
          if (seenIds.has(result.id)) return false;
          seenIds.add(result.id);
          return true;
        });
        
        for (const result of uniqueResults.slice(0, Math.ceil(limit / categories.length))) {
          const guidelineItem: GuidelineSearchResultItem = {
            id: result.id,
            title: result.title,
            source: result.source,
            specialty: result.specialty,
            preview: result.content.substring(0, 150) + (result.content.length > 150 ? '...' : ''),
            relevanceScore: result.similarity,
            metadata: {
              publication_date: new Date().toISOString(),
              organization: getSourceDisplayName(result.source)
            },
            canApplyToPatient: true
          };

          results.push({
            type: 'guideline',
            guideline: guidelineItem
          });
        }
        

              } catch (error) {
          console.error('Error searching guidelines:', error);
        }
    }

    // Search Patients (Mock implementation)
    if (categories.includes('patient')) {
      try {
        // This would search patient records in a real implementation
        // For now, return mock patient results
        const mockPatientResults = generateMockPatientResults(query, Math.ceil(limit / categories.length));
        
        for (const patient of mockPatientResults) {
          results.push({
            type: 'patient',
            patient
          });
        }
      } catch (error) {
        console.error('Error searching patients:', error);
      }
    }

    // Search Notes (Mock implementation)
    if (categories.includes('note')) {
      try {
        // This would search clinical notes in a real implementation
        // For now, return mock note results
        const mockNoteResults = generateMockNoteResults(query, Math.ceil(limit / categories.length));
        
        for (const note of mockNoteResults) {
          results.push({
            type: 'note',
            note
          });
        }
      } catch (error) {
        console.error('Error searching notes:', error);
      }
    }

    // Sort results based on sortBy parameter
    const sortedResults = sortSearchResults(results, sortBy);

    // Group results by category for response
    const categorizedResults = {
      guidelines: sortedResults.filter(r => r.type === 'guideline').map(r => r.guideline),
      patients: sortedResults.filter(r => r.type === 'patient').map(r => r.patient),
      notes: sortedResults.filter(r => r.type === 'note').map(r => r.note),
      other: sortedResults.filter(r => r.type === 'other').map(r => r.other),
      totalResults: sortedResults.length,
      query,
      categories: categories,
      sortBy
    };

    return NextResponse.json(categorizedResults);
  } catch (error) {
    console.error('Enhanced search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform enhanced search' },
      { status: 500 }
    );
  }
}

// Helper function to get source display name
function getSourceDisplayName(source: GuidelineSource): string {
  const sourceMap: Record<GuidelineSource, string> = {
    'USPSTF': 'US Preventive Services Task Force',
    'NICE': 'National Institute for Health and Care Excellence',
    'NCI_PDQ': 'National Cancer Institute PDQ',
    'RxNorm': 'RxNorm Drug Database',
    'MANUAL': 'Manual Guidelines'
  };
  return sourceMap[source] || source;
}

// Mock function to generate patient search results
function generateMockPatientResults(query: string, limit: number) {
  const mockPatients = [
    {
      id: 1,
      name: 'John Smith',
      age: 45,
      mrn: 'MRN001',
      lastVisit: '2024-01-15',
      relevanceScore: 0.85,
      matchReason: `Patient name matches "${query}"`
    },
    {
      id: 2,
      name: 'Jane Doe',
      age: 32,
      mrn: 'MRN002',
      lastVisit: '2024-01-10',
      relevanceScore: 0.75,
      matchReason: `Medical history contains "${query}"`
    }
  ];

  return mockPatients
    .filter(patient => 
      patient.name.toLowerCase().includes(query.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, limit);
}

// Mock function to generate note search results
function generateMockNoteResults(query: string, limit: number) {
  const mockNotes = [
    {
      id: 1,
      title: 'Progress Note - Diabetes Management',
      content: `Patient presents with well-controlled diabetes. Current medications include metformin and insulin. Blood glucose levels have been stable. Discussed dietary modifications and exercise recommendations.`,
      patientName: 'John Smith',
      date: '2024-01-15',
      type: 'Progress Note',
      relevanceScore: 0.90,
      preview: 'Patient presents with well-controlled diabetes...'
    },
    {
      id: 2,
      title: 'Consultation Note - Cardiology',
      content: `Cardiology consultation for chest pain evaluation. EKG shows normal sinus rhythm. Stress test scheduled for next week. Patient advised to continue current medications.`,
      patientName: 'Jane Doe',
      date: '2024-01-12',
      type: 'Consultation',
      relevanceScore: 0.80,
      preview: 'Cardiology consultation for chest pain evaluation...'
    }
  ];

  return mockNotes
    .filter(note => 
      note.title.toLowerCase().includes(query.toLowerCase()) ||
      note.content.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, limit);
}

// Function to sort search results
function sortSearchResults(results: EnhancedSearchResult[], sortBy: string): EnhancedSearchResult[] {
  switch (sortBy) {
    case 'recency':
      return results.sort((a, b) => {
        const dateA = getResultDate(a);
        const dateB = getResultDate(b);
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    
    case 'authority':
      return results.sort((a, b) => {
        const authorityA = getResultAuthority(a);
        const authorityB = getResultAuthority(b);
        return authorityB - authorityA;
      });
    
    case 'alphabetical':
      return results.sort((a, b) => {
        const titleA = getResultTitle(a);
        const titleB = getResultTitle(b);
        return titleA.localeCompare(titleB);
      });
    
    case 'relevance':
    default:
      return results.sort((a, b) => {
        const scoreA = getResultRelevanceScore(a);
        const scoreB = getResultRelevanceScore(b);
        return scoreB - scoreA;
      });
  }
}

// Helper functions for sorting
function getResultDate(result: EnhancedSearchResult): string {
  if (result.type === 'guideline' && result.guideline) {
    return result.guideline.metadata.publication_date || new Date().toISOString();
  }
  if (result.type === 'patient' && result.patient) {
    return result.patient.lastVisit || new Date().toISOString();
  }
  if (result.type === 'note' && result.note) {
    return result.note.date || new Date().toISOString();
  }
  return new Date().toISOString();
}

function getResultAuthority(result: EnhancedSearchResult): number {
  if (result.type === 'guideline' && result.guideline) {
    const sourceOrder: Record<GuidelineSource, number> = {
      'USPSTF': 5,
      'NICE': 4,
      'NCI_PDQ': 3,
      'RxNorm': 2,
      'MANUAL': 1
    };
    return sourceOrder[result.guideline.source] || 0;
  }
  return 0;
}

function getResultTitle(result: EnhancedSearchResult): string {
  if (result.type === 'guideline' && result.guideline) {
    return result.guideline.title;
  }
  if (result.type === 'patient' && result.patient) {
    return result.patient.name;
  }
  if (result.type === 'note' && result.note) {
    return result.note.title;
  }
  return '';
}

function getResultRelevanceScore(result: EnhancedSearchResult): number {
  if (result.type === 'guideline' && result.guideline) {
    return result.guideline.relevanceScore;
  }
  if (result.type === 'patient' && result.patient) {
    return result.patient.relevanceScore;
  }
  if (result.type === 'note' && result.note) {
    return result.note.relevanceScore;
  }
  return 0;
} 