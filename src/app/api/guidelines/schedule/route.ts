import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/services/guidelines/scheduler';
import { GuidelineSource } from '@/types/guidelines';
import { requireAdminSecret } from '@/lib/adminAuth';

// Both handlers use the scheduler, which reads and writes the refresh log and
// the guidelines with the service role (it bypasses RLS), so they take the
// server-side admin secret.

export async function GET(request: NextRequest) {
  const refused = requireAdminSecret(request);
  if (refused) return refused;

  try {
    const scheduler = getScheduler();
    const status = await scheduler.getScheduleStatus();
    
    return NextResponse.json({
      success: true,
      schedule: {
        nextRun: status.nextRun.toISOString(),
        lastRun: status.lastRun?.toISOString(),
        isDue: status.isDue,
        isRunning: status.isRunning,
        type: 'monthly'
      }
    });
  } catch (error) {
    console.error('Error getting schedule status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get schedule status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const refused = requireAdminSecret(request);
  if (refused) return refused;

  try {
    const body = await request.json();
    const { action, sources } = body;
    
    const scheduler = getScheduler();
    
    switch (action) {
      case 'setup':
        await scheduler.setupMonthlyRefresh();
        return NextResponse.json({
          success: true,
          message: 'Monthly refresh schedule configured'
        });
        
      case 'trigger':
        // Validate sources if provided
        const validSources = sources as GuidelineSource[] | undefined;
        if (validSources) {
          const allowedSources: GuidelineSource[] = ['USPSTF', 'NICE', 'NCI_PDQ', 'RxNorm'];
          const invalidSources = validSources.filter(s => !allowedSources.includes(s));
          if (invalidSources.length > 0) {
            return NextResponse.json(
              { success: false, error: `Invalid sources: ${invalidSources.join(', ')}` },
              { status: 400 }
            );
          }
        }
        
        // Trigger manual refresh (async)
        scheduler.triggerManualRefresh(validSources)
          .catch(error => console.error('Manual refresh failed:', error));
        
        return NextResponse.json({
          success: true,
          message: 'Manual refresh triggered'
        });
        
      case 'status':
        const status = await scheduler.getScheduleStatus();
        return NextResponse.json({
          success: true,
          schedule: {
            nextRun: status.nextRun.toISOString(),
            lastRun: status.lastRun?.toISOString(),
            isDue: status.isDue,
            isRunning: status.isRunning
          }
        });
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: setup, trigger, or status' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in schedule API:', error);
    return NextResponse.json(
      { success: false, error: 'Schedule operation failed' },
      { status: 500 }
    );
  }
} 