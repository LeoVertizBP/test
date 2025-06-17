import React from 'react';

// Mock data for demonstration
const publisherData = [
  { name: 'AcmeCo', compliance: 92 },
  { name: 'BetaInc', compliance: 78 },
  { name: 'GamesCo', compliance: 85 },
  { name: 'TechFirm', compliance: 67 },
  { name: 'MediaGroup', compliance: 73 }
];

const ComplianceOverview: React.FC = () => {
  // Sort publishers by compliance rate (highest first)
  const sortedPublishers = [...publisherData].sort((a, b) => b.compliance - a.compliance);
  
  return (
    <div className="space-y-4">
      {sortedPublishers.map((publisher) => (
        <div key={publisher.name} className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-primary">{publisher.name}</span>
            <span className="text-sm font-mono text-text-secondary">{publisher.compliance}%</span>
          </div>
          <div className="w-full bg-neutral-light rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                publisher.compliance >= 90 
                  ? 'bg-success' 
                  : publisher.compliance >= 70 
                    ? 'bg-secondary' 
                    : 'bg-warning'
              }`}
              style={{ width: `${publisher.compliance}%` }}
            ></div>
          </div>
        </div>
      ))}
      
      <div className="pt-4 text-center">
        <button className="btn-tertiary"> 
          View All Publishers
        </button>
      </div>
    </div>
  );
};

export default ComplianceOverview;
