import { NextRequest } from 'next/server';
import { publishArticle } from '@/lib/publish';

export const maxDuration = 300; // 5 minutes for Vercel Pro
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Cron] Triggered at ${new Date().toISOString()}`);

  const result = await publishArticle();

  return Response.json(result);
}
