import React from 'react';
import { 
  ExclamationTriangleIcon, 
  MapIcon, 
  ClockIcon, 
  ChartBarIcon 
} from '@heroicons/react/24/outline';
import StatsCard from '../components/StatsCard';
import RecentActivity from '../components/RecentActivity';
import RiskDistributionChart from '../components/RiskDistributionChart';
import VesselTypeChart from '../components/VesselTypeChart';

const Dashboard: React.FC = () => {
  const stats = [
    {
      name: 'Total Vessels Monitored',
      value: '2,847',
      change: '+12%',
      changeType: 'positive' as const,
      icon: MapIcon,
    },
    {
      name: 'High Risk Vessels',
      value: '156',
      change: '+8%',
      changeType: 'negative' as const,
      icon: ExclamationTriangleIcon,
    },
    {
      name: 'AIS Disabling Events',
      value: '1,234',
      change: '-5%',
      changeType: 'positive' as const,
      icon: ClockIcon,
    },
    {
      name: 'Prediction Accuracy',
      value: '94.2%',
      change: '+2.1%',
      changeType: 'positive' as const,
      icon: ChartBarIcon,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of vessel monitoring and IUU fishing detection
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RiskDistributionChart />
        <VesselTypeChart />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full btn-primary text-left">
              Run New Prediction Analysis
            </button>
            <button className="w-full btn-secondary text-left">
              Export Risk Report
            </button>
            <button className="w-full btn-secondary text-left">
              Update Vessel Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
