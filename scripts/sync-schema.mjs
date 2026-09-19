// supabase/schema.sql 을 src/lib/schemaSql.ts 의 SCHEMA_SQL 로 다시 만든다.
//
// 두 벌을 손으로 맞추다 어긋난 적이 있다 (v2.0): 앱은 editor_ids 컬럼과 comments·notifications
// 테이블을 쓰는데 저장소의 schema.sql에는 없어서, 그 파일을 실행한 사람은 **글 저장이 전부
// 실패**했다 (PGRST204). 화면이 주는 SQL이 진짜이므로 그쪽을 원본으로 삼고 이 파일로 복사한다.
//
//   node scripts/sync-schema.mjs           — 다시 만들기
//   node scripts/sync-schema.mjs --check   — 어긋나 있으면 1로 종료 (고치지 않음)
import { readFileSync, writeFileSync } from 'node:fs';

const TS = 'src/lib/schemaSql.ts';
const OUT = 'supabase/schema.sql';
const MARK = 'export const SCHEMA_SQL = `';

const src = readFileSync(TS, 'utf8');
const at = src.indexOf(MARK);
if (at === -1) throw new Error(`${TS}에서 SCHEMA_SQL을 찾지 못했습니다`);
const rest = src.slice(at + MARK.length);
const sql = rest.slice(0, rest.lastIndexOf('`;'));
if (sql.includes('${')) throw new Error('SCHEMA_SQL에 템플릿 보간이 있습니다 — 그대로 복사할 수 없습니다');

const check = process.argv.includes('--check');
const cur = (() => { try { return readFileSync(OUT, 'utf8'); } catch { return null; } })();
if (cur === sql) {
  console.log(`${OUT} 최신 상태입니다`);
} else if (check) {
  console.error(`${OUT} 가 ${TS} 와 어긋났습니다 — node scripts/sync-schema.mjs 를 실행해 주세요`);
  process.exit(1);
} else {
  writeFileSync(OUT, sql);
  console.log(`${OUT} 를 ${TS} 기준으로 다시 만들었습니다`);
}
