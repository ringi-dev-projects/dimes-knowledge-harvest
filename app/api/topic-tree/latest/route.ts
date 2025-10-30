import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { topicTrees } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const companyIdParam = request.nextUrl.searchParams.get('companyId');

    if (!companyIdParam) {
      return NextResponse.json(
        { error: 'companyId query parameter is required' },
        { status: 400 }
      );
    }

    const companyId = Number(companyIdParam);
    if (Number.isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId must be a number' },
        { status: 400 }
      );
    }

    const [latestTopicTree] = await db
      .select()
      .from(topicTrees)
      .where(eq(topicTrees.companyId, companyId))
      .orderBy(desc(topicTrees.createdAt))
      .limit(1);

    if (!latestTopicTree) {
      return NextResponse.json(
        { success: true, topicTree: null },
        { status: 200 }
      );
    }

    let topicTree = null;
    try {
      topicTree = JSON.parse(latestTopicTree.topicData);
    } catch (error) {
      console.warn('Failed to parse topic tree JSON for company', companyId, error);
    }

    return NextResponse.json({
      success: true,
      topicTree,
      topicTreeId: latestTopicTree.id,
    });
  } catch (error) {
    console.error('Failed to load topic tree:', error);
    return NextResponse.json(
      { error: 'Failed to load topic tree' },
      { status: 500 }
    );
  }
}
