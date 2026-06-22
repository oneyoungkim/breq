import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint } from '../types'

/**
 * 실제 거리 지도 위에 GPS 경로를 그린다 (Leaflet + OSM 타일).
 * 타일은 온라인에서만 로드됨(폰/네이티브 정상). 오프라인이면 경로 선만 보인다.
 */
export default function RouteMap({
  points,
  className = '',
  height = 220,
}: {
  points: GeoPoint[]
  className?: string
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!ref.current || points.length < 2) return
    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number])

    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    L.polyline(latlngs, { color: '#173f9f', weight: 5, opacity: 0.95, lineJoin: 'round' }).addTo(map)

    const start = latlngs[0]
    const end = latlngs[latlngs.length - 1]
    L.circleMarker(start, { radius: 6, color: '#fff', weight: 2, fillColor: '#173f9f', fillOpacity: 1 }).addTo(map)
    L.circleMarker(end, { radius: 7, color: '#173f9f', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map)

    map.fitBounds(L.latLngBounds(latlngs).pad(0.15))

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [points])

  if (points.length < 2) return null

  return (
    <div
      ref={ref}
      className={className}
      style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', zIndex: 0 }}
    />
  )
}
