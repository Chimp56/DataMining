import React, { useState } from 'react';
import { MagnifyingGlassIcon, EyeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  imo: string;
  flag: string;
  type: string;
  length: number;
  tonnage: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  lastSeen: string;
  status: string;
  owner: string;
  operator: string;
}

const VesselSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'mmsi' | 'name' | 'imo'>('mmsi');
  const [results, setResults] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(false);

  // Mock data - in real app, this would come from API
  const mockVessels: Vessel[] = [
    {
      id: '1',
      name: 'Ocean Explorer',
      mmsi: '123456789',
      imo: '9876543',
      flag: 'USA',
      type: 'Trawler',
      length: 45.2,
      tonnage: 1200,
      risk: 'high',
      lastSeen: '2024-01-15 14:30:00',
      status: 'Active',
      owner: 'Ocean Fishing Corp',
      operator: 'Deep Sea Operations'
    },
    {
      id: '2',
      name: 'Sea Hunter',
      mmsi: '987654321',
      imo: '1234567',
      flag: 'JPN',
      type: 'Longliner',
      length: 38.5,
      tonnage: 950,
      risk: 'critical',
      lastSeen: '2024-01-15 12:15:00',
      status: 'Active',
      owner: 'Pacific Fisheries Ltd',
      operator: 'Marine Ventures Inc'
    },
    {
      id: '3',
      name: 'Deep Blue',
      mmsi: '456789123',
      imo: '7654321',
      flag: 'GBR',
      type: 'Purse Seine',
      length: 52.8,
      tonnage: 1500,
      risk: 'medium',
      lastSeen: '2024-01-15 16:45:00',
      status: 'Active',
      owner: 'Atlantic Fishing Co',
      operator: 'Blue Ocean Ltd'
    }
  ];

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const filtered = mockVessels.filter(vessel => {
        const searchValue = searchTerm.toLowerCase();
        switch (searchType) {
          case 'mmsi':
            return vessel.mmsi.includes(searchValue);
          case 'name':
            return vessel.name.toLowerCase().includes(searchValue);
          case 'imo':
            return vessel.imo.includes(searchValue);
          default:
            return false;
        }
      });
      setResults(filtered);
      setLoading(false);
    }, 1000);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vessel Search</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search and analyze vessel information, risk assessments, and behavior patterns
        </p>
      </div>

      {/* Search Form */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Term
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter MMSI, vessel name, or IMO..."
                className="input-field pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>
          
          <div className="sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Type
            </label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="input-field"
            >
              <option value="mmsi">MMSI</option>
              <option value="name">Vessel Name</option>
              <option value="imo">IMO</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary w-full sm:w-auto"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Search Results ({results.length} vessels found)
          </h3>
          <div className="space-y-3">
            {results.map((vessel) => (
              <div
                key={vessel.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedVessel(vessel)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900">{vessel.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(vessel.risk)}`}>
                        {vessel.risk.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      <span>MMSI: {vessel.mmsi}</span>
                      <span className="mx-2">•</span>
                      <span>IMO: {vessel.imo}</span>
                      <span className="mx-2">•</span>
                      <span>Flag: {vessel.flag}</span>
                      <span className="mx-2">•</span>
                      <span>Type: {vessel.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600">
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    {vessel.risk === 'high' || vessel.risk === 'critical' && (
                      <button className="p-2 text-red-400 hover:text-red-600">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vessel Details */}
      {selectedVessel && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Vessel Details</h3>
            <button
              onClick={() => setSelectedVessel(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Vessel Name</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">MMSI</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.mmsi}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">IMO</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.imo}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Flag State</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.flag}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Vessel Type</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.type}</dd>
                </div>
              </dl>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Technical Specifications</h4>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Length</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.length} meters</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Tonnage</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.tonnage} GT</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Owner</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.owner}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Operator</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.operator}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="text-sm text-gray-900">{selectedVessel.status}</dd>
                </div>
              </dl>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Risk Assessment</h4>
                <p className="text-sm text-gray-500">Current risk level and last assessment</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(selectedVessel.risk)}`}>
                {selectedVessel.risk.toUpperCase()} RISK
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Last seen: {selectedVessel.lastSeen}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {results.length === 0 && searchTerm && !loading && (
        <div className="card text-center py-12">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No vessels found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search criteria or check the spelling.
          </p>
        </div>
      )}
    </div>
  );
};

export default VesselSearch;
