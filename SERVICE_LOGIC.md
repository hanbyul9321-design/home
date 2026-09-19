# O.HOME 서비스 로직 정리

이 문서는 O.HOME(`https://home-plum-gamma.vercel.app`)의 **내부 동작 원리**를 정리한 것입니다.
사용 방법은 [README.md](./README.md), 설치·운영 상세는 [SETUP_GUIDE.md](./SETUP_GUIDE.md)를 참고하세요.
이 문서는 "코드가 왜 이렇게 짜여 있는지"에 집중합니다.

---

## 1. 전체 구조

```
Next.js App Router (전부 클라이언트 렌더, 'use client')
        │
        ▼
  src/lib/backend/   ← 어댑터 계층 (여기가 핵심)
        │
   ┌────┴────┐
   ▼         ▼
Supabase   Firebase   ← 둘 중 하나, 또는 아무것도 없으면 "로컬 모드"
(Postgres)  (Firestore)
```

- 서버가 따로 없습니다. Next.js는 **정적으로 배포**되고, 브라우저가 Supabase/Firebase에 직접 접속합니다.
- 화면(페이지) 코드는 `src/lib/backend/types.ts`의 `Backend` 인터페이스만 알고, 실제로 어떤 서비스에 붙어 있는지는 모릅니다. 새 백엔드(예: PocketBase)를 추가하려면 이 인터페이스만 구현하면 됩니다.
- DB를 아예 연결하지 않으면 **"로컬 모드"**로 동작합니다 — 모든 데이터가 그 브라우저의 `localStorage`에만 저장됩니다(개발·미리보기·혼자 쓰기 용도).

---

## 2. 연결 설정이 정해지는 순서 (`src/lib/serverConfig.ts`)

앱이 시작할 때 아래 순서로 설정을 찾고, **먼저 찾은 것을 최종으로 확정**합니다(이후 안 바뀜):

1. **`/ohome.config.json`** — 배포본에 올려 둔 파일. **모든 방문자**가 이 값을 받습니다. (`.gitignore`로 저장소에는 안 올라가는 게 기본)
2. **`localStorage`(브라우저)** — 설치 화면에서 방금 입력한 값. **이 브라우저에만** 적용되고 다른 방문자는 못 봄.
3. **`NEXT_PUBLIC_*` 환경변수** — Vercel 등에 직접 등록한 값. **빌드 시점에 번들에 박혀** 들어가므로, 값을 바꾸면 **재배포(Redeploy)가 필요**합니다.

> 이번에 실제로 쓴 방법은 3번(Vercel 환경변수)입니다:
> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

anon key(Supabase)·apiKey(Firebase)는 원래 브라우저에 공개돼도 되는 값입니다. 실제 보안은 이 키가 아니라 **서버 쪽 규칙**(Supabase RLS / Firestore Rules)이 담당합니다.

---

## 3. 인증 (`src/lib/auth.tsx`)

### 3.1 가입코드(초대코드) 방식

이 서비스는 **불특정 다수 가입을 막기 위해** 가입 시 코드를 요구합니다.

- 기본값: `WELCOME` (`inviteCode()` 함수, 관리자가 바꾸지 않았으면)
- 관리자가 로그인 후 **환경설정 → 회원/보안**에서 원하는 값으로 변경 가능 (`setInviteCode`)
- 가입 시도 시 입력한 코드와 `inviteCode()`가 다르면 즉시 실패 처리 — **서버까지 요청을 보내지 않고 클라이언트에서 먼저 막습니다.**

### 3.2 첫 계정 = 자동 관리자

Supabase 스키마(`handle_new_user` 트리거)를 보면:

```sql
case when existing = 0 then 'admin' else 'member' end
```

`auth.users`에 트리거가 걸려 있어서, **profiles 테이블이 비어 있는 상태에서 가입하는 첫 사람이 자동으로 admin**이 됩니다. 이후 가입자는 전부 `member`.

### 3.3 로그인 방식

- Supabase 모드: 이메일(아이디로 쓰임) + 비밀번호. Supabase Auth 그대로 사용.
- Firebase 모드: Firebase Authentication 사용.
- 로컬 모드: `localStorage`에 저장된 mock 계정(`admin`/`0000`, `guest`/`0000` 기본 제공, 또는 설치 화면에서 만든 계정).

### 3.4 권한 등급

```ts
type Role = 'admin' | 'member' | 'guest'  // guest = 비로그인 방문자
```

---

## 4. 데이터 모델 — "컬렉션" 20여 종

`src/lib/backend/types.ts`의 `COLLECTION_OF`가 localStorage 키 ↔ 실제 테이블/컬렉션 이름을 매핑합니다. 예:

