import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Made on first request, so that building the app does not need the key.
let openai: OpenAI | null = null;
const getOpenAI = () => (openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Serves a chart the advisor's Code Interpreter saved. Charts are files in the
// container the code ran in (?container_id=...), which expires after 20 idle minutes.
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    const containerId = request.nextUrl.searchParams.get('container_id');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const fileResponse = containerId
      ? await getOpenAI().containers.files.content.retrieve(fileId, { container_id: containerId })
      : await getOpenAI().files.content(fileId);
    const fileContent = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get('content-type');

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType?.startsWith('image/') ? contentType : 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving assistant image:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
}
