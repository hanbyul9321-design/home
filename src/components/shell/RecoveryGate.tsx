'use client';
/* 비밀번호 재설정 링크를 어느 페이지에서 받아도 재설정 화면으로 보낸다 (v2.0).
 *
 * 메일의 링크는 Supabase가 정해 둔 주소로 돌아오는데, 그 주소는 프로젝트 설정(Site URL ·
 * Redirect URLs)에 달려 있어 홈 주인마다 다르다 — 보통은 홈 첫 화면으로 떨어진다.
 * 그러면 주소 뒤에 토큰만 달린 채 평소 화면이 떠서, **새 비밀번호를 넣을 곳이 없다.**
 * 여기서 토큰을 알아보고 /reset 으로 넘겨, 설정을 건드리지 않아도 재설정이 되게 한다.
 *
 * 토큰은 주소 뒤(#…)에 실려 오고 로그인 계층이 그것을 세션으로 바꾸므로, 그 전에 알아봐야 한다.
 * 놓치더라도 /reset 으로 직접 들어가면 같은 화면이 나온다. */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** 이 창이 열릴 때의 주소 — 로그인 계층이 토큰을 지우기 전에 붙잡아 둔다 */
const initialHash = typeof window === 'undefined' ? '' : window.location.hash;

export function RecoveryGate() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/reset') return;
    const hash = window.location.hash || initialHash;
    if (!hash.includes('type=recovery')) return;
    router.replace(`/reset${hash}`);
  }, [pathname, router]);
  return null;
}
