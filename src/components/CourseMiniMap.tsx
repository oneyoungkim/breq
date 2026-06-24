import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * 코스 위치 미니맵 — 대표 좌표에 핀을 찍은 정적 OSM 지도.
 * (실제 달린 경로 선이 아니라 "스팟 위치" 표시. 경로 geometry는 추후 단계.)
 * 비대화형(드래그·줌 잠금)이라 카드/패널에 가볍게 얹힌다.
 */
export default function CourseMiniMap({
  lat,
  lng,
  height = 132,
  zoom = 14,
}: {
  lat: number
  lng: number
  height?: number
  zoom?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    })
    map.setView([lat, lng], zoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    L.circleMarker([lat, lng], {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#173f9f',
      fillOpacity: 1,
    }).addTo(map)
    return () => {
      map.remove()
    }
  }, [lat, lng, zoom])

  return (
    <div
      ref={ref}
      style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', zIndex: 0 }}
    />
  )
}
