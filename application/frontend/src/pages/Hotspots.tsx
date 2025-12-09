import React, { useState, useEffect } from 'react';
import { MapIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { TileLayer, CircleMarker, HeatmapLayer, Popup } from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { apiService } from '../services/api';

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
      const response = await apiService.getGlobalHotspots({
        start_year: startYear,
        end_year: endYear,
      });
      
      if (response.data && response.data.status === 'success') {
        setData(response.data);
      } else {
        setError(response.data?.error || 'Failed to load hotspots');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load hotspots');
      console.error('Error loading hotspots:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate map bounds from data
  const getMapBounds = () => {
    if (!data || data.fishing_cells.length === 0) {
      return { center: [20, 0] as [number, number], zoom: 2 };
    }
    
    const lats = data.fishing_cells.map(c => c.lat);
    const lons = data.fishing_cells.map(c => c.lon);
    
    const center: [number, number] = [
      (Math.max(...lats) + Math.min(...lats)) / 2,
      (Math.max(...lons) + Math.min(...lons)) / 2,
    ];
    
    return { center, zoom: 3 };
  };

  const bounds = getMapBounds();

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
              {showFishingHeatmap && data.fishing_cells.slice(0, 10000).map((cell, idx) => (
                <CircleMarker
                  key={`fishing-${idx}`}
                  center={[cell.lat, cell.lon]}
                  radius={Math.max(2, Math.min(10, cell.fishing_hours / 100))}
                  color="orange"
                  fillColor="orange"
                  fillOpacity={0.6}
                >
                  <Popup>
                    <div>
                      <strong>Fishing Activity</strong><br />
                      Hours: {cell.fishing_hours.toFixed(1)}<br />
                      Location: {cell.lat.toFixed(3)}, {cell.lon.toFixed(3)}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Fishing Hotspots */}
              {showFishingHotspots && data.fishing_hotspots.map((hotspot, idx) => (
                <CircleMarker
                  key={`fish-hotspot-${idx}`}
                  center={[hotspot.lat, hotspot.lon]}
                  radius={15}
                  color="red"
                  fillColor="red"
                  fillOpacity={0.4}
                  weight={2}
                >
                  <Popup>
                    <div>
                      <strong>Fishing Hotspot</strong><br />
                      Cluster: {hotspot.cluster}<br />
                      Location: {hotspot.lat.toFixed(3)}, {hotspot.lon.toFixed(3)}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

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
              {showAISHotspots && data.ais_hotspots.map((hotspot, idx) => (
                <CircleMarker
                  key={`ais-hotspot-${idx}`}
                  center={[hotspot.lat, hotspot.lon]}
                  radius={12}
                  color="purple"
                  fillColor="purple"
                  fillOpacity={0.5}
                  weight={2}
                >
                  <Popup>
                    <div>
                      <strong>AIS Hotspot</strong><br />
                      Cluster: {hotspot.cluster}<br />
                      Location: {hotspot.lat.toFixed(3)}, {hotspot.lon.toFixed(3)}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
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

