# BREQ — 크라우드소싱 코스 추천 설계

> "내 근처에서 다른 러너들이 실제로 달렸던 코스를, 목표 거리별로 추천한다."
> 라우팅 API가 기계로 만든 길이 아니라, **유저들의 실제 러닝 트랙을 모아 통계로 추천**한다.

## 0. 한눈에

- **성격**: 네트워크 효과 기능. 데이터(유저 트랙)가 쌓일수록 추천 품질이 올라간다.
- **전제**: 지금 BREQ는 백엔드 없음(localStorage). 이 기능은 **모든 유저의 트랙을 한곳에 모으는 DB**가 필수.
- **스택**: Supabase(Postgres + **PostGIS**) + Vercel 서버리스(`/api/*`). 키는 서버 전용.
- **콜드 스타트**: 데이터 없을 땐 추천 불가 → 먼저 **수집부터** 시작, 내 과거 기록으로 시드, "이 지역 첫 개척자" 상태.
- **실시간 현재위치 추적은 범위 제외**(이번 결정). 추천은 "시작 전 미리보기"까지.

---

## 1. 아키텍처

```
[앱(Vite/React)]
   │  러닝 종료 → 트랙 업로드            시작 전 → 추천 요청
   ▼                                      ▼
[/api/runs  (POST)]                   [/api/recommend (GET)]
   │  service-role 키로 insert            │  RPC 호출
   ▼                                      ▼
[Supabase Postgres + PostGIS]  ──  recommend_routes() 함수(ST_DWithin + 집계)
```

- 클라이언트는 Supabase에 **직접 쓰지 않는다**. 모든 쓰기/읽기는 `/api/*` 서버리스를 경유(코치 키 패턴과 동일).
- 환경변수(서버 전용): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. 데이터 모델

### 2.1 `runs` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK (default gen_random_uuid()) | |
| `device_id` | `text` | 익명 디바이스 ID(로그인 없음). 같은 사람 중복 집계 방지용 |
| `distance_km` | `numeric(5,2)` | 트랙으로 재계산한 실거리 |
| `duration_sec` | `int` | |
| `avg_pace_sec` | `int` | 초/km |
| `track` | `geography(LineString,4326)` | 프라이버시 트림 후의 경로 |
| `start_pt` | `geography(Point,4326)` | 트림된 출발점(반경 검색용) |
| `start_cell` | `text` | 출발점 ~150m 격자 해시(geohash 6자리). 군집·집계 버킷 |
| `dist_bucket` | `int` | `round(distance_km)` — 목표거리 매칭용 |
| `region` | `text` | 표시용(예: "반포") |
| `created_at` | `timestamptz` default now() | |

인덱스:
```sql
create index runs_start_gix on runs using gist (start_pt);
create index runs_track_gix on runs using gist (track);
create index runs_bucket_idx on runs (dist_bucket, start_cell);
```

### 2.2 DDL (초안)

```sql
create extension if not exists postgis;

create table runs (
  id           uuid primary key default gen_random_uuid(),
  device_id    text not null,
  distance_km  numeric(5,2) not null,
  duration_sec int not null,
  avg_pace_sec int not null,
  track        geography(LineString,4326) not null,
  start_pt     geography(Point,4326) not null,
  start_cell   text not null,
  dist_bucket  int  not null,
  region       text,
  created_at   timestamptz not null default now()
);
-- 인덱스는 위 2.1 참조

-- RLS: 익명 클라이언트의 직접 접근 차단. 쓰기/읽기는 service-role(서버리스)만.
alter table runs enable row level security;
-- (정책 없음 = anon 차단. service_role 키는 RLS 우회)
```

---

## 3. 수집 파이프라인

### 3.1 트리거
`RunTracker.finish/save` 시점, **BREQ로 측정했고 track 길이 ≥ 2**인 러닝만 업로드(인증카드 무결성 규칙과 동일). 시뮬레이션 런은 제외.

### 3.2 프라이버시 처리(업로드 전, 서버에서)
- **출발/도착 트림**: 트랙 앞·뒤 각 ~150m를 제거하고 저장 → 집·직장 위치 노출 방지.
- **격자 해시**: 정확 좌표 대신 `start_cell`(geohash6, ~150m)로 버킷팅.
- **집계 임계값(중요)**: 추천에 노출하려면 **서로 다른 device_id ≥ K명(예: K=3)** 이 같은 코스를 달려야 함. 1명 코스는 개인 동선이라 노출 금지.
- **옵트아웃**: 마이 화면에 "내 러닝을 코스 추천에 익명으로 기여" 토글. 끄면 업로드 안 함.

### 3.3 API — `POST /api/runs`
```
요청  { deviceId, distanceKm, durationSec, avgPaceSec, track: GeoPoint[], region? }
처리  track 트림 → start_cell/dist_bucket 계산 → Supabase insert (service-role)
응답  { ok: true, id }
```