| 로컬 키 (`ohome.*.v1`) | 테이블/컬렉션 | 용도 |
|---|---|---|
| `ohome.board.v1` | `posts` | 게시판 글 |
| `ohome.guest.v1` | `guestbook` | 방명록 |
| `ohome.chars.v1` | `characters` | 캐릭터 |
| `ohome.rels.v1` | `relations` | 자캐관계도(자관) |
| `ohome.backup.v1` | `gallery` | 그림 갤러리 |
| `ohome.trpg.v1` / `ohome.trpgbody.v1` | `trpg_logs` / `trpg_log_bodies` | TRPG 로그 (목록/본문 분리) |
| `ohome.comments.v1` | `comments` | 댓글 (모든 글 공용, 자기 문서로 독립) |
| ... | ... | 다이어리·메모·커미션·역극방·감상타래 등 |

Supabase 쪽 실제 테이블 구조(`supabase/schema.sql`)는 전부 **같은 모양**입니다:

```sql
id          text primary key,
data        jsonb not null,      -- 항목의 실제 내용(제목·본문 등)은 여기 통째로
author_id   uuid,
visibility  text default 'public',
sort        double precision,
created_at / updated_at
```

권한·정렬·필터에 필요한 값만 컬럼으로 빼고, 나머지 세부 필드는 `data` JSON 한 덩어리에 넣는 식이라 **필드가 추가돼도 스키마를 안 바꿔도 됩니다.**

### 4.1 왜 댓글·답변·발화가 "자기 문서"로 분리돼 있는가

댓글을 글(Post) 배열 안에 두면, 댓글 하나 달 때마다 **그 글 자체를 UPDATE**해야 합니다. 그런데 RLS 규칙은 "글 수정은 작성자 또는 관리자만" 이라서, **일반 회원이 남의 글에 댓글을 달 수 없는** 버그가 생겼습니다(달리는 것처럼 보였다가 서버 값으로 되돌아옴). 그래서 댓글(`comments`)·자관 답변(`qa_answers`)·역극 발화(`rp_messages`)는 전부 별도 컬렉션으로 분리해, 각자 자기 `authorId`로 자기 것만 쓰게 했습니다.

같은 이유로 **TRPG 로그도 목록(`trpg_logs`)과 본문(`trpg_log_bodies`)이 분리**돼 있습니다 — "목록엔 보이되 본문은 나만 보기"를 만족시키면서, 큰 본문(최대 700KB)을 매번 다시 안 보내기 위한 것도 있습니다.

---

## 5. 저장 방식 — "배열 통째로 갱신" + 서버에서 diff

화면 코드는 전부 `useLocalList(key, seed)` 훅(`src/lib/postStore.ts`)을 써서 **"목록 배열을 통째로 바꿔서 저장"**하는 옛날 방식 그대로입니다(약 86곳). 하지만 실제 DB는 항목 1개 = 행/문서 1개이므로, 저장 시점에 `diffList()`(`src/lib/backend/types.ts`)가:

- **inserts** — 새로 생긴 항목
- **updates** — 내용이 바뀐 항목
- **moves** — 내용은 그대로고 순서(`sort`)만 바뀐 항목
- **deletes** — 사라진 항목

으로 쪼개서 필요한 것만 보냅니다.

> **moves를 따로 취급하는 이유**: 글을 맨 앞에 끼우면 기존 글 전부의 순서가 밀리는데, 이걸 전부 update로 보내면 큰 본문(TRPG 로그 등)까지 매번 재전송됩니다. Firestore 쓰기 1건의 최대 크기(10MiB)를 넘어 "새 글 저장이 조용히 실패"하는 사고가 있었습니다. moves는 `sort` 값만 고쳐 보냅니다.

다른 사람의 변경은 `subscribe()`(Supabase Realtime / Firestore onSnapshot)로 실시간 반영됩니다. 로컬 모드에서는 브라우저 `storage` 이벤트로 같은 브라우저의 다른 탭끼리만 동기화됩니다.

---

## 6. 공개범위(Visibility) 로직

### 6.1 항목 단위: `public` / `member` / `private`

- Supabase RLS(위 스키마 참고): `visibility='public'` 이거나, `member`이고 로그인 상태이거나, 본인 글이거나, 관리자면 읽기 허용.

### 6.2 메뉴 단위가 항목 단위를 "좁히기만" 한다 (`src/lib/visFloor.ts`)

메뉴 자체를 "회원만 보임"으로 설정해도, 예전에는 **글은 여전히 `public`으로 저장**돼 있어서 URL을 직접 알거나 API를 호출하면 그대로 노출됐습니다. 그래서 저장 시점에 `visFloorOf()`가 그 글이 속한 메뉴의 공개범위를 확인해 최소 기준을 강제합니다:

```
메뉴 전체 공개 → 글 그대로
메뉴 회원만    → 글은 최소 member
메뉴 관리자만  → 글은 최소 private
```

글 자체가 이미 더 좁으면(비밀글 등) 그대로 둡니다 — **넓히지는 않고 좁히기만** 합니다.

### 6.3 `listHidden`이 있는 특수 케이스 (`metaOf()`, `backend/types.ts`)

