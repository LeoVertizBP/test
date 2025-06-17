'use client';

import React, { useState } from 'react';

interface PublisherComplianceData {
  id: string;
  name: string;
  itemsScanned: number;
  violationsFound: number;
  violationRate: number;
  avgRemediationTimeHours: number;
  trend: number; // Positive means improving (lower violation rate), negative means worsening
  remediationTrend: number; // Positive means improving (faster remediation), negative means worsening
}

interface EnhancedComplianceOverviewProps {
  publishers: PublisherComplianceData[];
  itemsPerPage?: number;
}

const EnhancedComplianceOverview: React.FC<EnhancedComplianceOverviewProps> = ({ 
  publishers,
  itemsPerPage = 5 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(publishers.length / itemsPerPage);
  
  // Calculate the current page of publishers to display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPublishers = publishers.slice(startIndex, endIndex);
  
  const getTrendIcon = (trend: number) => {
    if (trend > 5) {
      return (
        <div className="flex items-center text-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">+{trend}%</span>
        </div>
      );
    } else if (trend > 0) {
      return (
        <div className="flex items-center text-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">+{trend}%</span>
        </div>
      );
    } else if (trend < -5) {
      return (
        <div className="flex items-center text-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">{trend}%</span>
        </div>
      );
    } else if (trend < 0) {
      return (
        <div className="flex items-center text-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">{trend}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-neutral-gray">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7.586 5H7a3 3 0 00-3 3v6a3 3 0 003 3h6a3 3 0 003-3v-.586l1.293 1.293A1 1 0 0019 14.707V7.293a1 1 0 00-1.707-.707L15 8.879V7.5a1 1 0 00-1-1h-1.672l-.311-.31A4.503 4.503 0 008.8 5H7.5a1 1 0 00-1 1v.172l-.31.31A4.503 4.503 0 003 8.8V7.5a1 1 0 00-1-1H1.5a1 1 0 000 2h.672l-.311.31A4.503 4.503 0 000 11.2v1.3a1 1 0 001 1h1.5a1 1 0 001-1v-.672l.31-.31A4.503 4.503 0 004.8 15H5v1.5a1 1 0 002 0V15h6v1.5a1 1 0 002 0V15h.5a1 1 0 001-1v-1.5a1 1 0 00-1-1h-1.672l-.311-.31A4.503 4.503 0 0011.2 10H10V8.5a1 1 0 00-1-1H7.5V6a1 1 0 00-1-1h-.672l-.31-.31A4.503 4.503 0 005 3.2V2z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">0%</span>
        </div>
      );
    }
  };
  
  const getViolationRateColor = (rate: number): string => {
    if (rate < 5) return 'text-success';
    if (rate < 10) return 'text-warning';
    return 'text-error';
  };
  
  const formatHours = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };
  
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header text-left">Publisher</th>
              <th className="table-header text-center">Items Scanned <span className="text-xs font-normal">(90 days)</span></th>
              <th className="table-header text-center">Violations <span className="text-xs font-normal">(90 days)</span></th>
              <th className="table-header text-center">Violation Rate <span className="text-xs font-normal">(90 days)</span></th>
              <th className="table-header text-center">Avg. Remediation <span className="text-xs font-normal">(90 days)</span></th>
            </tr>
          </thead>
          <tbody>
            {currentPublishers.map((publisher, index) => (
              <tr key={publisher.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                <td className="py-3 px-4">
                  <div className="font-medium">{publisher.name}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div>{publisher.itemsScanned}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div>{publisher.violationsFound}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center">
                    <div className={`font-bold ${getViolationRateColor(publisher.violationRate)} mr-2`}>
                      {publisher.violationRate}%
                    </div>
                    <div className="scale-75">
                      {getTrendIcon(publisher.trend)}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center">
                    <div className="mr-2">
                      {formatHours(publisher.avgRemediationTimeHours)}
                    </div>
                    <div className="scale-75">
                      {getTrendIcon(publisher.remediationTrend)}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-text-secondary">
            Showing {startIndex + 1}-{Math.min(endIndex, publishers.length)} of {publishers.length} publishers
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-btn bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-btn bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <button className="text-sm text-secondary hover:underline">
            Download Full Report
          </button>
        </div>
      )}
    </div>
  );
};

// For demo or development, export a component with mock data
export const EnhancedComplianceOverviewDemo: React.FC = () => {
  const mockPublishers: PublisherComplianceData[] = [
    { id: '1', name: 'AcmeCo', itemsScanned: 124, violationsFound: 18, violationRate: 14.5, avgRemediationTimeHours: 24.5, trend: -3.2, remediationTrend: 5.8 },
    { id: '2', name: 'BetaInc', itemsScanned: 86, violationsFound: 4, violationRate: 4.7, avgRemediationTimeHours: 8.3, trend: 6.8, remediationTrend: 12.3 },
    { id: '3', name: 'GamesCo', itemsScanned: 156, violationsFound: 22, violationRate: 14.1, avgRemediationTimeHours: 36.2, trend: -7.3, remediationTrend: -4.2 },
    { id: '4', name: 'TechFirm', itemsScanned: 67, violationsFound: 5, violationRate: 7.5, avgRemediationTimeHours: 12.8, trend: 1.4, remediationTrend: 8.7 },
    { id: '5', name: 'MediaGroup', itemsScanned: 93, violationsFound: 8, violationRate: 8.6, avgRemediationTimeHours: 18.7, trend: 0, remediationTrend: 0 },
    { id: '6', name: 'FinanceDaily', itemsScanned: 45, violationsFound: 4, violationRate: 8.9, avgRemediationTimeHours: 6.2, trend: 4.2, remediationTrend: 15.6 },
    { id: '7', name: 'CreditSource', itemsScanned: 78, violationsFound: 9, violationRate: 11.5, avgRemediationTimeHours: 48.3, trend: -5.6, remediationTrend: -8.9 },
    { id: '8', name: 'CardReviews', itemsScanned: 112, violationsFound: 6, violationRate: 5.4, avgRemediationTimeHours: 10.5, trend: 8.7, remediationTrend: 6.4 }
  ];
  
  return <EnhancedComplianceOverview publishers={mockPublishers} />;
};

export default EnhancedComplianceOverview;
