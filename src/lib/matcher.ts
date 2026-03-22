import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface NaverHospital {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

interface KakaoCandidate {
  name: string;
  rating: number | null;
  reviewCount: number;
  address: string;
  hours: string;
  phone: string;
}

/**
 * GPT-5로 네이버 병원과 카카오맵 후보들을 매칭.
 * 여러 후보 중 가장 정확한 것을 선택.
 */
export async function matchKakaoHospital(
  naverHospital: NaverHospital,
  kakaoCandidates: KakaoCandidate[],
): Promise<{ matchIndex: number; confidence: number; reason: string }> {
  if (kakaoCandidates.length === 0) {
    return { matchIndex: -1, confidence: 0, reason: 'No candidates' };
  }

  const candidateList = kakaoCandidates.map((c, i) =>
    `[${i}] "${c.name}" | 주소: ${c.address} | 전화: ${c.phone} | 평점: ${c.rating ?? '없음'} | 리뷰: ${c.reviewCount}건`
  ).join('\n');

  try {
    const response = await openai.responses.create({
      model: 'gpt-5.4-mini',
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'developer',
          content: '네이버 플레이스 병원과 카카오맵 검색 결과를 매칭하는 전문가. JSON으로만 응답.',
        },
        {
          role: 'user',
          content: `네이버 병원:
- 이름: "${naverHospital.name}"
- 주소: ${naverHospital.address || '정보없음'}
- 전화: ${naverHospital.phone || '정보없음'}

카카오맵 후보:
${candidateList}

같은 병원을 찾아주세요. 이름이 약간 다를 수 있지만 (예: "티유치과" vs "티유치과의원"), 주소와 전화번호로 교차 확인. 체인점은 주소로 구분.
확실하지 않으면 matchIndex: -1.

{"matchIndex": 번호(-1이면 없음), "confidence": 0.0~1.0, "reason": "근거"}`,
        },
      ],
    });

    const text = response.output_text;
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        matchIndex: typeof result.matchIndex === 'number' ? result.matchIndex : -1,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        reason: result.reason || '',
      };
    }
  } catch (e) {
    console.error('[Matcher] GPT-5 matching failed:', e);
  }

  // Fallback: simple name matching
  const fallbackIdx = kakaoCandidates.findIndex(c =>
    c.name.includes(naverHospital.name.substring(0, 4)) ||
    naverHospital.name.includes(c.name.substring(0, 4))
  );
  return {
    matchIndex: fallbackIdx,
    confidence: fallbackIdx >= 0 ? 0.5 : 0,
    reason: 'GPT 실패, 이름 기반 폴백',
  };
}

/**
 * GPT-5로 구글맵 검색 결과가 올바른 병원인지 검증.
 */
export async function verifyGoogleMatch(
  naverHospital: NaverHospital,
  googleName: string | undefined,
  googleRating: number | null,
  googleReviewCount: number,
): Promise<{ isMatch: boolean; confidence: number }> {
  if (!googleRating && !googleReviewCount) {
    return { isMatch: false, confidence: 0 };
  }

  if (!googleName) {
    // 병원명으로 직접 검색했으므로 결과가 있으면 매칭 가능성 높음
    return { isMatch: true, confidence: 0.7 };
  }

  try {
    const response = await openai.responses.create({
      model: 'gpt-5.4-mini',
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'developer',
          content: 'JSON으로만 응답.',
        },
        {
          role: 'user',
          content: `같은 병원인가요?
A: "${naverHospital.name}" (${naverHospital.address || '?'})
B: "${googleName}" (구글맵, 평점 ${googleRating}, 리뷰 ${googleReviewCount}건)
{"isMatch": true/false, "confidence": 0.0~1.0}`,
        },
      ],
    });

    const text = response.output_text;
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback
  }

  return { isMatch: true, confidence: 0.6 };
}
