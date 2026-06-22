import type { Level, Meetup } from './types'

export const LEVEL_META: Record<
  Level,
  { label: string; code: string; emoji: string; color: string; desc: string; sub: string }
> = {
  slow: {
    label: '슬로우러너',
    code: 'SLOW RUNNER',
    emoji: '🌱',
    color: '#0b9e68',
    desc: '페이스보다 꾸준함이 먼저인 러너',
    sub: '오늘도 나간 것, 그게 제일 중요해요. 러너스웨이는 기록 대신 출석을 응원해요.',
  },
  easy: {
    label: '이지러너',
    code: 'EASY RUNNER',
    emoji: '🍃',
    color: '#0073e6',
    desc: '부담 없는 페이스로 즐겁게 달리는 러너',
    sub: '대화하며 달릴 수 있는 편안한 페이스. 비슷한 러너들과 함께 달려보세요.',
  },
  tempo: {
    label: '템포러너',
    code: 'TEMPO RUNNER',
    emoji: '⚡',
    color: '#6d28d9',
    desc: '페이스를 끌어올리는 중인 러너',
    sub: '기록이 늘고 있는 게 보여요. 구간 분석과 인터벌 모임을 추천해요.',
  },
  racer: {
    label: '기록러',
    code: 'RACER',
    emoji: '🔥',
    color: '#d93a0c',
    desc: '대회와 PB를 향해 달리는 러너',
    sub: '대회 준비 플랜과 빠른 페이스 그룹런으로 다음 PB를 노려보세요.',
  },
}

export function classify(paceSec: number | null, walkRun: boolean): Level {
  if (walkRun || paceSec == null) return 'slow'
  if (paceSec >= 450) return 'slow'
  if (paceSec >= 390) return 'easy'
  if (paceSec >= 330) return 'tempo'
  return 'racer'
}

export const fmtPace = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

export const fmtPaceKm = (sec: number) => `${fmtPace(sec)}/km`

export const paceRangeLabel = (min: number, max: number) =>
  `${fmtPace(min)}~${fmtPace(max)}/km`

export const fmtDuration = (minutes: number, seconds: number) =>
  seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`

export function calcPace(
  distanceKm: number,
  minutes: number,
  seconds: number,
): number | null {
  const total = minutes * 60 + seconds
  if (!distanceKm || distanceKm <= 0 || total <= 0) return null
  return Math.round(total / distanceKm)
}

/** 내 페이스가 모임 페이스 범위(±20초 여유)에 들어오는지 */
export function paceMatch(
  paceSec: number | null,
  walkRun: boolean,
  m: Pick<Meetup, 'paceMin' | 'paceMax' | 'beginnerOk'>,
): boolean {
  if (walkRun || paceSec == null) return m.beginnerOk && m.paceMax >= 450
  return paceSec >= m.paceMin - 20 && paceSec <= m.paceMax + 20
}

/** 모임이 내 페이스보다 빠른지 (주의 배너용) */
export function tooFastForMe(
  paceSec: number | null,
  walkRun: boolean,
  m: Pick<Meetup, 'paceMin' | 'paceMax'>,
): boolean {
  if (walkRun || paceSec == null) return m.paceMax < 450
  return m.paceMax + 20 < paceSec
}

export function hashtags(level: Level, region: string, withCrew: boolean): string[] {
  const tags = ['#오런완', '#BREQ', '#베스트런에버']
  if (level === 'slow' || level === 'easy')
    tags.push('#슬로우런', '#눈치보지않는러닝', '#걷뛰')
  else tags.push('#페이스훈련', '#기록갱신', '#러닝기록')
  const hangang = ['반포', '잠원', '여의도', '뚝섬', '미사', '잠실']
  if (hangang.some((h) => region.includes(h))) tags.push('#한강러닝')
  else if (region) tags.push(`#${region.split(/[·\s]/)[0]}러닝`)
  if (withCrew) tags.push('#러닝크루')
  return tags
}

export const REGION_GROUPS: Record<string, string[]> = {
  서울: [
    '반포·잠원',
    '여의도',
    '뚝섬·성수',
    '석촌호수·잠실',
    '강남·양재천',
    '올림픽공원',
    '안양천·목동',
    '불광천·상암',
    '경의선숲길·연남',
    '북서울꿈의숲',
  ],
  경기: [
    '일산호수공원',
    '광교호수공원',
    '동탄호수공원',
    '분당 탄천',
    '평촌 학의천',
    '미사 한강공원',
    '수원 만석공원',
  ],
  인천: ['송도 센트럴파크', '청라호수공원', '부평 굴포천', '인천대공원'],
  부산: ['광안리·민락', '해운대·마린시티', '삼락생태공원', '온천천', '다대포'],
  대구: ['수성못', '신천 둔치', '두류공원', '금호강'],
  대전: ['갑천', '유림공원', '엑스포공원', '대청호반'],
  광주: ['광주천', '풍암호수', '첨단호수공원'],
  울산: ['태화강 국가정원', '선암호수공원', '일산해수욕장'],
  세종: ['세종호수공원', '금강보행교'],
  강원: ['춘천 의암호', '강릉 경포호', '원주 따뚜공원'],
  충청: ['청주 무심천', '천안천', '아산 신정호'],
  전라: ['전주천', '여수 웅천', '목포 평화광장', '군산 은파호수'],
  경상: ['창원 용지호수', '김해 연지공원', '포항 영일대', '경주 보문호'],
  제주: ['제주 시민복지타운', '서귀포 올레', '함덕·삼양'],
}

export const PACE_PRESETS: { label: string; sec: number }[] = [
  { label: '4:30', sec: 270 },
  { label: '5:00', sec: 300 },
  { label: '5:30', sec: 330 },
  { label: '6:00', sec: 360 },
  { label: '6:30', sec: 390 },
  { label: '7:00', sec: 420 },
  { label: '7:30', sec: 450 },
  { label: '8:00', sec: 480 },
  { label: '8:30+', sec: 510 },
]
