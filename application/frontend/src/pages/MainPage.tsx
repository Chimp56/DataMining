import React, { useMemo, useState, useEffect } from 'react';
import {
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Tooltip,
} from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { apiService } from '../services/api';
// Leaflet icon fix is handled globally in src/index.tsx

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  flag: string;
  type: string;
  tonnage: number;
  lastSeen: string;
  risk: RiskLevel;
  anomalyScore: number;
  avgSpeed: number;
  eezCrossings: number;
  timeDisabledHours: number;
  trajectory: Array<{ lat: number; lng: number; timestamp: string }>;
  predictedPoint: { lat: number; lng: number; eta: string };
}

interface OverlayLayer {
  id: 'eez' | 'mpa';
  name: string;
  description: string;
  color: string;
  polygon: Array<[number, number]>;
}

const overlays: OverlayLayer[] = [
  {
    id: 'eez',
    name: 'EEZ (200nm)',
    description: 'Exclusive Economic Zones with jurisdiction boundaries.',
    color: '#2563EB',
    polygon: [
      [8, -76],
      [8, -62],
      [-8, -62],
      [-8, -76],
    ],
  },
  {
    id: 'mpa',
    name: 'Marine Protected Areas',
    description: 'Restricted fishing zones and conservation areas.',
    color: '#16A34A',
    polygon: [
      [2, -68],
      [2, -64],
      [-2, -64],
      [-2, -68],
    ],
  },
];

// Helper function to determine risk level from anomaly score
const getRiskFromScore = (score: number): RiskLevel => {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
};

const riskColor = (risk: RiskLevel) => {
  switch (risk) {
    case 'low':
      return '#10B981';
    case 'medium':
      return '#F59E0B';
    case 'high':
      return '#EF4444';
    case 'critical':
      return '#B91C1C';
    default:
      return '#6B7280';
  }
};

