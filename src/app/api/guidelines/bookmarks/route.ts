import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import { GuidelineBookmark } from '@/types/guidelines';

// GET - Fetch user's bookmarks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // For now, return empty array as we haven't created the bookmarks table yet
    // TODO: Implement actual database query once bookmarks table is created
    const mockBookmarks: GuidelineBookmark[] = [];

    return NextResponse.json(mockBookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}

// POST - Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guidelineId, userId, metadata } = body;

    if (!guidelineId || !userId) {
      return NextResponse.json(
        { error: 'guidelineId and userId are required' },
        { status: 400 }
      );
    }

    // Validate that the guideline exists
    const { data: guideline, error: guidelineError } = await getSupabaseServiceClient()
      .from('guidelines_docs')
      .select('id')
      .eq('id', guidelineId)
      .single();

    if (guidelineError || !guideline) {
      return NextResponse.json(
        { error: 'Guideline not found' },
        { status: 404 }
      );
    }

    // For now, return a mock bookmark
    // TODO: Implement actual database insert once bookmarks table is created
    const newBookmark: GuidelineBookmark = {
      id: Math.floor(Math.random() * 10000), // Mock ID
      guidelineId,
      userId,
      createdAt: new Date().toISOString(),
      metadata: metadata || {}
    };

    return NextResponse.json(newBookmark, { status: 201 });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to add bookmark' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a bookmark
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guidelineId = searchParams.get('guidelineId');
    const userId = searchParams.get('userId');

    if (!guidelineId || !userId) {
      return NextResponse.json(
        { error: 'guidelineId and userId are required' },
        { status: 400 }
      );
    }

    // For now, just return success
    // TODO: Implement actual database delete once bookmarks table is created

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
} 