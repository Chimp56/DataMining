import React, { useState, useEffect } from 'react';
import { TileLayer, Popup, CircleMarker, Marker, LayersControl, LayerGroup } from 'react-leaflet';
import { GeoJSON } from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { apiService } from '../services/api';
// Leaflet icon fix is handled globally in src/index.tsx

interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  lat: number;
  lng: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  flag: string;
  lastSeen: string;
}

interface AISEvent {
  id: string;
  mmsi: string;
  lat: number;
  lng: number;
  duration: number;
  startTime: string;
  endTime: string;
}

interface EEZBoundaryItem {
  id?: number;
  line_id: number | null;
  line_name: string | null;
  line_type: string | null;
  territory1: string | null;
  sovereign1: string | null;
  territory2: string | null;
  sovereign2: string | null;
  eez1: string | null;
  eez2: string | null;
  length_km: number | null;
  geometry?: any; // GeoJSON geometry
}

interface MPAItem {
  id?: number;
  wdpaid: number | null;
  name: string | null;
  orig_name: string | null;
  desig_eng: string | null;
  iucn_cat: string | null;
  iso3: string | null;
  gis_m_area: number | null;
  status: string | null;
  geometry?: any; // GeoJSON geometry
}

const VesselMap: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<'vessels' | 'ais-events' | 'hotspots'>('vessels');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [showEEZ, setShowEEZ] = useState(true);
  const [showMPA, setShowMPA] = useState(true);
  const [eezBoundariesData, setEezBoundariesData] = useState<EEZBoundaryItem[]>([]);
  const [mpaData, setMpaData] = useState<MPAItem[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [aisEvents, setAisEvents] = useState<AISEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data - COMMENTED OUT
  // const vessels: Vessel[] = [
  //   {
  //     id: '1',
  //     name: 'Ocean Explorer',
  //     mmsi: '123456789',
  //     lat: 40.7128,
  //     lng: -74.0060,
  //     risk: 'high',
  //     type: 'Trawler',
  //     flag: 'USA',
  //     lastSeen: '2024-01-15 14:30:00'
  //   },
  //   {
  //     id: '2',
  //     name: 'Sea Hunter',
  //     mmsi: '987654321',
  //     lat: 35.6895,
  //     lng: 139.6917,
  //     risk: 'critical',
  //     type: 'Longliner',
  //     flag: 'JPN',
  //     lastSeen: '2024-01-15 12:15:00'
  //   },
  //   {
  //     id: '3',
  //     name: 'Deep Blue',
  //     mmsi: '456789123',
  //     lat: 51.5074,
  //     lng: -0.1278,
  //     risk: 'medium',
  //     type: 'Purse Seine',
  //     flag: 'GBR',
  //     lastSeen: '2024-01-15 16:45:00'
  //   }
  // ];

  // const aisEvents: AISEvent[] = [
  //   {
  //     id: '1',
  //     mmsi: '123456789',
  //     lat: 40.7128,
  //     lng: -74.0060,
  //     duration: 4.5,
  //     startTime: '2024-01-15 10:00:00',
  //     endTime: '2024-01-15 14:30:00'
  //   },
  //   {
  //     id: '2',
  //     mmsi: '987654321',
  //     lat: 35.6895,
  //     lng: 139.6917,
  //     duration: 8.2,
  //     startTime: '2024-01-15 08:00:00',
  //     endTime: '2024-01-15 16:12:00'
  //   }
  // ];

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always load data, regardless of checkbox state
      // Load EEZ boundaries data
      try {
        const eezResponse = await apiService.getEEZBoundariesForMap({ limit: 1000 });
        console.log('EEZ Boundaries Response:', eezResponse);
        if (eezResponse.data && eezResponse.data.items) {
          console.log(`Loaded ${eezResponse.data.items.length} EEZ boundary items`);
          setEezBoundariesData(eezResponse.data.items);
        } else {
          console.warn('EEZ boundaries response missing items:', eezResponse);
        }
      } catch (eezErr) {
        console.error('Error loading EEZ boundaries data:', eezErr);
      }

      // Load MPA data
      try {
        const mpaResponse = await apiService.getMPAForMap({ limit: 1000 });
        console.log('MPA Response:', mpaResponse);
        if (mpaResponse.data && mpaResponse.data.items) {
          console.log(`Loaded ${mpaResponse.data.items.length} MPA items`);
          setMpaData(mpaResponse.data.items);
        } else {
          console.warn('MPA response missing items:', mpaResponse);
        }
      } catch (mpaErr) {
        console.error('Error loading MPA data:', mpaErr);
      }

      // Load vessels data from predictions
      try {
        const predictionsResponse = await apiService.getPredictions({
          timeframe: 'all',
          limit: 100,
          offset: 0,
        });
        console.log('Predictions Response:', predictionsResponse);
        if (predictionsResponse.data && predictionsResponse.data.items) {
          // Map predictions directly to vessels (locations are now included in response)
          const vesselData: Vessel[] = predictionsResponse.data.items
            .filter((item: any) => {
              // Only include vessels with valid coordinates
              return item.lat != null && item.lng != null && item.lat !== 0 && item.lng !== 0;
            })
            .map((item: any) => {
              const mmsi = String(item.mmsi);
              
              // Determine risk level from anomaly score
              const anomalyScore = item.anomaly_score || 0;
              let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
              if (anomalyScore >= 0.9) risk = 'critical';
              else if (anomalyScore >= 0.75) risk = 'high';
              else if (anomalyScore >= 0.6) risk = 'medium';
              else if (anomalyScore >= 0.4) risk = 'medium';
              
              return {
                id: `vessel_${mmsi}`,
                name: item.vesselName || `Vessel ${mmsi}`,
                mmsi: mmsi,
                lat: item.lat,
                lng: item.lng,
                risk: risk,
                type: item.vessel_features?.vessel_class_inferred || 'Unknown',
                flag: item.vessel_features?.flag_ais || 'UNK',
                lastSeen: item.last_seen || item.timestamp || new Date().toISOString(),
              };
            });
          
          console.log(`Loaded ${vesselData.length} vessels with valid positions`);
          setVessels(vesselData);
        } else {
          console.warn('Predictions response missing items:', predictionsResponse);
        }
      } catch (vesselErr) {
        console.error('Error loading vessels data:', vesselErr);
      }

      // Load AIS events data
      try {
        const aisResponse = await apiService.getAISEvents();
        console.log('AIS Events Response:', aisResponse);
        if (aisResponse.data && aisResponse.data.items) {
          const aisData: AISEvent[] = aisResponse.data.items.map((item: any, index: number) => ({
            id: item.id || `ais_${index}`,
            mmsi: String(item.mmsi || ''),
            lat: item.lat || item.cell_ll_lat || 0,
            lng: item.lng || item.cell_ll_lon || 0,
            duration: item.duration || item.hours || 0,
            startTime: item.start_time || item.startTime || item.date || '',
            endTime: item.end_time || item.endTime || item.date || '',
          })).filter((e: AISEvent) => e.lat !== 0 && e.lng !== 0);
          
          console.log(`Loaded ${aisData.length} AIS events with valid positions`);
          setAisEvents(aisData);
        } else {
          console.warn('AIS events response missing items:', aisResponse);
        }
      } catch (aisErr) {
        console.error('Error loading AIS events data:', aisErr);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load map data');
      console.error('Error loading map data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      case 'critical': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getRiskSize = (risk: string) => {
    switch (risk) {
      case 'low': return 6;
      case 'medium': return 8;
      case 'high': return 10;
      case 'critical': return 12;
      default: return 6;
    }
  };

  const filteredVessels = selectedRisk === 'all' 
    ? vessels 
    : vessels.filter(vessel => vessel.risk === selectedRisk);

  // Note: EEZ boundaries are line features that would need geometry data (GeoJSON/WKT) to display
  // For now, we'll show them as informational markers or wait for geometry data
  console.log(`EEZ boundaries loaded: ${eezBoundariesData.length} items`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vessel Map</h1>
        <p className="mt-1 text-sm text-gray-500">
          Interactive map showing vessel positions, AIS disabling events, EEZ boundaries, and MPAs
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Layer
              </label>
              <select
                value={selectedLayer}
                onChange={(e) => setSelectedLayer(e.target.value as any)}
                className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="vessels">Vessels</option>
                <option value="ais-events">AIS Disabling Events</option>
                <option value="hotspots">Risk Hotspots</option>
              </select>
            </div>
            
            {selectedLayer === 'vessels' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Risk Level
                </label>
                <select
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical Risk</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-eez"
                checked={showEEZ}
                onChange={(e) => {
                  setShowEEZ(e.target.checked);
                  if (e.target.checked && eezBoundariesData.length === 0) {
                    loadMapData();
                  }
                }}
                className="h-4 w-4"
              />
              <label htmlFor="show-eez" className="text-sm font-medium text-foreground">
                Show EEZ
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-mpa"
                checked={showMPA}
                onChange={(e) => {
                  setShowMPA(e.target.checked);
                  if (e.target.checked && mpaData.length === 0) {
                    loadMapData();
                  }
                }}
                className="h-4 w-4"
              />
              <label htmlFor="show-mpa" className="text-sm font-medium text-foreground">
                Show MPA
              </label>
            </div>

            <div className="flex gap-2 items-center">
              <Button onClick={loadMapData} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh Data'}
              </Button>
              <Button variant="secondary">Export Map</Button>
              {!loading && (
                <span className="text-sm text-gray-600">
                  EEZ Boundaries: {eezBoundariesData.length} | MPA: {mpaData.length}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">
              <strong>Debug:</strong> EEZ Boundaries: {eezBoundariesData.length} loaded | 
              MPA: {mpaData.length} loaded
            </p>
            {eezBoundariesData.length > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                 EEZ boundaries loaded. Note: Boundary lines require geometry data to display on map.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Map */}
      <Card className="p-0">
        <div className="h-96 w-full">
          <MapWrapper
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
          >
            <LayersControl position="topright">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {/* EEZ Boundaries Layer */}
              {showEEZ && eezBoundariesData.length > 0 && (
                <LayersControl.Overlay name={`EEZ Boundaries (${eezBoundariesData.length})`} checked={showEEZ}>
                  <LayerGroup>
                    {eezBoundariesData.map((boundary, idx) => {
                      // Check if geometry is available (GeoJSON format)
                      if (boundary.geometry) {
                        // Create GeoJSON feature for this boundary
                        const geoJsonFeature = {
                          type: "Feature" as const,
                          properties: {
                            line_id: boundary.line_id,
                            line_name: boundary.line_name,
                            line_type: boundary.line_type,
                            territory1: boundary.territory1,
                            sovereign1: boundary.sovereign1,
                            territory2: boundary.territory2,
                            sovereign2: boundary.sovereign2,
                            length_km: boundary.length_km,
                          },
                          geometry: boundary.geometry
                        };
                        
                        return (
                          <GeoJSON
                            key={`eez-boundary-${boundary.line_id || idx}`}
                            data={geoJsonFeature}
                            style={{
                              color: "#3B82F6",
                              weight: 2,
                              opacity: 0.7
                            }}
                          >
                            <Popup>
                              <div className="p-2">
                                <h3 className="font-semibold text-gray-900">EEZ Boundary</h3>
                                {boundary.line_name && (
                                  <p className="text-sm text-gray-600">{boundary.line_name}</p>
                                )}
                                {boundary.line_type && (
                                  <p className="text-sm text-gray-600">Type: {boundary.line_type}</p>
                                )}
                                {boundary.territory1 && boundary.territory2 && (
                                  <p className="text-sm text-gray-600">
                                    {boundary.territory1} - {boundary.territory2}
                                  </p>
                                )}
                                {boundary.length_km && (
                                  <p className="text-sm text-gray-600">
                                    Length: {boundary.length_km.toFixed(2)} km
                                  </p>
                                )}
                              </div>
                            </Popup>
                          </GeoJSON>
                        );
                      }
                      return null;
                    })}
                    {/* Show info if no geometry available */}
                    {eezBoundariesData.every(b => !b.geometry) && (
                      <Marker position={[0, 0]}>
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-semibold text-gray-900">EEZ Boundaries</h3>
                            <p className="text-sm text-gray-600">
                              {eezBoundariesData.length} boundary lines loaded
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                              Note: Geometry data not available. Install geopandas in backend to load geometry from shapefile.
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </LayerGroup>
                </LayersControl.Overlay>
              )}

              {/* MPA Layer */}
              {showMPA && mpaData.length > 0 && (
                <LayersControl.Overlay name={`Marine Protected Areas (${mpaData.length})`} checked={showMPA}>
                  <LayerGroup>
                    {mpaData.map((mpa, idx) => {
                      // Check if geometry is available (GeoJSON format)
                      if (mpa.geometry) {
                        // Create GeoJSON feature for this MPA
                        const geoJsonFeature = {
                          type: "Feature" as const,
                          properties: {
                            wdpaid: mpa.wdpaid,
                            name: mpa.name,
                            orig_name: mpa.orig_name,
                            desig_eng: mpa.desig_eng,
                            iucn_cat: mpa.iucn_cat,
                            iso3: mpa.iso3,
                            gis_m_area: mpa.gis_m_area,
                            status: mpa.status,
                          },
                          geometry: mpa.geometry
                        };
                        
                        return (
                          <GeoJSON
                            key={`mpa-${mpa.wdpaid || idx}`}
                            data={geoJsonFeature}
                            style={{
                              color: "#16A34A",
                              weight: 2,
                              fillColor: "#16A34A",
                              fillOpacity: 0.1,
                              opacity: 0.7
                            }}
                          >
                            <Popup>
                              <div className="p-2">
                                <h3 className="font-semibold text-gray-900">Marine Protected Area</h3>
                                {mpa.name && (
                                  <p className="text-sm text-gray-600">{mpa.name}</p>
                                )}
                                {mpa.desig_eng && (
                                  <p className="text-sm text-gray-600">Designation: {mpa.desig_eng}</p>
                                )}
                                {mpa.iucn_cat && (
                                  <p className="text-sm text-gray-600">IUCN Category: {mpa.iucn_cat}</p>
                                )}
                                {mpa.iso3 && (
                                  <p className="text-sm text-gray-600">Country: {mpa.iso3}</p>
                                )}
                                {mpa.gis_m_area && (
                                  <p className="text-sm text-gray-600">
                                    Area: {mpa.gis_m_area.toLocaleString()} km²
                                  </p>
                                )}
                                {mpa.status && (
                                  <p className="text-sm text-gray-600">Status: {mpa.status}</p>
                                )}
                              </div>
                            </Popup>
                          </GeoJSON>
                        );
                      }
                      return null;
                    })}
                    {/* Show info if no geometry available */}
                    {mpaData.every(m => !m.geometry) && (
                      <Marker position={[20, 0]}>
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-semibold text-gray-900">MPA Data Loaded</h3>
                            <p className="text-sm text-gray-600">
                              {mpaData.length} Marine Protected Areas loaded
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                              Note: Geometry data not available. Install geopandas in backend to load geometry from shapefile.
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </LayerGroup>
                </LayersControl.Overlay>
              )}
              
              {/* Vessels Layer */}
              {selectedLayer === 'vessels' && (
                <LayersControl.Overlay name="Vessels" checked={selectedLayer === 'vessels'}>
                  <LayerGroup>
                    {filteredVessels.map((vessel) => (
                <CircleMarker
                  key={vessel.id}
                  center={[vessel.lat, vessel.lng]}
                  radius={getRiskSize(vessel.risk)}
                  color={getRiskColor(vessel.risk)}
                  fillColor={getRiskColor(vessel.risk)}
                  fillOpacity={0.7}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold text-gray-900">{vessel.name}</h3>
                      <p className="text-sm text-gray-600">MMSI: {vessel.mmsi}</p>
                      <p className="text-sm text-gray-600">Type: {vessel.type}</p>
                      <p className="text-sm text-gray-600">Flag: {vessel.flag}</p>
                      <p className="text-sm text-gray-600">Risk: <span className={`font-medium ${
                        vessel.risk === 'critical' ? 'text-red-600' :
                        vessel.risk === 'high' ? 'text-orange-600' :
                        vessel.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'
                      }`}>{vessel.risk.toUpperCase()}</span></p>
                      <p className="text-sm text-gray-600">Last Seen: {vessel.lastSeen}</p>
                    </div>
                  </Popup>
                </CircleMarker>
                    ))}
                  </LayerGroup>
                </LayersControl.Overlay>
              )}

              {/* AIS Events Layer */}
              {selectedLayer === 'ais-events' && (
                <LayersControl.Overlay name="AIS Disabling Events" checked={selectedLayer === 'ais-events'}>
                  <LayerGroup>
                    {aisEvents.map((event) => (
                      <CircleMarker
                        key={event.id}
                        center={[event.lat, event.lng]}
                        radius={8}
                        color="#DC2626"
                        fillColor="#DC2626"
                        fillOpacity={0.6}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-semibold text-gray-900">AIS Disabling Event</h3>
                            <p className="text-sm text-gray-600">MMSI: {event.mmsi}</p>
                            <p className="text-sm text-gray-600">Duration: {event.duration} hours</p>
                            <p className="text-sm text-gray-600">Start: {event.startTime}</p>
                            <p className="text-sm text-gray-600">End: {event.endTime}</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </LayerGroup>
                </LayersControl.Overlay>
              )}
            </LayersControl>
          </MapWrapper>
        </div>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="flex flex-wrap gap-6">
          {selectedLayer === 'vessels' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600">Low Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-gray-600">Medium Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span className="text-sm text-gray-600">High Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-600">Critical Risk</span>
              </div>
            </>
          )}
          
          {selectedLayer === 'ais-events' && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-600"></div>
              <span className="text-sm text-gray-600">AIS Disabling Events</span>
            </div>
          )}

          {showEEZ && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">EEZ Boundaries</span>
            </div>
          )}

          {showMPA && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Marine Protected Areas</span>
            </div>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VesselMap;
