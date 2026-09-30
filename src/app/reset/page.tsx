'use client';
// 비밀번호 재설정 (v2.0 사용자 제보 — 비밀번호를 잊으면 복구할 길이 없었다).
//
// 「비밀번호 찾기」가 보내는 메일의 링크가 이 화면으로 돌아온다. 링크에 담겨 온 임시 세션이
// 신원을 보증하므로 **현재 비밀번호를 묻지 않는다** — 잊어버린 사람이 쓰는 화면이라 물으면 소용이 없다.
// 세션이 없으면(링크 없이 직접 들어왔거나 만료) 저장 단계에서 막히고, 그 이유를 화면에 적어 준다.
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { KInput } from '@/components/ui/Kit';

export default function ResetPage() {
  const router = useRouter();
  const { setPassword, logout } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  /* 메일 링크는 토큰을 주소 뒤(#…)에 달고 온다. 로그인 계층이 그것을 세션으로 바꾸고 나면
     주소에 남은 토큰은 쓸모가 없으므로 지워, 주소창을 복사해 남에게 보내도 안전하게 한다. */
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const t = setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const save = async () => {
    setErr('');
    if (pw.length < 6) { setErr('새 비밀번호는 6자 이상으로 정해 주세요.'); return; }
    if (pw !== pw2) { setErr('새 비밀번호가 서로 다릅니다.'); return; }
    setBusy(true);
    const r = await setPassword(pw);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? '변경하지 못했습니다.'); return; }
    // 바꾼 비밀번호로 새로 로그인하게 한다 — 임시 세션을 그대로 쓰면 「바뀐 게 맞나」 확인이 안 된다
    await logout();
    toast('비밀번호가 변경되었습니다 — 새 비밀번호로 로그인해 주세요');
    router.push('/login');
  };

  return (
    <section className="page">
      <div className="panel" style={{ padding: 28, maxWidth: 480, margin: '40px auto 0' }}>
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '.3em', textAlign: 'center',
          margin: '4px 0 6px', color: 'var(--ink)',
        }}>RESET</h1>
        <p className="hint" style={{ textAlign: 'center', marginBottom: 18 }}>
          새 비밀번호를 정해 주세요 — 메일의 링크로 들어온 경우에만 저장됩니다
        </p>
        <div style={{ display: 'grid', gap: 9 }}>
          <KInput type="password" placeholder="새 비밀번호 (6자 이상)" value={pw}
            onChange={e => setPw(e.target.value)} />
          <KInput type="password" placeholder="새 비밀번호 확인" value={pw2}
            onChange={e => setPw2(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); }} />
          {err && <p style={{ color: 'var(--accent)', fontSize: 11.5, margin: 0 }}>{err}</p>}
          <button className="btn btn-dark" disabled={busy} onClick={save}>
            {busy ? '저장 중…' : '비밀번호 변경'}
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/login')}>로그인으로 돌아가기</button>
        </div>
      </div>
    </section>
  );
}
