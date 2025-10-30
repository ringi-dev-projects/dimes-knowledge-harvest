import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  knowledgeAtoms,
  qaTurns,
  coverageScores,
  exportJobs,
  interviewSessions,
  topicTrees,
  companies,
} from '@/lib/db/schema';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(_request: NextRequest) {
  try {
    db.transaction((tx) => {
      tx.delete(knowledgeAtoms);
      tx.delete(qaTurns);
      tx.delete(coverageScores);
      tx.delete(exportJobs);
      tx.delete(interviewSessions);
      tx.delete(topicTrees);
      tx.delete(companies);
    });

    const audioDir = path.join(process.cwd(), 'data', 'interviews');
    await fs.rm(audioDir, { recursive: true, force: true });
    await fs.mkdir(audioDir, { recursive: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reset data:', error);
    return NextResponse.json(
      { error: 'Failed to reset data' },
      { status: 500 }
    );
  }
}
