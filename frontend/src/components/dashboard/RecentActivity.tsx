import React from 'react';

interface RecentActivityProps {
  activities: string[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div 
          key={index} 
          className="flex items-start p-3 rounded-input bg-background border border-neutral-light hover:shadow-card transition-shadow duration-200"
        >
          <div className="flex-shrink-0 mr-3 pt-1">
            <div className="w-2 h-2 rounded-full bg-secondary"></div>
          </div>
          <p className="text-text-primary text-sm">{activity}</p>
        </div>
      ))}
      
      {activities.length === 0 && (
        <div className="text-center py-6 text-text-secondary">
          <p>No recent activity</p>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