### 3.4 클라이언트 식별
- `localStorage['runnersway.deviceId']` = 최초 1회 생성한 UUID. 로그인 도입 시 user_id로 승격.

---

## 4. 추천 쿼리

### 4.1 API — `GET /api/recommend?lat=&lng=&km=&radius=`
- `km` 선택(없으면 전체), `radius` 기본 400m.

### 4.2 Postgres RPC `recommend_routes(lat, lng, target_km, radius_m, min_runners)`
```
1) 후보: ST_DWithin(start_pt, point(lat,lng), radius_m)
         AND (target_km IS NULL OR dist_bucket = round(target_km))
2) 군집: GROUP BY (start_cell, dist_bucket)   -- v1 단순 군집
3) 집계: count(distinct device_id) AS runners,
         avg(avg_pace_sec), avg(distance_km),
         대표 트랙 = 가장 최근(or medoid) 1개
4) 필터: runners >= min_runners (예: 3)
5) 정렬: runners desc, 최근성
6) 반환: top K
```
응답:
```
{ routes: [ { id, distanceKm, runners, avgPaceSec, region, track: GeoPoint[] } ] }
```

> **군집 고도화(P2)**: start_cell 단순 그룹 대신 폴리라인 시그니처(격자 시퀀스 해시) 또는 Fréchet/Hausdorff 거리로 "같은 코스" 판정. v1은 출발격자+거리버킷으로 충분.

---

## 5. UI (시작 전)

`RunTracker` `ready` 단계:
- **목표 km 선택** 칩: 3 / 5 / 10 / 직접
- **"이 근처 인기 코스"** 리스트 — 각 카드:
  - 미니 경로 미리보기(`RoutePath`)
  - `{distanceKm}km · {runners}명이 달림 · 평균 {pace}`
  - **[이 코스로 시작]** → 선택 코스를 참고 경로로 들고 러닝 시작(시작 화면/기록 상세에서 표시. 실시간 비교는 범위 외)
- **빈 상태**: 후보 < K → "이 지역 첫 개척자예요. 당신의 코스가 첫 추천이 됩니다." + 그냥 시작.

---

## 6. 콜드 스타트 전략

1. **수집부터**(P0): 데이터가 0이어도 업로드 파이프라인을 먼저 깔아 누적 시작.
2. **내 기록 시드**: 앱 첫 실행 시 localStorage의 과거 런(track 있는 것)을 1회 업로드.
3. **자기 코스 폴백**: 동네 후보가 부족하면 "내가 전에 달린 코스"라도 보여줌.
4. (선택) 인기 지역 데모 코스 소수 시드.

---

## 7. 보안 / 프라이버시 체크리스트

- [ ] 클라이언트는 Supabase 직접 접근 금지 — `/api/*` 경유, service-role 키는 서버 전용
- [ ] RLS on, anon 정책 없음
- [ ] 출발/도착 ~150m 트림
- [ ] 노출 임계값 K명(distinct device) 이상
- [ ] 옵트아웃 토글
- [ ] PII 없음(익명 device_id만)

---

## 8. 단계별 로드맵

| 단계 | 내용 | 산출물 |
|------|------|--------|
| **P0 수집** | 새 Supabase 프로젝트 + `runs` 스키마/RLS + `/api/runs` + 종료 시 업로드(트림·옵트아웃) + deviceId | 데이터 누적 시작 |
| **P1 추천** | `recommend_routes` RPC + `/api/recommend` + 시작화면 km선택·추천카드·빈상태 + 내 기록 시드 | 추천 동작(데이터 쌓이는 만큼) |
| **P2 품질** | 폴리라인 시그니처 군집, 내 페이스 매칭, 코스 상세 | 추천 정확도↑ |
| **P3 확장** | 계정/소셜, 코스 저장·즐겨찾기, 리더보드 | — |

---

## 9. 시작 전 미결정(P0 들어가기 전 확정)

- **Supabase 프로젝트**: breq 전용 신규(권장, macdee와 격리) vs 기존 재사용
- **K(노출 임계 인원)**: 기본 3 제안
- **검색 반경**: 기본 400m 제안
- **지역(region) 산출**: 역지오코딩 vs 프로필 region 사용
- **보존 정책**: 트랙 원본 보관 기간

---

## 10. 참고 — 기존 코드 연결점

- 트랙 원천: `RunRecord.track: GeoPoint[]` (이미 GPS 트래커가 칼만 보정으로 채움)
- 거리 재계산: `src/gps.ts` `trackDistanceKm()`
- 업로드 트리거: `src/screens/RunTracker.tsx` `finish()/save()`
- 서버리스 패턴: `api/coach.ts` + `api/_coach.ts`(키 서버 전용) 그대로 차용
- 미리보기: `src/components/RoutePath.tsx`
</content>
</invoke>
