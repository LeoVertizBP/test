'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';

// Mock data for a single rule set
const mockRuleSet = {
  id: '301',
  name: 'Core Compliance',
  description: 'Basic compliance rules that apply to all financial products',
  rules: [
    { id: '101', name: 'APR Disclosure', description: 'Annual percentage rate must be clearly disclosed in all promotional materials', severity: 'High' },
    { id: '102', name: 'Fee Disclosure', description: 'All fees must be clearly stated, including conditions and timing', severity: 'High' },
    { id: '103', name: 'Reward Terms', description: 'Reward program terms and limitations must be disclosed', severity: 'Medium' },
    { id: '104', name: 'Promotional Period', description: 'Start and end dates of promotional periods must be clearly stated', severity: 'Medium' },
  ],
  products: [
    'Premium Travel Card',
    'Cash Back Card',
    'Student Credit Builder',
    'Business Rewards Plus'
  ]
};

interface RuleSetDetailProps {
  ruleSetId: string;
}

const RuleSetDetail: React.FC<RuleSetDetailProps> = ({ ruleSetId }) => {
  // We don't need router here since we're using Link for navigation
  const [activeTab, setActiveTab] = useState<'rules' | 'products'>('rules');
  
  // In a real implementation, this would fetch the rule set data based on the ID
  const ruleSet = mockRuleSet;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href={ROUTES.MANAGEMENT}>
            <button 
              type="button"
              className="btn-secondary mr-4 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Management
            </button>
          </Link>
          <h2>{ruleSet.name}</h2>
        </div>
        <button className="btn-primary">Edit Rule Set</button>
      </div>
      
      <p className="text-text-secondary">{ruleSet.description}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 text-center">
          <h3 className="text-text-secondary text-sm mb-1">Rules</h3>
          <span className="text-h1 font-bold text-secondary">{ruleSet.rules.length}</span>
        </div>
        <div className="card p-6 text-center">
          <h3 className="text-text-secondary text-sm mb-1">Products</h3>
          <span className="text-h1 font-bold text-primary">{ruleSet.products.length}</span>
        </div>
        <div className="card p-6 text-center">
          <h3 className="text-text-secondary text-sm mb-1">Active Scans</h3>
          <span className="text-h1 font-bold text-warning">3</span>
        </div>
        <div className="card p-6 text-center">
          <h3 className="text-text-secondary text-sm mb-1">Active Flags</h3>
          <span className="text-h1 font-bold text-error">8</span>
        </div>
      </div>
      
      <div className="card overflow-hidden">
        <div className="bg-background p-4 border-b border-neutral-light">
          <div className="flex">
            <button 
              className={`px-4 py-2 ${activeTab === 'rules' ? 'border-b-2 border-secondary font-medium text-secondary' : 'text-text-secondary'}`}
              onClick={() => setActiveTab('rules')}
            >
              Rules
            </button>
            <button 
              className={`px-4 py-2 ${activeTab === 'products' ? 'border-b-2 border-secondary font-medium text-secondary' : 'text-text-secondary'}`}
              onClick={() => setActiveTab('products')}
            >
              Assigned Products
            </button>
          </div>
        </div>
        
        {activeTab === 'rules' && (
          <div className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-light">
                  <th className="text-left py-3 px-4 font-semibold text-sm">Rule Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Description</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm">Severity</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ruleSet.rules.map(rule => (
                  <tr key={rule.id} className="border-b border-neutral-light hover:bg-background transition-colors">
                    <td className="py-3 px-4">{rule.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{rule.description}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`status-pill ${
                        rule.severity === 'High' ? 'bg-error bg-opacity-10 text-error' : 
                        rule.severity === 'Medium' ? 'bg-warning bg-opacity-10 text-warning' :
                        'bg-success bg-opacity-10 text-success'
                      }`}>
                        {rule.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="btn-tertiary">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === 'products' && (
          <div className="p-4">
            <div className="space-y-3">
              {ruleSet.products.map((product, index) => (
                <div key={index} className="p-3 bg-background rounded-md flex justify-between items-center">
                  <span>{product}</span>
                  <button className="btn-tertiary">View</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleSetDetail;

// For demo or development
export const RuleSetDetailDemo: React.FC = () => {
  // In a real app, you'd use the router or a hook to get the ID
  return <RuleSetDetail ruleSetId="301" />;
};
