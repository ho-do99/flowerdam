import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../utils/prisma';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-haiku-4-5-20251001';

// 주문 자동 배분 최적 파트너 추천
export async function recommendPartner(
  orderId: string
): Promise<{ partnerId: string; reason: string } | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      deliveryRegion: true,
      deliveryAddress: true,
      productName: true,
      price: true,
      scheduledAt: true,
    },
  });
  if (!order) return null;

  // 해당 지역 승인된 파트너 조회
  const partners = await prisma.user.findMany({
    where: { role: 'PARTNER_OWNER', region: order.deliveryRegion, isApproved: true, isActive: true },
    select: {
      id: true,
      name: true,
      businessName: true,
      _count: { select: { ordersAsPartner: true } },
      wallet: { select: { balance: true } },
    },
  });

  if (partners.length === 0) return null;
  if (partners.length === 1) return { partnerId: partners[0].id, reason: '해당 지역 유일 파트너' };

  // 최근 24시간 주문 수 조회
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCounts = await Promise.all(
    partners.map((p) =>
      prisma.order.count({
        where: {
          partnerId: p.id,
          createdAt: { gte: yesterday },
          status: { in: ['ACCEPTED', 'IN_PROGRESS', 'DELIVERING'] },
        },
      })
    )
  );

  const partnerData = partners.map((p, i) => ({
    id: p.id,
    name: p.businessName ?? p.name,
    totalOrders: p._count.ordersAsPartner,
    recentLoad: recentCounts[i],
    walletBalance: p.wallet?.balance ?? 0,
  }));

  const prompt = `당신은 꽃담 플랫폼의 주문 배분 AI입니다.
다음 주문을 처리할 최적의 화원 파트너를 선택해주세요.

주문 정보:
- 지역: ${order.deliveryRegion}
- 주소: ${order.deliveryAddress}
- 상품: ${order.productName}
- 금액: ${order.price.toLocaleString()}원

파트너 목록:
${partnerData.map((p, i) => `${i + 1}. ${p.name} (ID: ${p.id}) - 총 수주: ${p.totalOrders}건, 현재 처리중: ${p.recentLoad}건`).join('\n')}

선정 기준:
1. 현재 처리 중인 주문이 적은 파트너 우선 (부하 분산)
2. 총 수주 실적이 적은 파트너 배려 (신규 파트너 육성)
3. 지역 전문성 고려

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"partnerId": "파트너ID", "reason": "선정 이유 (50자 이내)"}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const result = JSON.parse(text) as { partnerId: string; reason: string };

    // 유효한 파트너 ID인지 검증
    if (!partners.some((p) => p.id === result.partnerId)) return null;
    return result;
  } catch {
    return null;
  }
}

// 수요 예측 (지역별 주문량 예측)
export async function predictDemand(region: string): Promise<{
  nextWeekEstimate: number;
  trend: 'up' | 'down' | 'stable';
  peakDays: string[];
  insight: string;
}> {
  // 최근 4주 데이터 수집
  const weeks = await Promise.all(
    [0, 1, 2, 3].map(async (weeksAgo) => {
      const start = new Date();
      start.setDate(start.getDate() - (weeksAgo + 1) * 7);
      const end = new Date();
      end.setDate(end.getDate() - weeksAgo * 7);

      return prisma.order.count({
        where: {
          deliveryRegion: region,
          createdAt: { gte: start, lt: end },
          status: { not: 'CANCELLED' },
        },
      });
    })
  );

  // 요일별 데이터 (최근 4주)
  const dayOfWeekCounts = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6].map(async (dow) => {
      const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "Order"
        WHERE "deliveryRegion" = ${region}
          AND EXTRACT(DOW FROM "createdAt") = ${dow}
          AND "createdAt" >= NOW() - INTERVAL '28 days'
          AND status != 'CANCELLED'
      `;
      return { dow, count: Number(count[0]?.count ?? 0) };
    })
  );

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const avgByDay = dayOfWeekCounts
    .map((d) => ({ day: dayNames[d.dow], avg: Math.round(d.count / 4) }))
    .sort((a, b) => b.avg - a.avg);

  const [thisWeek, lastWeek, week2, week3] = weeks;
  const avgPast3 = Math.round((lastWeek + week2 + week3) / 3);

  const prompt = `꽃담 플랫폼 ${region} 지역의 주문 수요를 분석해주세요.

최근 주문 데이터:
- 이번 주: ${thisWeek}건
- 지난 주: ${lastWeek}건
- 2주 전: ${week2}건
- 3주 전: ${week3}건
- 3주 평균: ${avgPast3}건

요일별 평균 (최근 4주):
${avgByDay.map((d) => `${d.day}요일: ${d.avg}건`).join(', ')}

다음 주 예측 및 인사이트를 제공해주세요. 반드시 다음 JSON 형식으로만 응답하세요:
{
  "nextWeekEstimate": 숫자,
  "trend": "up" 또는 "down" 또는 "stable",
  "peakDays": ["요일1", "요일2"],
  "insight": "운영 인사이트 (80자 이내)"
}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return JSON.parse(text) as {
      nextWeekEstimate: number;
      trend: 'up' | 'down' | 'stable';
      peakDays: string[];
      insight: string;
    };
  } catch {
    const trend: 'up' | 'down' | 'stable' =
      thisWeek > avgPast3 * 1.1 ? 'up' : thisWeek < avgPast3 * 0.9 ? 'down' : 'stable';
    return {
      nextWeekEstimate: Math.round(avgPast3 * (trend === 'up' ? 1.1 : trend === 'down' ? 0.9 : 1)),
      trend,
      peakDays: avgByDay.slice(0, 2).map((d) => d.day),
      insight: `${region} 지역 최근 주문 추세를 분석했습니다.`,
    };
  }
}

// 이상 거래 감지
export async function detectAnomalies(userId: string): Promise<{
  isAnomalous: boolean;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high';
}> {
  const recentOrders = await prisma.order.findMany({
    where: {
      customerId: userId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      price: true,
      deliveryRegion: true,
      status: true,
      createdAt: true,
    },
  });

  if (recentOrders.length < 3) {
    return { isAnomalous: false, reasons: [], riskLevel: 'low' };
  }

  const cancelRate = recentOrders.filter((o) => o.status === 'CANCELLED').length / recentOrders.length;
  const avgPrice = recentOrders.reduce((s, o) => s + o.price, 0) / recentOrders.length;
  const regions = [...new Set(recentOrders.map((o) => o.deliveryRegion))];

  const prompt = `꽃담 플랫폼 이상 거래 감지 시스템입니다.

