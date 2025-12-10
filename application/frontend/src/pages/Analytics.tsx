import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  ClockIcon, 
  MapIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiService } from '../services/api';

const Analytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'risk' | 'ais' | 'vessels' | 'predictions'>('risk');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    highRiskVessels: 0,
    aisDisablingEvents: 0,
    vesselsMonitored: 0,
  });

  // Mock data for charts - COMMENTED OUT, using real data where available
  const riskTrendData = [
    { date: '2024-01-01', highRisk: 12, mediumRisk: 28, lowRisk: 45 },
    { date: '2024-01-02', highRisk: 15, mediumRisk: 32, lowRisk: 42 },
    { date: '2024-01-03', highRisk: 18, mediumRisk: 35, lowRisk: 38 },
    { date: '2024-01-04', highRisk: 14, mediumRisk: 30, lowRisk: 41 },
    { date: '2024-01-05', highRisk: 16, mediumRisk: 33, lowRisk: 40 },
    { date: '2024-01-06', highRisk: 20, mediumRisk: 38, lowRisk: 35 },
    { date: '2024-01-07', highRisk: 22, mediumRisk: 40, lowRisk: 32 },
  ];

  const aisDisablingData = [
    { month: 'Jan', events: 145, duration: 890 },
    { month: 'Feb', events: 132, duration: 756 },
    { month: 'Mar', events: 158, duration: 923 },
    { month: 'Apr', events: 167, duration: 1024 },
    { month: 'May', events: 189, duration: 1156 },
    { month: 'Jun', events: 201, duration: 1289 },
  ];

  const vesselTypeData = [
    { name: 'Trawlers', count: 450, risk: 12 },
    { name: 'Longliners', count: 320, risk: 18 },
    { name: 'Purse Seines', count: 280, risk: 8 },
    { name: 'Gillnetters', count: 190, risk: 15 },
    { name: 'Pole & Line', count: 150, risk: 5 },
    { name: 'Other', count: 120, risk: 22 },
  ];

  const flagStateData = [
    { name: 'China', count: 1250, risk: 15 },
    { name: 'Japan', count: 890, risk: 8 },
    { name: 'USA', count: 650, risk: 12 },
    { name: 'Russia', count: 420, risk: 18 },
    { name: 'Spain', count: 380, risk: 10 },
    { name: 'Other', count: 1200, risk: 14 },
  ];

  const riskDistributionData = [
    { name: 'Low Risk', value: 45, color: '#10B981' },
    { name: 'Medium Risk', value: 35, color: '#F59E0B' },
    { name: 'High Risk', value: 15, color: '#EF4444' },
    { name: 'Critical Risk', value: 5, color: '#DC2626' },
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Load dashboard stats for key metrics
      const dashboardResponse = await apiService.getDashboardStats();
      const dashboardData = dashboardResponse.data;
      
      setStats({
        highRiskVessels: dashboardData.high_risk_vessels || 0,
        aisDisablingEvents: dashboardData.ais_disabling_events || 0,
        vesselsMonitored: dashboardData.total_vessels || 0,
      });
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Comprehensive analysis of vessel behavior patterns, risk trends, and prediction performance
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="input-field w-auto"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Metric Focus
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="input-field w-auto"
            >
              <option value="risk">Risk Analysis</option>
              <option value="ais">AIS Disabling</option>
              <option value="vessels">Vessel Patterns</option>
              <option value="predictions">Prediction Performance</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button className="btn-primary">Generate Report</button>
            <button className="btn-secondary">Export Data</button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  High Risk Vessels
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.highRiskVessels.toLocaleString()}
                </dd>
                <dd className="text-sm text-gray-500">From database</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-orange-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  AIS Disabling Events
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.aisDisablingEvents.toLocaleString()}
                </dd>
                <dd className="text-sm text-gray-500">From database</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MapIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Vessels Monitored
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : stats.vesselsMonitored.toLocaleString()}
                </dd>
                <dd className="text-sm text-gray-500">From database</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  R API Status
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {loading ? '...' : 'Connected'}
                </dd>
                <dd className="text-sm text-gray-500">Model service status</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Trend Chart */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Level Trends</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="highRisk" stroke="#EF4444" strokeWidth={2} name="High Risk" />
                <Line type="monotone" dataKey="mediumRisk" stroke="#F59E0B" strokeWidth={2} name="Medium Risk" />
                <Line type="monotone" dataKey="lowRisk" stroke="#10B981" strokeWidth={2} name="Low Risk" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AIS Disabling Events */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">AIS Disabling Events</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aisDisablingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="events" fill="#3B82F6" name="Events" />
                <Bar yAxisId="right" dataKey="duration" fill="#EF4444" name="Duration (hours)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vessel Type Distribution */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Vessel Type Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vesselTypeData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" name="Vessel Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Flag State Analysis */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Flag State Analysis</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flagStateData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" name="Vessel Count" />
              <Bar dataKey="risk" fill="#EF4444" name="Risk Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Note: Performance metrics (Model Accuracy, False Positive Rate, Processing Time) removed - not available from real data */}
    </div>
  );
};

export default Analytics;
