// Supabase 무료 플랜 일시정지 방지 (v2.0 사용자 요청 — 실제로 멈춰서 로그인이 막혔다).
//
// 무료 플랜은 **7일 동안 요청이 하나도 없으면** 프로젝트를 자동으로 일시정지한다. 그러면 로그인도
// 글도 전부 막히고, 대시보드에서 손으로 되살려야 한다. 하루 한 번 가벼운 조회를 보내 「쓰는 중」으로
// 둔다 (vercel.json의 크론이 이 주소를 부른다).
//
// 읽는 값은 공개 설정 한 줄뿐이고, 쓰는 키도 브라우저에 이미 나가는 공개 키(anon)라 새로 위험해지는
// 것은 없다. 사람이 주소를 직접 열어도 같은 조회만 한 번 더 될 뿐이다.
export const dynamic = 'force-dynamic';   // 캐시되면 요청이 실제로 나가지 않아 의미가 없다

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const at = new Date().toISOString();
  // Firebase를 쓰거나 아직 연결 전이면 할 일이 없다 (Firebase는 일시정지가 없다)
  if (!url || !key) return Response.json({ ok: true, skipped: 'supabase 설정 없음', at });
  try {
    const res = await fetch(`${url}/rest/v1/site_settings?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    return Response.json({ ok: res.ok, status: res.status, at });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e), at });
  }
}
