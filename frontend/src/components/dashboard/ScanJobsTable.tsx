import React from 'react';

interface ScanJob {
  id: number;
  name: string;
  startDate: string;
  status: 'Completed' | 'Running' | 'Pending' | string; // Allow other statuses if needed
  items: number;
  flags: number;
  pending: number;
  progress: number;
}

interface ScanJobsTableProps {
  scanJobs: ScanJob[];
  // Add onSelectJob prop later for navigation
}

const ScanJobsTable: React.FC<ScanJobsTableProps> = ({ scanJobs }) => {
  return (
    <div className="overflow-x-auto table-container">
      <table className="min-w-full divide-y divide-neutral-light">
        <thead>
          <tr>
            <th className="table-header text-left">Name</th>
            <th className="table-header text-left">Started</th>
            <th className="table-header text-left">Status</th>
            <th className="table-header text-right">Items</th>
            <th className="table-header text-right">Flags</th>
            <th className="table-header text-right">Pending</th>
            <th className="table-header text-right">Progress</th>
            <th className="table-header text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-light">
          {scanJobs.map((job, index) => (
            <tr 
              key={job.id} 
              className={index % 2 === 0 ? 'table-row' : 'table-row-alt'} 
            >
              <td className="px-3 py-4 text-left text-text-primary text-sm">{job.name}</td>
              <td className="px-3 py-4 text-left text-text-secondary text-sm">{job.startDate}</td>
              <td className="px-3 py-4 text-left">
                <span className={`status-pill ${
                  job.status === 'Running' 
                    ? 'bg-secondary bg-opacity-10 text-secondary' 
                    : job.status === 'Completed' 
                      ? 'status-success' 
                      : 'status-warning' // Default to warning for Pending etc.
                }`}>
                  {job.status}
                </span>
              </td>
              <td className="px-3 py-4 text-right font-mono text-text-secondary text-sm">{job.items}</td>
              <td className="px-3 py-4 text-right font-mono text-text-secondary text-sm">{job.flags}</td>
              <td className="px-3 py-4 text-right font-mono text-text-secondary text-sm">{job.pending}</td>
              <td className="px-3 py-4 text-right">
                <div className="flex items-center justify-end">
                  <div className="w-20 bg-neutral-light rounded-full h-2 mr-2">
                    <div 
                      className={`h-2 rounded-full ${
                        job.progress === 100 
                          ? 'bg-success' 
                          : job.progress > 0 
                            ? 'bg-secondary' 
                            : 'bg-warning'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">{job.progress}%</span>
                </div>
              </td>
              <td className="px-3 py-4 text-right">
                <button 
                  className="text-secondary hover:text-primary transition-colors duration-200 text-sm font-medium"
                  onClick={() => console.log(`View scan job ${job.id}`)} // Add navigation later
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
       {scanJobs.length === 0 && (
        <div className="text-center py-8 text-text-secondary">
          <p>No scan jobs found.</p>
        </div>
      )}
    </div>
  );
};

export default ScanJobsTable;
