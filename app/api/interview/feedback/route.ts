import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = Number(body?.sessionId);
    const targetId = typeof body?.targetId === 'string' ? body.targetId : null;
    const rating = body?.rating === 'up' || body?.rating === 'down' ? body.rating : null;

    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!targetId || !rating) {
      return NextResponse.json({ error: 'targetId and rating are required' }, { status: 400 });
    }

    // TODO: persist feedback to database once the feedback table is defined.
    console.info('[feedback] question', { sessionId, targetId, rating });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record interview feedback:', error);
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
  }
}
