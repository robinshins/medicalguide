import { NextRequest } from 'next/server';
import { publishArticle, initializeKeywordQueue } from '@/lib/publish';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Manual publish trigger (for testing)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (authHeader !== `Bearer ${apiKey}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (body.action === 'init') {
    const count = await initializeKeywordQueue();
    return Response.json({ success: true, initialized: count });
  }

  const result = await publishArticle();
  return Response.json(result);
}
