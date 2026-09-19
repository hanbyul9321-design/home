// 서버가 돌려준 오류를 사람이 할 수 있는 일로 바꿔 준다 (v2.0)
//  — 원문만 보여 주면 무엇을 해야 할지 알 수 없고, 감추면 원인을 못 찾는다.

/**
 * 던져진 값에서 읽을 수 있는 메시지 뽑기 (v2.0 사용자 제보 — 「저장하지 못했습니다 — [object Object]」).
 *
 * `String(err)`은 Error가 아닌 객체에 대해 "[object Object]"를 내놓는다. Supabase Storage·Auth나
 * fetch 실패는 Error가 아닌 **평범한 객체**를 돌려줄 때가 있어서, 정작 원인을 적어 둔 message·hint가
 * 통째로 가려졌다. 아는 칸(message·hint·details·code)을 먼저 찾고, 그래도 없으면 JSON으로 보여 준다.
 */
export function errText(err: unknown): string {
  if (err instanceof Error && err.message) {
    // PostgrestError는 hint에 해결 방법(실행할 SQL 등)이 담겨 온다 — 있으면 함께 보여 준다
    const hint = (err as { hint?: unknown }).hint;
    return typeof hint === 'string' && hint ? `${err.message} (${hint})` : err.message;
  }
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const parts = ['message', 'error_description', 'error', 'hint', 'details', 'code']
      .map(k => (typeof o[k] === 'string' ? (o[k] as string) : ''))
      .filter(Boolean);
    if (parts.length) return parts.join(' · ');
    try { return JSON.stringify(err); } catch { /* 순환 참조 등 */ }
  }
  return String(err);
}

/** 겪어 본 오류는 원인과 해결 방법으로 바꿔 준다 — 원문만으로는 무엇을 해야 할지 모른다 */
export function explainDbError(msg: string): string {
  const m = msg.toLowerCase();
  // PostgREST가 테이블·컬럼 목록을 캐시해 둬서, SQL로 컬럼을 추가해도 한동안 모른다
  if (m.includes('schema cache') || m.includes('pgrst204')) {
    return 'DB 스키마 캐시가 옛 상태입니다 — Supabase > SQL Editor에서 다음 한 줄을 실행해 주세요: '
      + "notify pgrst, 'reload schema';  (설치 SQL을 다시 실행해도 됩니다)";
  }
  // 행 수준 보안에 막힌 경우 — 규칙을 안 붙였거나 로그인이 안 돼 있다
  if (m.includes('row-level security') || m.includes('violates row-level') || m.includes('permission denied')) {
    return '보안 규칙에 막혔습니다 — 로그인 상태와 설치 SQL(보안 규칙) 실행 여부를 확인해 주세요';
  }
  // Firestore가 규칙 거부를 돌려주는 문구 (v2.0 포크 제보 — 편집 권한 회원의 저장 거부).
  // 규칙이 옛 버전이거나, 업데이트 전에 준 편집 권한이 문서에 아직 반영 전일 수 있다 —
  // 후자는 관리자가 캐릭터 목록을 한 번 열면 자동으로 다시 계산된다.
  if (m.includes('insufficient permissions')) {
    return '보안 규칙에 막혔습니다 — ① Firebase 콘솔의 규칙을 환경설정 > 회원/보안의 최신 규칙으로 다시 붙여넣고 '
      + '② 편집 권한 관련이면 관리자가 캐릭터 목록을 한 번 열어 준 뒤 다시 시도해 주세요';
  }
  if (m.includes('does not exist') || m.includes('relation') && m.includes('exist')) {
    return '서버에 아직 없는 테이블·컬럼입니다 — 설치 SQL을 최신 것으로 다시 실행해 주세요';
  }
  return msg;
}
