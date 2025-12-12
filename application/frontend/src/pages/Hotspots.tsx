import React, { useState, useEffect, useMemo } from 'react';
import { MapIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { TileLayer, CircleMarker, HeatmapLayer, Popup } from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { apiService } from '../services/api';
import hotspotDataRaw from '../utils/HOTSPOT_FINAL_DATA.json';

interface FishingCell {
  lat: number;
  lon: number;
  fishing_hours: number;
}

interface Hotspot {
  lat: number;
  lon: number;
  cluster: number;
  count?: number;
}

interface AISEvent {
  gap_start_lon: number;
  gap_start_lat: number;
  gap_start_timestamp?: string;
  mmsi?: string;
}

interface HotspotDataFile {
  metadata?: {
    selected_year?: number;
    selected_month?: number;
    selected_month_fishing_hours?: number;
    selected_month_ais_events?: number;
    num_fishing_cells?: number;
    num_ais_events?: number;
    num_fishing_clusters?: number;
    num_ais_clusters?: number;
  };
  temporal_summary?: Array<{ year: number; month: number; hrs: number; ais_events: number }>;
  fishing_cells?: Array<{ lat: number; lon: number; fishing_hours: number }>;
  fishing_cluster_centers?: Array<{ cluster: number; lat: number; lon: number }>;
  fishing_cluster_summary?: any;
  fishing_heatmap_grid?: any;
  fishing_top2?: any;
  ais_events?: Array<{
    gap_id?: string;
    mmsi?: number;
    gap_start_lat?: number;
    gap_start_lon?: number;
    gap_start_timestamp?: string;
    year?: number;
    month?: number;
  }>;
  ais_unique_points?: Array<{ lat: number; lon: number; cluster: number }>;
  ais_cluster_centers?: Array<{ cluster: number; lat: number; lon: number }>;
  ais_cluster_summary?: any;
}

interface HotspotData {
  status: string;
  year: number;
  month: number;
  fishing_cells: FishingCell[];
  fishing_hotspots: Hotspot[];
  ais_events: AISEvent[];
  ais_hotspots: Hotspot[];
  summary: {
    total_fishing_cells: number;
    total_ais_events: number;
    fishing_hotspot_count: number;
    ais_hotspot_count: number;
  };
}

const hotspotData = hotspotDataRaw as HotspotDataFile;

// Helper function to get hotspot color based on intensity (0-1)
const getHotspotColor = (intensity: number): string => {
  if (intensity <= 0.25) {
    const ratio = intensity / 0.25;
    const r = Math.round(34 + (220 - 34) * ratio);
    const g = Math.round(197 + (220 - 197) * ratio);
    const b = Math.round(34 + (20 - 34) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity <= 0.5) {
    const ratio = (intensity - 0.25) / 0.25;
    const r = Math.round(220 + (255 - 220) * ratio);
    const g = Math.round(220 + (255 - 220) * ratio);
    const b = Math.round(20 - 20 * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity <= 0.75) {
    const ratio = (intensity - 0.5) / 0.25;
    const r = 255;
    const g = Math.round(255 - (140 - 100) * ratio);
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const ratio = (intensity - 0.75) / 0.25;
    const r = 255;
    const g = Math.round(140 - 140 * ratio);
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }
};

// Helper function to get hotspot opacity based on intensity
const getHotspotOpacity = (intensity: number): number => {
  return 0.3 + (intensity * 0.6);
};

// Helper function to get hotspot radius based on intensity
const getHotspotRadius = (intensity: number): number => {
  return 8 + (intensity * 17);
};

const Hotspots: React.FC = () => {
  const [data, setData] = useState<HotspotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startYear, setStartYear] = useState(2017);
  const [endYear, setEndYear] = useState(2019);
  const [showFishingHeatmap, setShowFishingHeatmap] = useState(true);
  const [showFishingHotspots, setShowFishingHotspots] = useState(true);
  const [showAISEvents, setShowAISEvents] = useState(true);
  const [showAISHotspots, setShowAISHotspots] = useState(true);

  useEffect(() => {
    loadHotspots();
  }, [startYear, endYear]);

  const loadHotspots = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use local hotspot data from JSON file
      const metadata = hotspotData.metadata || {};
      const selectedYear = metadata.selected_year || 2017;
      const selectedMonth = metadata.selected_month || 9;
      
      // Process fishing cells
      const fishingCells: FishingCell[] = (hotspotData.fishing_cells || []).map((cell: any) => ({
        lat: cell.lat || 0,
        lon: cell.lon || 0,
        fishing_hours: cell.fishing_hours || 0,
      }));
      
      // Process fishing cluster centers as hotspots
      const fishingHotspots: Hotspot[] = (hotspotData.fishing_cluster_centers || []).map((cluster: any) => ({
        lat: cluster.lat || 0,
        lon: cluster.lon || 0,
        cluster: cluster.cluster || 0,
      }));
      
      // Process AIS events
      const aisEvents: AISEvent[] = (hotspotData.ais_events || [])
        .filter((event: any) => event.gap_start_lat != null && event.gap_start_lon != null)
        .map((event: any) => ({
          gap_start_lat: event.gap_start_lat || 0,
          gap_start_lon: event.gap_start_lon || 0,
          gap_start_timestamp: event.gap_start_timestamp || event.ts || '',
          mmsi: event.mmsi ? String(event.mmsi) : undefined,
        }));
      
      // Process AIS cluster centers as hotspots
      const aisHotspots: Hotspot[] = (hotspotData.ais_cluster_centers || []).map((cluster: any) => ({
        lat: cluster.lat || 0,
        lon: cluster.lon || 0,
        cluster: cluster.cluster || 0,
      }));
      
      // Build summary
      const summary = {
        total_fishing_cells: metadata.num_fishing_cells || fishingCells.length,
        total_ais_events: metadata.num_ais_events || aisEvents.length,
        fishing_hotspot_count: metadata.num_fishing_clusters || fishingHotspots.length,
        ais_hotspot_count: metadata.num_ais_clusters || aisHotspots.length,
      };
      
      const processedData: HotspotData = {
        status: 'success',
        year: selectedYear,
        month: selectedMonth,
        fishing_cells: fishingCells,
        fishing_hotspots: fishingHotspots,
        ais_events: aisEvents,
        ais_hotspots: aisHotspots,
        summary: summary,
      };
      
      setData(processedData);
      console.log('Hotspot data loaded from local file:', {
        fishingCells: fishingCells.length,
        fishingHotspots: fishingHotspots.length,
        aisEvents: aisEvents.length,
        aisHotspots: aisHotspots.length,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load hotspots');
      console.error('Error loading hotspots:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate map bounds from data using useMemo to avoid recalculating
  const bounds = useMemo(() => {
    if (!data || data.fishing_cells.length === 0) {
      return { center: [20, 0] as [number, number], zoom: 2 };
    }
    
    // Use a sample of cells for bounds calculation to avoid stack overflow
    // Sample up to 10000 cells for performance
    const sampleSize = Math.min(10000, data.fishing_cells.length);
    const sampleCells = data.fishing_cells.slice(0, sampleSize);
    
    // Calculate min/max without spread operator to avoid stack overflow
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    
    for (const cell of sampleCells) {
      if (cell.lat != null && !isNaN(cell.lat)) {
        minLat = Math.min(minLat, cell.lat);
        maxLat = Math.max(maxLat, cell.lat);
      }
      if (cell.lon != null && !isNaN(cell.lon)) {
        minLon = Math.min(minLon, cell.lon);
        maxLon = Math.max(maxLon, cell.lon);
      }
    }
    
    // If no valid coordinates found, use default
    if (minLat === Infinity || minLon === Infinity) {
      return { center: [20, 0] as [number, number], zoom: 2 };
    }
    
    const center: [number, number] = [
      (maxLat + minLat) / 2,
      (maxLon + minLon) / 2,
    ];
    
    return { center, zoom: 3 };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Spatial-Temporal Hotspots</h1>
        <p className="mt-1 text-sm text-gray-500">
          Global fishing activity hotspots and AIS disabling events (2017-2019)
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Year
            </label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value) || 2017)}
              min={2010}
              max={2025}
              className="input-field w-24"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Year
            </label>
            <input
              type="number"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value) || 2019)}
              min={2010}
              max={2025}
              className="input-field w-24"
            />
          </div>

          <div className="flex gap-2 items-end">
            <button 
              onClick={loadHotspots}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Layer Controls */}
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showFishingHeatmap}
              onChange={(e) => setShowFishingHeatmap(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Fishing Heatmap</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showFishingHotspots}
              onChange={(e) => setShowFishingHotspots(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Fishing Hotspots</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAISEvents}
              onChange={(e) => setShowAISEvents(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">AIS Events</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAISHotspots}
              onChange={(e) => setShowAISHotspots(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">AIS Hotspots</span>
          </label>
        </div>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapIcon className="h-8 w-8 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Peak Month
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {data.year}-{String(data.month).padStart(2, '0')}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapIcon className="h-8 w-8 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Fishing Cells
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {data.summary.total_fishing_cells.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    AIS Events
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {data.summary.total_ais_events.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapIcon className="h-8 w-8 text-orange-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Hotspots Detected
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {data.summary.fishing_hotspot_count + data.summary.ais_hotspot_count}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Map */}
      <div className="card p-0">
        <div className="h-[600px] w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Loading hotspot data...</p>
            </div>
          ) : data ? (
            <MapWrapper
              center={bounds.center}
              zoom={bounds.zoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Fishing Heatmap */}
              {showFishingHeatmap && data.fishing_cells.slice(0, 10000).map((cell, idx) => {
                // Calculate intensity based on fishing hours (normalize to 0-1)
                const maxHours = 1000; // Adjust based on your data range
                const intensity = Math.min(1.0, cell.fishing_hours / maxHours);
                const color = getHotspotColor(intensity);
                const opacity = getHotspotOpacity(intensity);
                const radius = Math.max(3, Math.min(12, getHotspotRadius(intensity) * 0.5));
                
                return (
                  <CircleMarker
                    key={`fishing-${idx}`}
                    center={[cell.lat, cell.lon]}
                    radius={radius}
                    color={color}
                    fillColor={color}
                    fillOpacity={opacity}
                    weight={1}
                  >
                    <Popup>
                      <div>
                        <strong>Fishing Activity</strong><br />
                        Hours: {cell.fishing_hours.toFixed(1)}<br />
                        Location: {cell.lat.toFixed(3)}, {cell.lon.toFixed(3)}<br />
                        Intensity: {(intensity * 100).toFixed(1)}%
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {/* Fishing Hotspots */}
              {showFishingHotspots && data.fishing_hotspots.map((hotspot, idx) => {
                // High intensity for cluster centers
                const intensity = 0.8;
                const color = getHotspotColor(intensity);
                const opacity = getHotspotOpacity(intensity);
                const radius = getHotspotRadius(intensity);
                
                return (
                  <CircleMarker
                    key={`fish-hotspot-${idx}`}
                    center={[hotspot.lat, hotspot.lon]}
                    radius={radius}
                    color={color}
                    fillColor={color}
                    fillOpacity={opacity}
                    weight={2}
                    opacity={Math.min(1.0, opacity + 0.2)}
                  >
                    <Popup>
                      <div>
                        <strong>Fishing Hotspot</strong><br />
                        Cluster: {hotspot.cluster}<br />
                        Location: {hotspot.lat.toFixed(3)}, {hotspot.lon.toFixed(3)}<br />
                        Intensity: {(intensity * 100).toFixed(0)}%
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {/* AIS Events */}
              {showAISEvents && data.ais_events.slice(0, 1000).map((event, idx) => (
                <CircleMarker
                  key={`ais-${idx}`}
                  center={[event.gap_start_lat, event.gap_start_lon]}
                  radius={5}
                  color="blue"
                  fillColor="blue"
                  fillOpacity={0.7}
                >
                  <Popup>
                    <div>
                      <strong>AIS Disabling Event</strong><br />
                      {event.mmsi && `MMSI: ${event.mmsi}<br />`}
                      {event.gap_start_timestamp && `Time: ${event.gap_start_timestamp}`}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* AIS Hotspots */}
              {showAISHotspots && data.ais_hotspots.map((hotspot, idx) => {
                // Medium-high intensity for AIS clusters
                const intensity = 0.6;
                const color = getHotspotColor(intensity);
                const opacity = getHotspotOpacity(intensity);
                const radius = getHotspotRadius(intensity);
                
                return (
                  <CircleMarker
                    key={`ais-hotspot-${idx}`}
                    center={[hotspot.lat, hotspot.lon]}
                    radius={radius}
                    color={color}
                    fillColor={color}
                    fillOpacity={opacity}
                    weight={2}
                    opacity={Math.min(1.0, opacity + 0.2)}
                  >
                    <Popup>
                      <div>
                        <strong>AIS Hotspot</strong><br />
                        Cluster: {hotspot.cluster}<br />
                        Location: {hotspot.lat.toFixed(3)}, {hotspot.lon.toFixed(3)}<br />
                        Intensity: {(intensity * 100).toFixed(0)}%
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapWrapper>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">No data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hotspots;

