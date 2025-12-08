import React, { useState } from 'react';
import { TileLayer, Popup, CircleMarker } from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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

const VesselMap: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<'vessels' | 'ais-events' | 'hotspots'>('vessels');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');

  // Mock data - in real app, this would come from API
  const vessels: Vessel[] = [
    {
      id: '1',
      name: 'Ocean Explorer',
      mmsi: '123456789',
      lat: 40.7128,
      lng: -74.0060,
      risk: 'high',
      type: 'Trawler',
      flag: 'USA',
      lastSeen: '2024-01-15 14:30:00'
    },
    {
      id: '2',
      name: 'Sea Hunter',
      mmsi: '987654321',
      lat: 35.6895,
      lng: 139.6917,
      risk: 'critical',
      type: 'Longliner',
      flag: 'JPN',
      lastSeen: '2024-01-15 12:15:00'
    },
    {
      id: '3',
      name: 'Deep Blue',
      mmsi: '456789123',
      lat: 51.5074,
      lng: -0.1278,
      risk: 'medium',
      type: 'Purse Seine',
      flag: 'GBR',
      lastSeen: '2024-01-15 16:45:00'
    }
  ];

  const aisEvents: AISEvent[] = [
    {
      id: '1',
      mmsi: '123456789',
      lat: 40.7128,
      lng: -74.0060,
      duration: 4.5,
      startTime: '2024-01-15 10:00:00',
      endTime: '2024-01-15 14:30:00'
    },
    {
      id: '2',
      mmsi: '987654321',
      lat: 35.6895,
      lng: 139.6917,
      duration: 8.2,
      startTime: '2024-01-15 08:00:00',
      endTime: '2024-01-15 16:12:00'
    }
  ];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vessel Map</h1>
        <p className="mt-1 text-sm text-gray-500">
          Interactive map showing vessel positions, AIS disabling events, and risk hotspots
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

            <div className="flex gap-2">
              <Button>Refresh Data</Button>
              <Button variant="secondary">Export Map</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card className="p-0">
        <div className="h-96 w-full">
          <MapWrapper
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {selectedLayer === 'vessels' && filteredVessels.map((vessel) => (
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

            {selectedLayer === 'ais-events' && aisEvents.map((event) => (
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
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VesselMap;