최근 7일 주문 분석:
- 주문 수: ${recentOrders.length}건
- 취소율: ${Math.round(cancelRate * 100)}%
- 평균 금액: ${Math.round(avgPrice).toLocaleString()}원
- 이용 지역 수: ${regions.length}개 지역 (${regions.join(', ')})

이상 거래 기준:
1. 취소율 50% 이상
2. 하루 5건 이상 주문
3. 단시간 내 다수 지역 주문

반드시 다음 JSON으로만 응답:
{"isAnomalous": true/false, "reasons": ["이유1"], "riskLevel": "low"|"medium"|"high"}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return JSON.parse(text) as {
      isAnomalous: boolean;
      reasons: string[];
      riskLevel: 'low' | 'medium' | 'high';
    };
  } catch {
    return {
      isAnomalous: cancelRate > 0.5,
      reasons: cancelRate > 0.5 ? ['높은 취소율'] : [],
      riskLevel: cancelRate > 0.5 ? 'medium' : 'low',
    };
  }
}

// 리본 문구 AI 추천
export async function suggestRibbonText(
  occasion: string,
  senderName: string,
  recipientName: string
): Promise<string[]> {
  const prompt = `화환 리본 문구를 추천해주세요.

상황: ${occasion}
보내는 분: ${senderName}
받는 분/단체: ${recipientName}

격식 있고 따뜻한 한국어 리본 문구 3가지를 추천해주세요.
반드시 다음 JSON 형식으로만 응답하세요:
{"suggestions": ["문구1", "문구2", "문구3"]}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const result = JSON.parse(text) as { suggestions: string[] };
    return result.suggestions;
  } catch {
    return ['삼가 고인의 명복을 빕니다', '깊은 위로의 마음을 전합니다', '故人의 안식을 기원합니다'];
  }
}
