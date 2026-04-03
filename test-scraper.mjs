import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('tsx/esm', pathToFileURL('./'));

const { searchNaverPlaces, getNaverPlaceInfo, searchKakaoMap } = await import('./src/lib/scraper.ts');

console.log('[Test] Searching Naver for "서울 임플란트 치과"...');
const results = await searchNaverPlaces('서울 임플란트 치과');
console.log('[Test] Found:', JSON.stringify(results, null, 2));

if (results.length > 0) {
  console.log('\n[Test] Getting detail for first place:', results[0].name);
  await new Promise(r => setTimeout(r, 3000));
  const info = await getNaverPlaceInfo(results[0].id);
  console.log('[Test] Detail:', JSON.stringify(info.detail, null, 2));
  console.log('[Test] Reviews:', info.reviews.length);
  if (info.reviews.length > 0) {
    console.log('[Test] Sample review:', info.reviews[0].content.substring(0, 100));
  }
}

console.log('\n[Test] Searching Kakao for "서울 임플란트 치과"...');
await new Promise(r => setTimeout(r, 2000));
const kakao = await searchKakaoMap('서울 임플란트 치과');
console.log('[Test] Kakao results:', JSON.stringify(kakao.slice(0, 3), null, 2));

process.exit(0);
