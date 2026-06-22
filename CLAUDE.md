# BREQ — Best Run Ever Quest

> 이 파일은 다른 컴퓨터(예: 맥)의 Claude Code가 작업을 그대로 이어받도록 하는 핸드오프 문서입니다.

## 제품
페이스를 **존중**하는 러닝 앱. 철학: "최고의 러닝은 가장 빠른 기록이 아니라, 나에게 맞는 페이스를 찾는 질문이다." 느린 러너에겐 속도 대신 출석·꾸준함을, 기록러에겐 페이스·스플릿을. 한국어 UI.
- 디자인 톤: 코발트 블루 / 잉크 블랙 / 콘크리트 오프화이트. 도시적·미니멀·프리미엄. 둥글둥글/파스텔/귀여움 금지(radius 작게). 데이터 기반(그리드·페이스라인·지도).
- 카피: 짧고 날카롭게. 불필요한 설명문·가짜 수치 금지.

## 스택 / 실행
Vite 6 + React 18 + TypeScript + Tailwind v4. 모바일 웹(폰 프레임). 백엔드 없음(localStorage).
```bash
npm install          # 맥에서 최초 1회
npm run dev          # http://localhost:5173 (개발)
npm run dev:phone    # https LAN (폰 실제 GPS 테스트) — https://<PC-IP>:5180
npm run build        # 타입체크는 npx tsc --noEmit
```

## 구조 (핵심 파일)
- `src/App.tsx` — 탭 라우팅(모임/크루/기록/인증/마이), 인트로, 트래커/코칭/랭킹/유저갤러리 오버레이
- `src/screens/Intro.tsx` — GPS 라인 드로잉 + BREQ 타이포 + 단어 리빌 + 수증기
- `src/screens/RunLog.tsx` — 기록 탭. 상단 **AI 러닝 리뷰** 카드 + 기록 목록 + `RunDetail`(BREQ Coach 섹션 + 실제 지도)
- `src/screens/RunTracker.tsx` — **실제 GPS 러닝 트래커**(watchPosition+haversine, 정확도 게이트·드리프트 차단·롤링 페이스), 시뮬레이션 폴백
- `src/screens/Cert.tsx` — 인증카드. 6템플릿(minimal/route/photo/pride/crew/race)×4배경(light/dark/blue/photo)×2비율(9:16/4:5). 해상도 독립 canvas `drawCard`
- `src/screens/ProfileScreen.tsx` — 마이. 러너정보(AI코치용) + 워치·앱 연동
- `src/aiCoach.ts` — AI 코치(목업). `reviewRun(CoachContext)→RunReview`. 톤: care(슬로우)/perform(기록러)
- `src/health.ts` + `src/native/healthkit.ts` — 워치/건강 연동. `HealthProvider`(Mock/HealthKit). capacitor-health 어댑터
- `src/components/RoutePath.tsx` — 실제 트랙 정확축척 SVG 경로 + `trackDistanceKm()`
- `src/components/RouteMap.tsx` — Leaflet+OSM 실제 거리 지도
- `src/runs.ts` — 기록 저장/로드. `allRecentRuns()`(앱런 + 건강캐시)
- `src/types.ts` — `RunRecord`(track:GeoPoint[] 포함), `RunInput`, `AthleteInfo`, `CertTemplate/Theme/Ratio`

## "실제로 교체" 지점 (목업 → 프로덕션)
- **AI**: `aiCoach.ts`의 `reviewRun` → `fetchCoachReview`(buildCoachPrompt 포함, OpenAI 호출 자리)로. `RunReview` 계약 동일 → UI 무변경
- **워치/건강**: `getHealthProvider()`가 네이티브에서 `HealthKitProvider`(capacitor-health) 자동 선택. 웹은 Mock
- **백그라운드 GPS**: 아직 미구현. 네이티브에서 `@capacitor/geolocation` 백그라운드 위치 필요(웹은 화면 켠 포그라운드만 측정됨)

## 네이티브 iOS (맥에서)
**`IOS_SETUP.md` 참고.** Capacitor v8(core/cli/ios) + `capacitor-health` + `leaflet` 설치됨. `capacitor.config.ts`(appId `com.lawnald.breq`, webDir `dist`).
```bash
npm install && npm run build
npx cap add ios      # ios/ 생성 (맥 전용, CocoaPods 필요)
npx cap open ios     # Xcode → HealthKit capability + Info.plist NSHealthShareUsageDescription + Team → 실기기 Run
```
워치 앱 불필요: 워치→건강앱→HealthKit으로 러닝을 읽어옴.

## 데이터 모델 핵심
- `RunRecord.track: GeoPoint[]` — 실제 GPS 경로(지도/경로/인증카드 렌더 원천)
- 인증카드는 **BREQ로 측정했거나 연동된 기록으로만** 생성(직접 입력 불가 — 조작 방지)
- localStorage 키: `runnersway.profile / .runs / .healthRuns / .integrations / .healthSync / .athlete / .goal / .gallery / .introQuote`

## 다음 후보
- 네이티브 `@capacitor/geolocation` 백그라운드 트래킹(주머니/화면끔 러닝)
- 실제 AI API 연동(aiCoach 교체)
- 고도(elevation) 정확 산출(현재 GPS 고도 노이즈로 미표시)
