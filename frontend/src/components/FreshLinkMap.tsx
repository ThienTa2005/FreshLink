import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import './FreshLinkMap.css'

export interface ColdChainHubPoint {
  hubId?: number | string
  code?: string
  name: string
  type?: string
  address?: string
  district?: string
  city?: string
  latitude: number
  longitude: number
  temperatureC?: number
  temperatureRange?: string
  humidityPercent?: number
  capacityCrates?: number
  activeTrucks?: number
  status?: string
  phone?: string
  managerName?: string
}

export interface TripStopMapPoint {
  trip_stop_id?: number | string
  stop_sequence: number
  order_code?: string
  restaurant_name?: string
  address_name?: string
  address_line?: string
  district?: string
  city?: string
  contact_name?: string
  contact_phone?: string
  latitude?: number | null
  longitude?: number | null
  status?: string
  actual_arrival_at?: string | null
}

export interface VehicleMapPoint {
  vehicle_id?: number | string
  vehicle_code: string
  driver_name: string
  driver_phone?: string
  latitude: number
  longitude: number
  temperatureC?: number
  speedKmH?: number
  status?: string
}

export interface FreshLinkMapProps {
  title?: string
  subtitle?: string
  hubs?: ColdChainHubPoint[]
  stops?: TripStopMapPoint[]
  origin?: {
    name?: string
    address_line?: string
    district?: string
    city?: string
    latitude?: number | null
    longitude?: number | null
  }
  vehicles?: VehicleMapPoint[]
  height?: string
  zoom?: number
  center?: [number, number]
  showLegend?: boolean
  showToolbar?: boolean
  showFitBounds?: boolean
  onStopClick?: (stop: TripStopMapPoint) => void
  onHubClick?: (hub: ColdChainHubPoint) => void
}

// Fallback coordinates for common districts in Vietnam if not explicitly geocoded
const DISTRICT_GEO_FALLBACKS: Record<string, [number, number]> = {
  'đông anh': [21.1458, 105.8452],
  'hoàng mai': [20.9782, 105.8546],
  'cầu giấy': [21.0362, 105.7906],
  'ba đình': [21.0341, 105.8242],
  'hoàn kiếm': [21.0285, 105.8542],
  'đống đa': [21.0181, 105.8275],
  'hai bà trưng': [21.0069, 105.8542],
  'tây hồ': [21.0664, 105.8222],
  'thanh xuân': [20.9937, 105.8083],
  'hà đông': [20.9668, 105.7666],
  'long biên': [21.0428, 105.8856],
  'nam từ liêm': [21.0152, 105.7675],
  'bắc từ liêm': [21.0617, 105.7578],
  'mộc châu': [20.8436, 104.6642],
  'sơn la': [21.3283, 103.9148],
  'đà lạt': [11.9404, 108.4182],
  'lâm đồng': [11.6667, 107.8333],
  'củ chi': [10.9632, 106.5298],
  'thủ đức': [10.8494, 106.7725],
  'quận 1': [10.7769, 106.7009],
  'quận 7': [10.7340, 106.7219],
  'bình thạnh': [10.8016, 106.6984]
}

function resolveCoordinates(
  lat?: number | null,
  lng?: number | null,
  district?: string,
  city?: string,
  indexSeed = 0
): [number, number] {
  if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && Number(lat) !== 0 && Number(lng) !== 0) {
    return [Number(lat), Number(lng)]
  }
  const dKey = (district ?? '').toLowerCase().trim()
  for (const [key, coords] of Object.entries(DISTRICT_GEO_FALLBACKS)) {
    if (dKey.includes(key)) {
      // Small jitter so overlapping markers are separated
      const jitter = (indexSeed % 7 - 3) * 0.005
      return [coords[0] + jitter, coords[1] + jitter]
    }
  }
  const cKey = (city ?? '').toLowerCase().trim()
  if (cKey.includes('hồ chí minh') || cKey.includes('hcm')) {
    return [10.7769 + (indexSeed % 5) * 0.008, 106.7009 + (indexSeed % 5) * 0.008]
  }
  // Default Hanoi
  return [21.0285 + (indexSeed % 5) * 0.007, 105.8542 + (indexSeed % 5) * 0.007]
}

