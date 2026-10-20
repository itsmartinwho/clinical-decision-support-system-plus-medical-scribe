// Real-time Alert Generation API
// Processes transcript segments and generates alerts in real-time during consultations

import { NextRequest, NextResponse } from 'next/server';
import { alertEngine } from '@/lib/alerts/alert-engine';
import { realTimeProcessor } from '@/lib/alerts/real-time-processor';
import { UnifiedAlert } from '@/types/alerts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      patientId, 
      encounterId, 
      transcriptSegment, 
      fullTranscript,
      action = 'process' // 'process', 'start_session', 'end_session', 'update_transcript'
    } = body;

    // Validate required parameters
    if (!patientId || !encounterId) {
      return NextResponse.json(
        { error: 'Missing required parameters: patientId and encounterId' },
        { status: 400 }
      );
    }

    let result: any = {};

    switch (action) {
      case 'start_session':
        // Start real-time processing session
        realTimeProcessor.startSession(patientId, encounterId);
        result = { 
          message: 'Real-time processing session started',
          sessionKey: `${patientId}:${encounterId}`,
          stats: realTimeProcessor.getStats()
        };
        break;

      case 'end_session':
        // End real-time processing session
        realTimeProcessor.endSession(patientId, encounterId);
        result = { 
          message: 'Real-time processing session ended',
          stats: realTimeProcessor.getStats()
        };
        break;

      case 'update_transcript':
        // Update transcript for ongoing session
        if (!fullTranscript) {
          return NextResponse.json(
            { error: 'Missing fullTranscript for update action' },
            { status: 400 }
          );
        }
        
        realTimeProcessor.updateTranscript(patientId, encounterId, fullTranscript);
        result = { 
          message: 'Transcript updated',
          sessionInfo: realTimeProcessor.getSessionInfo(patientId, encounterId)
        };
        break;

      case 'process':
      default:
        // One pass, asked for by the client (useRealTimeAlerts) about every
        // 10 s. It needs nothing from an earlier request, so it works on
        // serverless functions, where the sessions above may not survive.
        if (!transcriptSegment) {
          return NextResponse.json(
            { error: 'Missing transcriptSegment for processing' },
            { status: 400 }
          );
        }

        const alerts = await alertEngine.processRealTimeAlerts(
          patientId,
          encounterId,
          transcriptSegment,
          fullTranscript
        );

        result = {
          success: true,
          alerts,
          alertCount: alerts.length,
          timestamp: new Date().toISOString()
        };
        break;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Real-time alert processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const encounterId = searchParams.get('encounterId');
    const action = searchParams.get('action') || 'status';

    if (!patientId || !encounterId) {
      return NextResponse.json(
        { error: 'Missing required parameters: patientId and encounterId' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'status':
        // Get session status
        const sessionInfo = realTimeProcessor.getSessionInfo(patientId, encounterId);
        const stats = realTimeProcessor.getStats();
        
        return NextResponse.json({
          sessionActive: !!sessionInfo,
          sessionInfo,
          processingStats: stats
        });

      case 'force_process':
        // Force process current session (for testing/manual triggers)
        try {
          const alerts = await realTimeProcessor.forceProcessSession(patientId, encounterId);
          return NextResponse.json({
            success: true,
            alerts,
            alertCount: alerts.length,
            message: 'Forced processing completed'
          });
        } catch (error) {
          return NextResponse.json(
            { 
              error: 'Session not found or processing failed',
              details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 404 }
          );
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Real-time alert API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 