import React from 'react';
import { ClockIcon, ExclamationTriangleIcon, MapIcon } from '@heroicons/react/24/outline';

const RecentActivity: React.FC = () => {
  const activities = [
    {
      id: 1,
      type: 'warning',
      message: 'Vessel MMSI 123456789 detected with suspicious AIS disabling pattern',
      timestamp: '2 minutes ago',
      icon: ExclamationTriangleIcon,
    },
    {
      id: 2,
      type: 'info',
      message: 'New vessel added to monitoring: Fishing Vessel "Ocean Explorer"',
      timestamp: '15 minutes ago',
      icon: MapIcon,
    },
    {
      id: 3,
      type: 'warning',
      message: 'High risk prediction for vessel MMSI 987654321 in protected area',
      timestamp: '1 hour ago',
      icon: ExclamationTriangleIcon,
    },
    {
      id: 4,
      type: 'info',
      message: 'Daily risk assessment completed for 2,847 vessels',
      timestamp: '2 hours ago',
      icon: ClockIcon,
    },
    {
      id: 5,
      type: 'warning',
      message: 'Identity switching detected for vessel MMSI 456789123',
      timestamp: '3 hours ago',
      icon: ExclamationTriangleIcon,
    },
  ];

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
      <div className="flow-root">
        <ul className="-mb-8">
          {activities.map((activity, activityIdx) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {activityIdx !== activities.length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                      activity.type === 'warning' 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      <activity.icon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-sm text-gray-500">{activity.message}</p>
                    </div>
                    <div className="text-right text-sm whitespace-nowrap text-gray-500">
                      {activity.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RecentActivity;
