'use client';

import React, { useState } from 'react';
import AddRuleModal from './modals/AddRuleModal';
import EditRuleModal from './modals/EditRuleModal';
import { ruleCategories, ruleSeverities } from './modals/mockData';

// Mock data for rules
const mockRules = [
  { 
    id: '201', 
    name: 'Fee Disclosure', 
    category: 'Financial Terms',
    severity: 'high',
    description: 'Fee disclosures must clearly state all conditions and duration of promotional fee waivers.',
    products: 6,
    violationCount: 18
  },
  { 
    id: '202', 
    name: 'APR Transparency', 
    category: 'Financial Terms',
    severity: 'high',
    description: 'APR statements must disclose the full range of possible rates and qualifying factors prominently.',
    products: 8,
    violationCount: 24
  },
  { 
    id: '203', 
    name: 'Rewards Limitations', 
    category: 'Rewards',
    severity: 'medium',
    description: 'Rewards promotions must disclose any category limitations, caps, or expiration terms.',
    products: 4,
    violationCount: 15
  },
  { 
    id: '204', 
    name: 'Benefits Timeline', 
    category: 'Benefits',
    severity: 'medium',
    description: 'Card benefit availability must include clear timeline for activation and any qualifying actions.',
    products: 5,
    violationCount: 8
  },
  { 
    id: '205', 
    name: 'Balance Transfer Terms', 
    category: 'Financial Terms',
    severity: 'high',
    description: 'Balance transfer offers must clearly disclose fees, promotional periods, and standard rates after promotion ends.',
    products: 3,
    violationCount: 12
  }
];

interface RuleManagementProps {
  onAddRule: () => void;
  onEditRule: (id: string) => void;
  onViewRuleViolations: (id: string) => void;
}

const RuleManagement: React.FC<RuleManagementProps> = ({ 
  onAddRule, 
  onEditRule,
  onViewRuleViolations
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rules, setRules] = useState(mockRules);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  
  // Get unique categories for filter dropdown
  const uniqueCategories = Array.from(new Set(mockRules.map(rule => rule.category)));
  
  // Filter rules based on search term and category
  const filteredRules = mockRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || rule.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // Get severity badge class
  const getSeverityBadgeClass = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-error bg-opacity-20 text-error';
      case 'medium':
        return 'bg-warning bg-opacity-20 text-warning';
      case 'low':
        return 'bg-success bg-opacity-20 text-success';
      default:
        return 'bg-secondary bg-opacity-20 text-secondary';
    }
  };
  
  // Handle adding a new rule
  const handleAddRuleClick = () => {
    setShowAddModal(true);
  };
  
  // Handle editing a rule
  const handleEditRuleClick = (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (rule) {
      setSelectedRule(rule);
      setShowEditModal(true);
    }
    
    // Also call the parent component's handler
    if (onEditRule) {
      onEditRule(id);
    }
  };
  
  // Handle viewing violations for a rule
  const handleViewViolationsClick = (id: string) => {
    // Call the parent component's handler
    if (onViewRuleViolations) {
      onViewRuleViolations(id);
    }
  };
  
  // Handle rule submission from modal
  const handleRuleSubmit = (data: any) => {
    // Get category and severity labels for display
    const categoryLabel = ruleCategories.find(c => c.value === data.category)?.label || data.category;
    const severityLabel = ruleSeverities.find(s => s.value === data.severity)?.label || data.severity;
    
    const newRule = {
      id: `new-${Date.now()}`, // Generate a temporary ID
      name: data.name,
      category: categoryLabel,
      severity: data.severity.toLowerCase(),
      description: data.description,
      products: 0, // New rule has no products yet
      violationCount: 0 // No violations for new rule
    };
    
    // Add the new rule to the state
    setRules(prev => [newRule, ...prev]);
    
    // Call the parent component's handler if needed
    if (onAddRule) {
      onAddRule();
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Rules</h2>
        <button 
          className="btn-primary"
          onClick={handleAddRuleClick}
        >
          Add Rule
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input"
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Rules Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header text-left">Rule</th>
              <th className="table-header text-left">Category</th>
              <th className="table-header text-left">Severity</th>
              <th className="table-header text-center">Products</th>
              <th className="table-header text-center">Violations</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule, index) => (
              <tr key={rule.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                <td className="py-3 px-4">
                  <div className="font-medium">{rule.name}</div>
                  <div className="text-sm text-text-secondary truncate max-w-[400px]">{rule.description}</div>
                </td>
                <td className="py-3 px-4">
                  <div>{rule.category}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadgeClass(rule.severity)}`}>
                    {rule.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="bg-background px-2 py-1 rounded-full text-sm">
                    {rule.products}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="font-bold text-error">
                    {rule.violationCount}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button 
                      className="btn-tertiary"
                      onClick={() => handleEditRuleClick(rule.id)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-tertiary"
                      onClick={() => handleViewViolationsClick(rule.id)}
                    >
                      View Violations
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredRules.length === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No rules match your filters</p>
          </div>
        )}
      </div>
      
      {/* Add Rule Modal */}
      <AddRuleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleRuleSubmit}
      />
      
      {/* Edit Rule Modal */}
      <EditRuleModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={(data) => {
          if (!selectedRule) return;
          
          // Update the rule with edited data
          const updatedRule = {
            ...selectedRule,
            name: data.name,
            category: ruleCategories.find(c => c.value === data.category)?.label || data.category,
            severity: data.severity,
            description: data.description
          };
          
          // Update the rule in state
          setRules(prev => 
            prev.map(r => r.id === selectedRule.id ? updatedRule : r)
          );
        }}
        rule={selectedRule}
      />
    </div>
  );
};

export default RuleManagement;
