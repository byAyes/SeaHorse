import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { authenticate } from '../../../../lib/auth/middleware';

/**
 * GET /api/profile/history
 * Get profile change history for a user
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const changes = await prisma.profileChangeLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const history = changes.map((change) => ({
      id: change.id,
      changeType: change.changeType,
      timestamp: change.createdAt,
      source: change.source,
      changes: {
        previous: change.previousValue ? JSON.parse(change.previousValue) : null,
        current: JSON.parse(change.newValue),
      },
      cvId: change.cvId,
    }));

    return NextResponse.json({
      history,
      total: history.length,
    });
  } catch (error) {
    console.error('Error fetching profile history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile history' },
      { status: 500 },
    );
  }
}