export const FreshLinkMap: React.FC<FreshLinkMapProps> = ({
  title,
  subtitle,
  hubs = [],
  stops = [],
  origin,
  vehicles = [],
  height = '440px',
  zoom,
  center,
  showLegend = true,
  showToolbar = true,
  showFitBounds = true,
  onStopClick,
  onHubClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HUBS' | 'STOPS' | 'VEHICLES'>('ALL')
  const [mapLayerType, setMapLayerType] = useState<'STREET' | 'SATELLITE'>('STREET')

  const tileLayerRef = useRef<L.TileLayer | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return

    const defaultCenter: [number, number] = center || [21.0285, 105.8542]
    const defaultZoom = zoom || (stops.length > 0 ? 12 : 6)

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const tileUrl =
      mapLayerType === 'SATELLITE'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19
    })
    tileLayer.addTo(map)
    tileLayerRef.current = tileLayer

    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      tileLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tile layer when mapLayerType changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current)
    }

    const tileUrl =
      mapLayerType === 'SATELLITE'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'

    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19
    })
    newTileLayer.addTo(map)
    tileLayerRef.current = newTileLayer
  }, [mapLayerType])

  // Update Markers and Routes whenever data or filter changes
  useEffect(() => {
    const map = mapInstanceRef.current
    const lg = layerGroupRef.current
    if (!map || !lg) return

    lg.clearLayers()
    const boundsPoints: [number, number][] = []

    // 1. RENDER HUBS
    if (activeFilter === 'ALL' || activeFilter === 'HUBS') {
      hubs.forEach(hub => {
        const coords: [number, number] = [hub.latitude, hub.longitude]
        boundsPoints.push(coords)

        const isWarning = hub.temperatureC != null && (hub.temperatureC > 6 || hub.temperatureC < 2)
        const tempText = hub.temperatureC != null ? `+${hub.temperatureC.toFixed(1)}°C` : '+3.4°C'

        const hubHtml = `
          <div class="fl-marker-hub">
            <div class="fl-marker-hub-pulse"></div>
            <div class="fl-marker-hub-icon">
              <span class="material-symbols-outlined" style="font-size: 20px;">warehouse</span>
            </div>
            <div class="fl-marker-temp-badge ${isWarning ? 'warning' : ''}">
              ${tempText}
            </div>
          </div>
        `

        const hubIcon = L.divIcon({
          html: hubHtml,
          className: 'fl-hub-div-icon',
          iconSize: [44, 60],
          iconAnchor: [22, 30],
          popupAnchor: [0, -32]
        })

        const marker = L.marker(coords, { icon: hubIcon })

        const popupContent = `
          <div class="fl-popup-card">
            <div class="fl-popup-title">
              <span>${hub.name}</span>
              <span style="font-size:11px;font-weight:700;color:#005131;background:#d7f5e7;padding:2px 8px;border-radius:12px;">${hub.code || 'HUB'}</span>
            </div>
            <div class="fl-popup-address">${hub.address || `${hub.district || ''}, ${hub.city || ''}`}</div>
            <div class="fl-popup-metrics">
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Nhiệt độ kho</span>
                <span class="fl-popup-metric-val">${tempText}</span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Độ ẩm</span>
                <span class="fl-popup-metric-val">${hub.humidityPercent || 88}%</span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Sức chứa</span>
                <span class="fl-popup-metric-val">${(hub.capacityCrates || 2500).toLocaleString()} thùng</span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Xe xuất bến</span>
                <span class="fl-popup-metric-val">${hub.activeTrucks || 12} xe</span>
              </div>
            </div>
            <div class="fl-popup-actions">
              <a href="tel:${hub.phone || '0123456789'}" class="fl-popup-btn fl-popup-btn-outline">
                <span class="material-symbols-outlined" style="font-size:14px;">call</span>
                Gọi kho
              </a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}" target="_blank" class="fl-popup-btn fl-popup-btn-primary">
                <span class="material-symbols-outlined" style="font-size:14px;">navigation</span>
                Chỉ đường
              </a>
            </div>
          </div>
        `

        marker.bindPopup(popupContent)
        if (onHubClick) {
          marker.on('click', () => onHubClick(hub))
        }
        marker.addTo(lg)
      })
    }

    // 2. RENDER ORIGIN (IF TRIP ORIGIN SPECIFIED)
    let originCoords: [number, number] | null = null
    if (origin && (activeFilter === 'ALL' || activeFilter === 'STOPS')) {
      originCoords = resolveCoordinates(
        origin.latitude,
        origin.longitude,
        origin.district,
        origin.city,
        0
      )
      boundsPoints.push(originCoords)

      const originHtml = `
        <div class="fl-marker-hub">
          <div class="fl-marker-hub-icon" style="background:#005131;">
            <span class="material-symbols-outlined" style="font-size: 20px;">home_work</span>
          </div>
          <div class="fl-marker-temp-badge">Xuất phát: ${origin.name || 'Hub tập kết'}</div>
        </div>
      `
      const originIcon = L.divIcon({
        html: originHtml,
        className: 'fl-origin-div-icon',
        iconSize: [44, 60],
        iconAnchor: [22, 30],
        popupAnchor: [0, -32]
      })

      const originMarker = L.marker(originCoords, { icon: originIcon })
      originMarker.bindPopup(`
        <div class="fl-popup-card">
          <div class="fl-popup-title">Điểm xuất phát chuyến: ${origin.name || 'Hub Cross-dock'}</div>
          <div class="fl-popup-address">${origin.address_line || ''}, ${origin.district || ''}, ${origin.city || ''}</div>
        </div>
      `)
      originMarker.addTo(lg)
    }

    // 3. RENDER TRIP STOPS & CONNECTING ROUTE
    const routeCoords: [number, number][] = []
    if (originCoords) {
      routeCoords.push(originCoords)
    }

    if (activeFilter === 'ALL' || activeFilter === 'STOPS') {
      stops.forEach((stop, idx) => {
        const coords = resolveCoordinates(
          stop.latitude,
          stop.longitude,
          stop.district,
          stop.city,
          idx + 1
        )
        boundsPoints.push(coords)
        routeCoords.push(coords)

        const statusClass =
          stop.status === 'DELIVERED'
            ? 'delivered'
            : stop.status === 'FAILED'
            ? 'failed'
            : 'pending'

        const statusLabel =
          stop.status === 'DELIVERED'
            ? 'Đã giao'
            : stop.status === 'FAILED'
            ? 'Thất bại'
            : 'Chờ giao'

        const stopHtml = `
          <div class="fl-marker-stop">
            <div class="fl-marker-stop-pin ${statusClass}">
              ${stop.stop_sequence}
            </div>
            <div class="fl-marker-stop-label">
              ${stop.restaurant_name || stop.address_name || `Điểm #${stop.stop_sequence}`}
            </div>
          </div>
        `

        const stopIcon = L.divIcon({
          html: stopHtml,
          className: 'fl-stop-div-icon',
          iconSize: [36, 50],
          iconAnchor: [18, 25],
          popupAnchor: [0, -28]
        })

        const marker = L.marker(coords, { icon: stopIcon })

        const popupContent = `
          <div class="fl-popup-card">
            <div class="fl-popup-title">
              <span>Điểm #${stop.stop_sequence}: ${stop.restaurant_name || stop.address_name || 'Nhà hàng'}</span>
            </div>
            <div class="fl-popup-address">${stop.address_line || ''}, ${stop.district || ''}, ${stop.city || ''}</div>
            <div class="fl-popup-metrics">
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Trạng thái</span>
                <span class="fl-popup-metric-val" style="color:${stop.status === 'DELIVERED' ? '#10b981' : stop.status === 'FAILED' ? '#ef4444' : '#f59e0b'};">
                  ${statusLabel}
                </span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Mã đơn hàng</span>
                <span class="fl-popup-metric-val">${stop.order_code || '-'}</span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Người nhận</span>
                <span class="fl-popup-metric-val">${stop.contact_name || 'Đại diện bếp'}</span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Số điện thoại</span>
                <span class="fl-popup-metric-val">${stop.contact_phone || '-'}</span>
              </div>
            </div>
            <div class="fl-popup-actions">
              ${
                stop.contact_phone
                  ? `<a href="tel:${stop.contact_phone}" class="fl-popup-btn fl-popup-btn-outline">
                      <span class="material-symbols-outlined" style="font-size:14px;">call</span>
                      Gọi người nhận
                    </a>`
                  : ''
              }
              <a href="https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}" target="_blank" class="fl-popup-btn fl-popup-btn-primary">
                <span class="material-symbols-outlined" style="font-size:14px;">navigation</span>
                Chỉ đường
              </a>
            </div>
          </div>
        `

        marker.bindPopup(popupContent)
        if (onStopClick) {
          marker.on('click', () => onStopClick(stop))
        }
        marker.addTo(lg)
      })

      // Draw polyline route connecting origin and stops
      if (routeCoords.length >= 2) {
        // Shadow/glow line
        L.polyline(routeCoords, {
          color: 'rgba(0, 81, 49, 0.25)',
          weight: 7,
          opacity: 0.6,
          lineJoin: 'round'
        }).addTo(lg)

        // Main Route line
        L.polyline(routeCoords, {
          color: '#005131',
          weight: 4,
          dashArray: '6, 8',
          opacity: 0.9,
          lineJoin: 'round'
        }).addTo(lg)
      }
    }

    // 4. RENDER VEHICLES
    if (activeFilter === 'ALL' || activeFilter === 'VEHICLES') {
      vehicles.forEach(veh => {
        const coords: [number, number] = [veh.latitude, veh.longitude]
        boundsPoints.push(coords)

        const vehHtml = `
          <div class="fl-marker-vehicle">
            <div class="fl-marker-vehicle-pin">
              <span class="material-symbols-outlined" style="font-size: 20px;">local_shipping</span>
            </div>
            <div class="fl-marker-temp-badge">
              ${veh.vehicle_code} (${veh.temperatureC ? `+${veh.temperatureC}°C` : '+3.8°C'})
            </div>
          </div>
        `

        const vehIcon = L.divIcon({
          html: vehHtml,
          className: 'fl-veh-div-icon',
          iconSize: [40, 56],
          iconAnchor: [20, 28],
          popupAnchor: [0, -30]
        })

        const marker = L.marker(coords, { icon: vehIcon })
        marker.bindPopup(`
          <div class="fl-popup-card">
            <div class="fl-popup-title">
              <span>Xe lạnh: ${veh.vehicle_code}</span>
              <span style="font-size:11px;color:#0284c7;background:#e0f2fe;padding:2px 6px;border-radius:10px;">${veh.status || 'Đang giao'}</span>
            </div>
            <div class="fl-popup-address">Tài xế: <b>${veh.driver_name}</b> · ${veh.driver_phone || ''}</div>
            <div class="fl-popup-metrics">
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Nhiệt độ thùng xe</span>
                <span class="fl-popup-metric-val">+${veh.temperatureC || 3.8}°C</span>
              </div>
              <div class="fl-popup-metric-item">
                <span class="fl-popup-metric-label">Vận tốc</span>
                <span class="fl-popup-metric-val">${veh.speedKmH || 42} km/h</span>
              </div>
            </div>
          </div>
        `)
        marker.addTo(lg)
      })
    }

    // Auto-fit bounds if requested
    if (showFitBounds && boundsPoints.length > 0) {
      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], zoom || 13)
      } else {
        const bounds = L.latLngBounds(boundsPoints)
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      }
    }
  }, [hubs, stops, origin, vehicles, activeFilter, showFitBounds, zoom, onHubClick, onStopClick])

  const handleFitAll = () => {
    const map = mapInstanceRef.current
    if (!map) return

    const points: [number, number][] = []
    hubs.forEach(h => points.push([h.latitude, h.longitude]))
    stops.forEach((s, idx) => points.push(resolveCoordinates(s.latitude, s.longitude, s.district, s.city, idx + 1)))
    if (origin) {
      points.push(resolveCoordinates(origin.latitude, origin.longitude, origin.district, origin.city, 0))
    }
    vehicles.forEach(v => points.push([v.latitude, v.longitude]))

    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 })
    }
  }

  return (
    <div className="freshlink-map-wrapper" style={{ minHeight: height }}>
      {showToolbar && (
        <div className="freshlink-map-header">
          <div className="freshlink-map-title-group">
            <span className="material-symbols-outlined" style={{ color: '#005131', fontSize: 22 }}>
              map
            </span>
            <div>
              <h4 className="freshlink-map-title">{title || 'Bản đồ Mạng lưới Chuỗi Lạnh FreshLink'}</h4>
              {subtitle && <div className="freshlink-map-subtitle">{subtitle}</div>}
            </div>
          </div>

          <div className="freshlink-map-toolbar">
            <button
              className={`map-filter-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('ALL')}
            >
              Tất cả ({hubs.length + stops.length + vehicles.length})
            </button>
            {hubs.length > 0 && (
              <button
                className={`map-filter-pill ${activeFilter === 'HUBS' ? 'active' : ''}`}
                onClick={() => setActiveFilter('HUBS')}
              >
                Kho & Hub ({hubs.length})
              </button>
            )}
            {stops.length > 0 && (
              <button
                className={`map-filter-pill ${activeFilter === 'STOPS' ? 'active' : ''}`}
                onClick={() => setActiveFilter('STOPS')}
              >
                Điểm giao ({stops.length})
              </button>
            )}
            {vehicles.length > 0 && (
              <button
                className={`map-filter-pill ${activeFilter === 'VEHICLES' ? 'active' : ''}`}
                onClick={() => setActiveFilter('VEHICLES')}
              >
                Xe lạnh ({vehicles.length})
              </button>
            )}

            <button
              className="map-action-btn"
              title="Khớp khung nhìn toàn bộ điểm"
              onClick={handleFitAll}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                crop_free
              </span>
            </button>

            <button
              className="map-action-btn"
              title={`Chuyển lớp bản đồ (${mapLayerType === 'STREET' ? 'Bản đồ đường bộ Logistics' : 'Bản đồ không ảnh Vệ tinh'})`}
              onClick={() => setMapLayerType(mapLayerType === 'STREET' ? 'SATELLITE' : 'STREET')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                layers
              </span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="freshlink-map-container"
        style={{ height }}
      />

      {showLegend && (
        <div className="freshlink-map-legend">
          <div className="legend-item">
            <span className="legend-dot purple"></span>
            <span>Kho trung tâm & Cross-dock (+2°C ~ +6°C)</span>
          </div>
          {stops.length > 0 && (
            <>
              <div className="legend-item">
                <span className="legend-dot green"></span>
                <span>Điểm giao thành công</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot amber"></span>
                <span>Điểm chờ giao</span>
              </div>
            </>
          )}
          {vehicles.length > 0 && (
            <div className="legend-item">
              <span className="legend-dot blue"></span>
              <span>Xe lạnh vệ tinh IoT</span>
            </div>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#88958c' }}>
            Bản đồ Logistics Chuỗi Lạnh B2B (Miễn phí 100%)
          </span>
        </div>
      )}
    </div>
  )
}