TRPG 로그처럼 "목록에는 보이지만 나만 보기"가 필요한 항목은 `visibility`(실제 열람 권한)와 별개로 `listHidden`(목록 질의 단계에서 보이는지)을 둡니다. Firestore/Supabase 둘 다 list 조회와 단일 조회가 같은 규칙을 타기 때문에, 이 필드가 있는 문서에는 **민감한 내용을 절대 함께 두면 안 되고**(그래서 TRPG 로그 본문이 별도 문서), 목록 문서에는 제목 정도만 둡니다.

### 6.4 위임 편집권 (`editorIdsOf()`)

캐릭터 등에서 "편집까지" 권한을 받은 회원의 id를 `grants` 배열이 아니라 **평평한 문자열 배열**(`editorIds`)로 따로 저장합니다. Firestore/Supabase 보안 규칙에는 "배열 안 어떤 원소의 필드가 나와 같은가"를 직접 물을 수단이 없어서, 규칙이 바로 검사할 수 있는 형태가 필요하기 때문입니다.

---

## 7. 사이트 설정 계층 (`src/lib/settingStore.ts`)

테마·폰트·메뉴 구성·메인 위젯 배치처럼 "관리자가 정하고 모든 방문자가 보는" 값들은 `site_settings` 테이블(key/value, jsonb)에 저장됩니다.

- 읽기 순서: **메모리 캐시 → localStorage(첫 페인트용 사본) → 기본값**. 앱 시작 시 `primeSettings()`가 서버 값을 한 번에 전부 받아 캐시를 채우고, 이후 모든 읽기는 동기(캐시)로 처리됩니다 — 화면이 렌더링 도중 동기적으로 설정값을 읽는 구조라서, 렌더 전에 캐시를 채워야 합니다.
- 쓰기 순서: **캐시 → localStorage → DB**. DB 저장이 실패해도 조용히 무시하지 않고, 화면에 실패 이벤트(`ohome-setting-error`)를 띄웁니다 — 안 그러면 "저장한 것처럼 보이다가 다음 접속에 원래대로 돌아가는" 증상이 됩니다.
- `SETTING_KEYS` **화이트리스트**로만 "설정"을 판별합니다. 이게 없으면 `ohome.*` 전체를 훑다가 글 목록 같은 콘텐츠 키까지 설정으로 착각해, "설정 올리기"를 누르면 글 배열이 설정 테이블에 잘못 들어갈 수 있습니다.
- `LOCAL_ONLY` 목록(접힘 상태, 로그인 세션, 연결 설정, 알림 목록/on-off 등)은 **사람마다 다른 값**이라 서버로 절대 안 올라갑니다.

---

## 8. 백업 · 복원 · DB 이전 (`src/lib/transfer.ts`)

세 기능(zip 백업, zip 복원, 다른 DB로 이전)이 **같은 엔진**을 씁니다:

1. 현재 저장소에서 콘텐츠 전부 + 설정 전부 + 이미지 전부를 읽어 `Snapshot`(버전 2) 하나로 만든다 (`dumpAll`)
2. 대상 저장소에 그대로 밀어 넣는다
3. 저장소가 바뀌면 이미지 URL도 바뀌므로, 새로 올라간 파일의 새 주소로 본문 안의 옛 주소를 정확히 치환한다 (`replaceRefs`)

**안전장치**: 콘텐츠 컬렉션 중 하나라도 못 읽으면(`snap.failed`) 이미지 정리(고아 파일 찾기)를 아예 하지 않습니다 — 못 읽은 컬렉션에서 쓰이던 이미지까지 "아무도 안 쓰는 파일"로 오인해서 지워질 수 있기 때문입니다.

---

## 9. 설치 화면이 하는 일 (README 3단계와 대응)

1. Supabase/Firebase 선택 → 프로젝트 만들고 URL·키 입력
2. **[SQL 복사]** → Supabase SQL Editor에 `supabase/schema.sql` 실행 (또는 Firebase는 [규칙 복사] → 콘솔에 게시)
   - 테이블 17종 + RLS 정책 + `is_admin()` 함수 + 가입 트리거 + Storage 버킷(`ohome`) 전부 이 한 파일에 있음
   - 여러 번 실행해도 안전(`create table if not exists`, `drop policy if exists` 패턴)
3. **[연결 확인]** → `Backend.check()`가 접속 가능 여부(reachable) · 스키마 준비 여부(schema) · 관리자 계정 존재 여부(hasAdmin)를 순서대로 검사
4. 관리자 계정 생성(=첫 가입 = 자동 admin)
5. 설정 파일(`ohome.config.json`) 다운로드 → 저장소 `public/`에 커밋 **또는** 지금처럼 Vercel 환경변수로 등록

---

## 10. 지금 이 프로젝트의 실제 연결 상태

- **Supabase 프로젝트**: `https://mhuorklupfecfvtvwaan.supabase.co`
- **적용 방식**: Vercel 프로젝트 환경변수 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
- **배포 주소**: `https://home-plum-gamma.vercel.app`
- **가입코드**: 기본값 `WELCOME` (아직 안 바꿨다면). 첫 가입자가 관리자.

앞으로 코드를 바꾸는 김에 이 문서와 실제 동작이 달라지면, 이 문서도 같이 고쳐 주세요.