const riskBadgeClass = (risk: RiskLevel) => {
  switch (risk) {
    case 'low':
      return 'text-green-700 bg-green-100';
    case 'medium':
      return 'text-yellow-700 bg-yellow-100';
    case 'high':
      return 'text-orange-700 bg-orange-100';
    case 'critical':
      return 'text-red-700 bg-red-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
};

const MainPage: React.FC = () => {
  const [activeLayers, setActiveLayers] = useState<Record<'eez' | 'mpa', boolean>>({
    eez: true,
    mpa: false,
  });
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [mmsiInput, setMmsiInput] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [showAggregated, setShowAggregated] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotspotCenters, setHotspotCenters] = useState<Array<{ lat: number; lng: number; intensity: number }>>([]);

  // Load vessels and hotspots on mount
  useEffect(() => {
    loadVessels();
    loadHotspots();
  }, []);

  const loadVessels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch predictions which include vessel data with anomaly scores
      const response = await apiService.getPredictions({
        timeframe: 'all',
        limit: 50, // Top 50 vessels by risk
        offset: 0,
      });
      
      if (response.data && response.data.items) {
        // Map items to vessels
        const allVessels: Vessel[] = response.data.items.map((item: any) => {
          const anomalyScore = item.anomaly_score || 0;
          const risk = getRiskFromScore(anomalyScore);
          
          return {
            id: item.id || `vessel_${item.mmsi}`,
            name: item.vesselName || `Vessel ${item.mmsi}`,
            mmsi: String(item.mmsi),
            flag: item.flag || 'UNK',
            type: item.vessel_type || 'Unknown',
            tonnage: item.tonnage || 0,
            lastSeen: item.timestamp || new Date().toISOString(),
            risk: risk,
            anomalyScore: anomalyScore,
            avgSpeed: item.avg_speed || 0,
            eezCrossings: item.eez_crossings || 0,
            timeDisabledHours: item.time_disabled_hours || 0,
            trajectory: item.trajectory || [],
            predictedPoint: item.predicted_point || { lat: 0, lng: 0, eta: '' },
          };
        });
        
        // Deduplicate by MMSI - keep the one with highest anomaly score
        const uniqueVesselsMap = new Map<string, Vessel>();
        for (const vessel of allVessels) {
          const existing = uniqueVesselsMap.get(vessel.mmsi);
          if (!existing || vessel.anomalyScore > existing.anomalyScore) {
            uniqueVesselsMap.set(vessel.mmsi, vessel);
          }
        }
        
        const vesselData = Array.from(uniqueVesselsMap.values());
        
        setVessels(vesselData);
        if (vesselData.length > 0 && !selectedVessel) {
          setSelectedVessel(vesselData[0]);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load vessels');
      console.error('Error loading vessels:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHotspots = async () => {
    try {
      const response = await apiService.getGlobalHotspots({
        start_year: 2017,
        end_year: 2019,
      });
      
      if (response.data && response.data.fishing_hotspots) {
        const hotspots = response.data.fishing_hotspots.map((hotspot: any) => ({
          lat: hotspot.lat || 0,
          lng: hotspot.lon || 0,
          intensity: Math.min(1.0, (hotspot.count || 0) / 100), // Normalize intensity
        }));
        setHotspotCenters(hotspots.slice(0, 10)); // Limit to top 10
      }
    } catch (err: any) {
      console.error('Error loading hotspots:', err);
      // Don't set error state for hotspots, just log
    }
  };

  const vesselList = useMemo(
    () => [...vessels].sort((a, b) => b.anomalyScore - a.anomalyScore),
    [vessels]
  );

  const handleMmsiLookup = async () => {
    const mmsi = mmsiInput.trim();
    if (!mmsi) {
      setSearchError('Please enter an MMSI');
      return;
    }
    
    try {
      setSearchError('');
      const response = await apiService.getVesselDetails(mmsi);
      
      if (response.data) {
        const item = response.data;
        const anomalyScore = item.anomaly_score || 0;
        const risk = getRiskFromScore(anomalyScore);
        
        const vessel: Vessel = {
          id: `vessel_${mmsi}`,
          name: item.vessel_name || `Vessel ${mmsi}`,
          mmsi: String(mmsi),
          flag: item.flag || 'UNK',
          type: item.vessel_type || 'Unknown',
          tonnage: item.tonnage || 0,
          lastSeen: item.last_seen || new Date().toISOString(),
          risk: risk,
          anomalyScore: anomalyScore,
          avgSpeed: item.avg_speed || 0,
          eezCrossings: item.eez_crossings || 0,
          timeDisabledHours: item.time_disabled_hours || 0,
          trajectory: item.trajectory || [],
          predictedPoint: item.predicted_point || { lat: 0, lng: 0, eta: '' },
        };
        
        console.log('Vessel details loaded:', {
          mmsi,
          vessel_name: item.vessel_name,
          vessel_type: item.vessel_type,
          flag: item.flag,
          tonnage: item.tonnage,
          avg_speed: item.avg_speed,
          eez_crossings: item.eez_crossings,
          time_disabled_hours: item.time_disabled_hours,
          trajectory_length: item.trajectory?.length || 0,
          vessel_features: item.vessel_features ? 'present' : 'missing'
        });
        
        setSelectedVessel(vessel);
        // Add to vessels list if not already there
        if (!vessels.find(v => v.mmsi === mmsi)) {
          setVessels(prev => [...prev, vessel]);
        }
      }
    } catch (err: any) {
      setSearchError(err.response?.data?.detail || 'No vessel found with that MMSI');
      console.error('Error looking up vessel:', err);
    }
  };

  const toggleLayer = (id: 'eez' | 'mpa') => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Main Page</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explore vessel activity, toggle spatial overlays, and review vessel behavior summaries.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Overlays</h3>
                <p className="text-sm text-gray-500">Spatial context layers</p>
              </div>
            </div>
            <div className="space-y-3">
              {overlays.map((layer) => (
                <label key={layer.id} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300"
                    checked={activeLayers[layer.id]}
                    onChange={() => toggleLayer(layer.id)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{layer.name}</span>
                      <span
                        className="inline-block h-2 w-8 rounded-full"
                        style={{ backgroundColor: layer.color }}
                      />
                    </div>
                    <p className="text-sm text-gray-600">{layer.description}</p>
                  </div>
                </label>
              ))}
              <label className="flex items-center gap-3 pt-1 border-t border-gray-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                  checked={showAggregated}
                  onChange={() => setShowAggregated((v) => !v)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Aggregated Vessel Overlay</p>
                  <p className="text-sm text-gray-600">Density and IUU risk hotspots.</p>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                  checked={showTrails}
                  onChange={() => setShowTrails((v) => !v)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Show Vessel Trajectories</p>
                  <p className="text-sm text-gray-600">Spatial temporal playback lines.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Enter Vessel Identifier</h3>
            <input
              className="input-field"
              placeholder="Enter MMSI..."
              value={mmsiInput}
              onChange={(e) => setMmsiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMmsiLookup()}
            />
            <button className="btn-primary w-full" onClick={handleMmsiLookup}>
              Locate Vessel
            </button>
            {searchError && <p className="text-sm text-red-600">{searchError}</p>}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Vessels List</h3>
              <span className="text-xs text-gray-500">Ranked by anomaly</span>
            </div>
            <div className="space-y-2">
              {loading && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Loading vessels...</p>
                </div>
              )}
              {!loading && vesselList.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No vessels found</p>
                </div>
              )}
              {!loading && vesselList.map((vessel) => (
                <div
                  key={vessel.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedVessel && vessel.id === selectedVessel.id
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedVessel(vessel)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{vessel.name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadgeClass(
                          vessel.risk
                        )}`}
                      >
                        {vessel.risk.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      MMSI {vessel.mmsi} • Score {(vessel.anomalyScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Last seen</p>
                    <p className="text-sm text-gray-900">{vessel.lastSeen}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map and detail column */}
        <div className="space-y-4">
          <div className="card p-0 relative">
            <MapWrapper
              center={[5, -40]}
              zoom={3}
              style={{ height: 520, width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {overlays.map(
                (layer) =>
                  activeLayers[layer.id] && (
                    <Polygon
                      key={layer.id}
                      positions={layer.polygon}
                      pathOptions={{ color: layer.color, fillColor: layer.color, fillOpacity: 0.08 }}
                    />
                  )
              )}

              {showAggregated &&
                hotspotCenters.map((hotspot, idx) => (
                  <CircleMarker
                    key={idx}
                    center={[hotspot.lat, hotspot.lng]}
                    radius={12 + hotspot.intensity * 10}
                    color="rgba(239,68,68,0.8)"
                    fillColor="rgba(239,68,68,0.6)"
                    fillOpacity={0.6}
                  >
                    <Tooltip direction="top" offset={[0, -4]} opacity={1} permanent={false}>
                      Density {(hotspot.intensity * 100).toFixed(0)}%
                    </Tooltip>
                  </CircleMarker>
                ))}

              {vessels.map((vessel) => {
                if (!vessel.trajectory || vessel.trajectory.length === 0) return null;
                const isSelected = selectedVessel && vessel.id === selectedVessel.id;
                const lastPoint = vessel.trajectory[vessel.trajectory.length - 1];
                return (
                  <React.Fragment key={vessel.id}>
                    {showTrails && (
                      <Polyline
                        positions={vessel.trajectory.map((p) => [p.lat, p.lng])}
                        pathOptions={{
                          color: isSelected ? '#7C3AED' : '#6B7280',
                          weight: isSelected ? 4 : 2,
                          opacity: isSelected ? 0.9 : 0.5,
                        }}
                      />
                    )}
                    <CircleMarker
                      center={[lastPoint.lat, lastPoint.lng]}
                      radius={10}
                      color={riskColor(vessel.risk)}
                      fillColor={riskColor(vessel.risk)}
                      fillOpacity={0.8}
                      eventHandlers={{ click: () => setSelectedVessel(vessel) }}
                    >
                      <Tooltip direction="right" offset={[10, 0]} opacity={1}>
                        <div className="space-y-1">
                          <p className="font-semibold">{vessel.name}</p>
                          <p className="text-sm">MMSI {vessel.mmsi}</p>
                          <p className="text-sm capitalize">Risk {vessel.risk}</p>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                    {showTrails && (
                      <CircleMarker
                        center={[vessel.predictedPoint.lat, vessel.predictedPoint.lng]}
                        radius={6}
                        color="#0EA5E9"
                        fillColor="#0EA5E9"
                        fillOpacity={0.8}
                      >
                        <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                          Predicted ETA {vessel.predictedPoint.eta}
                        </Tooltip>
                      </CircleMarker>
                    )}
                  </React.Fragment>
                );
              })}
            </MapWrapper>

            <div className="absolute bottom-4 right-4">
              <div className="card shadow-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Legend</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Low risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>Medium risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>High risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-600" />
                    <span>Critical risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-indigo-600" />
                    <span>Trajectory</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-sky-500" />
                    <span>Predicted next day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-2 rounded bg-primary-200 border border-primary-600" />
                    <span>EEZ / MPA overlay</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card md:col-span-2">
              {loading && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading vessels...</p>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
              {!loading && !selectedVessel && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No vessel selected. Search for a vessel or select one from the list.</p>
                </div>
              )}
              {!loading && selectedVessel && (
                <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Vessel Detail and Summary</h3>
                  <p className="text-sm text-gray-500">
                    Metadata, behavioral summaries, and crossings for the selected vessel.
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskBadgeClass(
                  selectedVessel.risk
                )}`}>
                  {selectedVessel.risk.toUpperCase()}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">Vessel</dt>
                      <dd className="text-sm text-gray-900 font-medium">
                        {selectedVessel.name} ({selectedVessel.type})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">MMSI</dt>
                      <dd className="text-sm text-gray-900">{selectedVessel.mmsi}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Flag</dt>
                      <dd className="text-sm text-gray-900">{selectedVessel.flag}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Tonnage</dt>
                      <dd className="text-sm text-gray-900">{selectedVessel.tonnage} GT</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">Anomaly Score</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {(selectedVessel.anomalyScore * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">Avg Speed</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedVessel.avgSpeed} kn
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">EEZ Crossings</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedVessel.eezCrossings}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">Time Disabled</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedVessel.timeDisabledHours} hrs
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Trajectory Points</p>
                  <p className="text-sm text-gray-900">
                    {selectedVessel.trajectory?.length || 0} historical positions plotted with playback.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Predicted Position</p>
                  {selectedVessel.predictedPoint && selectedVessel.predictedPoint.eta ? (
                    <p className="text-sm text-gray-900">
                      Next day ETA {selectedVessel.predictedPoint.eta} at{' '}
                      {selectedVessel.predictedPoint.lat?.toFixed(2) || 'N/A'},{' '}
                      {selectedVessel.predictedPoint.lng?.toFixed(2) || 'N/A'}.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">No prediction available</p>
                  )}
                </div>
              </div>
                </>
              )}
            </div>

            <div className="card space-y-3">
              <h3 className="text-lg font-medium text-gray-900">Report as IUU Fishing</h3>
              <p className="text-sm text-gray-600">
                Manually report suspicious activity with supporting notes and timestamp.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter description
                </label>
                <textarea
                  className="input-field h-24"
                  placeholder="Describe observed behavior, evidence, or context..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                />
              </div>
              <button
                className="btn-primary w-full"
                onClick={() => {
                  // Placeholder for API submission
                  setReportNotes('');
                }}
              >
                Submit IUU Report
              </button>
              <p className="text-xs text-gray-500">
                Report includes vessel ID, timestamp, overlay context, and user notes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;

