import { NextRequest, NextResponse } from 'next/server';
import { resolveDocument } from '../documentService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const useMock = searchParams.get('mock') === 'true';
    const companyId = parseInt(id, 10);

    if (!useMock && Number.isNaN(companyId)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    const document = await resolveDocument({
      companyId: Number.isNaN(companyId) ? -1 : companyId,
      useMock,
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
