import { NextRequest } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

const INDEXNOW_KEY = 'df4cc1b543e52b6b71f0ef8f18fe4e80';
const SITE_URL = 'https://medicalguide.co.kr';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get articles published in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const snapshot = await db.collection('articles')
      .where('publishedAt', '>=', oneDayAgo)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return Response.json({ submitted: 0, message: 'No new articles' });
    }

    const urls: string[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      urls.push(`${SITE_URL}/${data.lang}/${data.category}/${data.slug}`);
    });

    // Submit to IndexNow (Bing endpoint, shared with Yandex/Naver)
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'medicalguide.co.kr',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });

    return Response.json({
      submitted: urls.length,
      status: response.status,
      message: response.status === 200 || response.status === 202 ? 'OK' : 'Submitted',
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
