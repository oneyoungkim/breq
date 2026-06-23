# BREQ — iOS 앱 빌드 & 애플워치(HealthKit) 연동 가이드

이 문서대로만 따라 하면 됩니다. **Windows에서 끝낼 수 있는 준비는 전부 완료**되어 있고,
아래는 **맥에서만 가능한 단계**입니다.

> 핵심 개념: 애플워치에 별도 앱을 깔 필요가 없습니다. **워치가 기록한 러닝은 자동으로
> 아이폰 "건강(Health)" 앱에 쌓이고, BREQ 앱이 HealthKit으로 그 기록을 읽어옵니다.**
> 그래서 watchOS 타깃 없이 iOS 앱 하나만 만들면 됩니다.

---

## 이미 완료된 준비 (Windows)

- Capacitor v8 설치: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`
- HealthKit 플러그인 설치: `capacitor-health`
- **GPS 플러그인 설치: `@capacitor/geolocation`** (백그라운드 러닝 트래킹용)
- `capacitor.config.ts` 생성 (appId `com.lawnald.breq`, appName `BREQ`, webDir `dist`)
- HealthKit 어댑터 구현: `src/native/healthkit.ts` (권한요청 + 러닝 워크아웃 → RunRecord 매핑)
  - 앱 코드는 자동 분기: 네이티브에서 실행되면 `HealthKitProvider`, 웹에서는 목업
- npm 스크립트: `cap:add:ios`, `cap:sync`, `ios`
- 웹 빌드 통과 확인 완료

---

## 맥에서 할 일

### 0. 사전 준비
- **Xcode** 설치 (App Store) → 최초 1회 실행해 라이선스 동의
- **CocoaPods**: `sudo gem install cocoapods` (또는 `brew install cocoapods`)
- **Node.js** (Windows와 동일 버전대 권장)
- **Apple Developer 계정** ($99/년) 가입·결제

### 1. 프로젝트 가져오기
이 `runnersway` 폴더를 맥으로 복사(또는 git clone). 그다음:
```bash
cd runnersway
npm install        # 의존성 복원
npm run build      # dist 생성
```

### 2. iOS 네이티브 프로젝트 생성
```bash
npx cap add ios    # ios/ 폴더 + Xcode 프로젝트 생성 + pod install
npx cap sync ios   # 웹 빌드 + 플러그인 동기화
```

### 3. Xcode에서 HealthKit 설정
```bash
npx cap open ios   # Xcode 열림
```
Xcode에서:
1. 좌측 **App** 타깃 → **Signing & Capabilities**
   - **Team**: 본인 Apple Developer 계정 선택
   - **+ Capability** → **HealthKit** 추가
2. **Info.plist** 에 사용 사유 문자열 추가 (없으면 권한 요청 시 앱이 크래시):
   - Key: `Privacy - Health Share Usage Description`
     (`NSHealthShareUsageDescription`)
   - Value: `러닝 기록을 불러와 AI 코치가 오늘의 러닝을 해석하기 위해 건강 데이터를 읽습니다.`
   - (쓰기는 하지 않으므로 Update 설명은 불필요)

### 3.5 GPS 백그라운드 트래킹 설정 (인앱 러닝 측정)
화면을 끄거나 주머니에 넣은 채 달려도 거리·페이스가 계속 기록되게 하려면:
1. **Info.plist** 에 위치 사유 문자열 2개 추가 (없으면 권한 요청 시 크래시):
   - `Privacy - Location When In Use Usage Description` (`NSLocationWhenInUseUsageDescription`)
     Value: `러닝 중 거리·페이스·경로를 실시간으로 측정합니다.`
   - `Privacy - Location Always and When In Use Usage Description`
     (`NSLocationAlwaysAndWhenInUseUsageDescription`)
     Value: `화면을 끈 채 달려도 러닝을 끊김 없이 측정하기 위해 백그라운드 위치를 사용합니다.`
2. **App 타깃 → Signing & Capabilities → + Capability → Background Modes** 추가 후
   **Location updates** 체크 (Info.plist의 `UIBackgroundModes`에 `location` 추가됨)
3. 앱 실행 후 위치 권한을 **"항상 허용"** 으로 부여해야 백그라운드 측정이 됩니다.
   ("앱을 사용하는 동안만 허용"이면 화면을 끄면 측정이 멈출 수 있음)

> 코드는 자동 분기: 네이티브에서 실행되면 `@capacitor/geolocation`(백그라운드),
> 웹에서는 `navigator.geolocation`(포그라운드). 트래커 UI·정밀화 로직은 그대로.

### 4. 실기기에서 실행
1. 애플워치와 **페어링된 아이폰**을 케이블로 맥에 연결
   (HealthKit 데이터는 실기기에만 있음 — 시뮬레이터엔 거의 없음)
2. Xcode 상단에서 기기 선택 → **Run (▶)**
3. 아이폰: 설정 → 일반 → VPN 및 기기 관리 → 개발자 앱 **신뢰**
4. 앱 실행 → 마이 → **Apple 건강 · 애플워치 연동** → 권한 허용 →
   기록탭/AI 코치에 워치 러닝이 들어오는지 확인

### 5. (선택) TestFlight 배포
1. App Store Connect에서 앱 등록 (Bundle ID = `com.lawnald.breq`)
2. Xcode → Product → **Archive** → Distribute App → App Store Connect → Upload
3. App Store Connect → TestFlight에서 테스터 초대

---

## 코드 수정 후 반영
웹/JS 코드를 고친 뒤에는:
```bash
npm run cap:sync   # = vite build && cap sync ios
```
(또는 `npm run ios` 로 빌드+동기화+Xcode 열기 한 번에)

---

## 참고 / 주의
- **appId 변경**: `capacitor.config.ts`의 `com.lawnald.breq`를 원하는 Bundle ID로 바꾸면,
  Apple Developer에 등록한 App ID와 동일하게 맞추세요. (`cap add ios` **전에** 변경 권장)
- **권장 권한**: `READ_WORKOUTS / READ_DISTANCE / READ_HEART_RATE / READ_ACTIVE_CALORIES / READ_ROUTE`
  — 어댑터(`src/native/healthkit.ts`)에서 요청. 필요 없으면 거기서 줄여도 됨.
- **km 스플릿**: HealthKit 워크아웃엔 km 구간 데이터가 없어 평균 페이스로 균등 분할합니다.
  정밀 스플릿이 필요하면 `queryWorkouts({ includeRoute: true })`로 좌표/시간을 받아
  `src/native/healthkit.ts`에서 계산하세요.
- **인앱 실시간 GPS 추적**(러닝 트래커)은 구현 완료. 웹은 포그라운드(`navigator.geolocation`),
  네이티브는 백그라운드(`@capacitor/geolocation`)로 자동 분기됩니다. 정밀화(칼만 필터·정확도
  게이트·드리프트/순간이동 차단·벽시계 경과)는 `src/gps.ts` + `src/screens/RunTracker.tsx`,
  프로바이더 추상화는 `src/location.ts` + `src/native/geolocation.ts`. 백그라운드 측정은
  위 **3.5** 의 Info.plist/Background Modes 설정이 있어야 동작합니다.
- `npm audit`에 high 항목이 있으나 Capacitor CLI의 개발용 의존성(빌드 산출물엔 미포함)입니다.
