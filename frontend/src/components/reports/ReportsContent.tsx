'use client';

import React from 'react';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';

const ReportsContent: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href={ROUTES.DASHBOARD}>
            <button 
              type="button"
              className="btn-secondary mr-4 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Dashboard
            </button>
          </Link>
          <h1>Reports</h1>
        </div>
        <button className="btn-primary">Generate Report</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card card-hover col-span-full md:col-span-1">
          <h2 className="mb-4">Report Types</h2>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-background rounded-input cursor-pointer hover:bg-opacity-80 transition-colors">
              <div className="w-4 h-4 rounded-full bg-secondary mr-3"></div>
              <span>Compliance Summary</span>
            </div>
            <div className="flex items-center p-3 bg-background rounded-input cursor-pointer hover:bg-opacity-80 transition-colors">
              <div className="w-4 h-4 rounded-full bg-primary mr-3"></div>
              <span>Flag Resolution Details</span>
            </div>
            <div className="flex items-center p-3 bg-background rounded-input cursor-pointer hover:bg-opacity-80 transition-colors">
              <div className="w-4 h-4 rounded-full bg-success mr-3"></div>
              <span>Publisher Performance</span>
            </div>
            <div className="flex items-center p-3 bg-background rounded-input cursor-pointer hover:bg-opacity-80 transition-colors">
              <div className="w-4 h-4 rounded-full bg-warning mr-3"></div>
              <span>Rule Violation Frequency</span>
            </div>
            <div className="flex items-center p-3 bg-background rounded-input cursor-pointer hover:bg-opacity-80 transition-colors">
              <div className="w-4 h-4 rounded-full bg-error mr-3"></div>
              <span>Scan Job History</span>
            </div>
          </div>
        </div>
        
        <div className="card card-hover col-span-full md:col-span-2">
          <h2 className="mb-4">Recent Reports</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-light">
                <th className="text-left py-3 px-4 font-semibold text-sm">Report Name</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Generated</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Type</th>
                <th className="text-center py-3 px-4 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-light">
                <td className="py-3 px-4">Q2 Compliance Summary</td>
                <td className="py-3 px-4">2025-04-25</td>
                <td className="py-3 px-4">
                  <span className="status-pill bg-secondary bg-opacity-10 text-secondary">Summary</span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button className="btn-tertiary">Download</button>
                </td>
              </tr>
              <tr className="border-b border-neutral-light">
                <td className="py-3 px-4">AcmeCo Performance Report</td>
                <td className="py-3 px-4">2025-04-22</td>
                <td className="py-3 px-4">
                  <span className="status-pill bg-success bg-opacity-10 text-success">Publisher</span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button className="btn-tertiary">Download</button>
                </td>
              </tr>
              <tr className="border-b border-neutral-light">
                <td className="py-3 px-4">Violations by Product</td>
                <td className="py-3 px-4">2025-04-18</td>
                <td className="py-3 px-4">
                  <span className="status-pill bg-error bg-opacity-10 text-error">Violations</span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button className="btn-tertiary">Download</button>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4">March 2025 Audit Report</td>
                <td className="py-3 px-4">2025-04-05</td>
                <td className="py-3 px-4">
                  <span className="status-pill bg-primary bg-opacity-10 text-primary">Audit</span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button className="btn-tertiary">Download</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="card card-hover">
        <h2 className="mb-4">Report Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Export Format</h3>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <input type="radio" id="pdf" name="format" className="mr-2" checked readOnly />
                <label htmlFor="pdf">PDF</label>
              </div>
              <div className="flex items-center">
                <input type="radio" id="csv" name="format" className="mr-2" readOnly />
                <label htmlFor="csv">CSV</label>
              </div>
              <div className="flex items-center">
                <input type="radio" id="xlsx" name="format" className="mr-2" readOnly />
                <label htmlFor="xlsx">Excel</label>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Auto-Schedule Reports</h3>
            <div className="flex items-center">
              <input type="checkbox" id="schedule" className="mr-2" readOnly />
              <label htmlFor="schedule">Enable weekly report emails</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsContent;
