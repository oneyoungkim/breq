/**
 * 코스 위치 핀 썸네일 — Leaflet 없이 OSM 타일 1장을 깔고 실제 좌표에 핀을 찍는다.
 * 리스트 카드용 경량(이미지 1 + 점 1). 핀은 타일 내 실제 위치(frac)에 배치.
 * 줌 15 타일은 약 1.2km 범위 → 스팟 주변이 보인다.
 */
export default function CoursePin({
  lat,
  lng,
  zoom = 15,
  className = '',
}: {
  lat: number
  lng: number
  zoom?: number
  className?: string
}) {
  const n = 2 ** zoom
  const xt = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const yt = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const tx = Math.floor(xt)
  const ty = Math.floor(yt)
  const left = (xt - tx) * 100
  const top = (yt - ty) * 100
  const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`

  return (
    <div className={`relative overflow-hidden rounded-[6px] bg-card2 ${className}`}>
      <img
        src={url}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span
        className="absolute z-10 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-route"
        style={{ left: `${left}%`, top: `${top}%` }}
      />
    </div>
  )
}
