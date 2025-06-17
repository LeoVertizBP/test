'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import AddRuleSetModal from './modals/AddRuleSetModal';
import EditRuleSetModal from './modals/EditRuleSetModal';
import { ruleSetTypes } from './modals/mockData';

// Mock data for rule sets
const mockRuleSets = [
  { 
    id: '301', 
    name: 'Core Compliance', 
    description: 'Basic compliance rules that apply to all financial products',
    rules: 18,
    assignedProducts: 12
  },
  { 
    id: '302', 
    name: 'Premium Card Requirements', 
    description: 'Specific rules for premium credit card products',
    rules: 24,
    assignedProducts: 8
  },
  { 
    id: '303', 
    name: 'Travel Card Compliance', 
    description: 'Rules specific to travel reward cards and their promotions',
    rules: 15,
    assignedProducts: 4
  }
];

interface RuleSetManagementProps {
  onAddRuleSet: () => void;
  onEditRuleSet: (id: string) => void;
  onViewRuleSetDetails: (id: string) => void;
}

const RuleSetManagement: React.FC<RuleSetManagementProps> = ({ 
  onAddRuleSet, 
  onEditRuleSet,
  onViewRuleSetDetails
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [ruleSets, setRuleSets] = useState(mockRuleSets);
  const [selectedRuleSet, setSelectedRuleSet] = useState<any>(null);
  const router = useRouter();
  
  // Filter rule sets based on search term
  const filteredRuleSets = mockRuleSets.filter(ruleSet => {
    return ruleSet.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           ruleSet.description.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  // Handle adding a new rule set
  const handleAddRuleSetClick = () => {
    setShowAddModal(true);
  };
  
  // Handle editing a rule set
  const handleEditRuleSetClick = (id: string) => {
    const ruleSet = ruleSets.find(rs => rs.id === id);
    if (ruleSet) {
      setSelectedRuleSet(ruleSet);
      setShowEditModal(true);
    }
    
    // Also call the parent component's handler
    if (onEditRuleSet) {
      onEditRuleSet(id);
    }
  };
  
  // Handle viewing rule set details
  const handleViewRuleSetDetailsClick = (id: string) => {
    // Call the parent component's handler
    if (onViewRuleSetDetails) {
      onViewRuleSetDetails(id);
    }
  };
  
  // Handle rule set submission from modal
  const handleRuleSetSubmit = (data: any) => {
    // Get type label for display
    const typeLabel = ruleSetTypes.find(t => t.value === data.type)?.label || 'Custom';
    
    const newRuleSet = {
      id: `new-${Date.now()}`, // Generate a temporary ID
      name: data.name,
      description: data.description,
      rules: data.rules.length, // Number of included rules
      assignedProducts: 0 // New rule set has no assigned products yet
    };
    
    // Add the new rule set to the state
    setRuleSets(prev => [newRuleSet, ...prev]);
    
    // Call the parent component's handler if needed
    if (onAddRuleSet) {
      onAddRuleSet();
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Rule Sets</h2>
        <button 
          className="btn-primary"
          onClick={handleAddRuleSetClick}
        >
          Create Rule Set
        </button>
      </div>
      
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search rule sets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-full"
        />
      </div>
      
      {/* Rule Sets Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRuleSets.map(ruleSet => (
          <div key={ruleSet.id} className="card">
            <div className="flex justify-between items-start">
              <h3>{ruleSet.name}</h3>
              <button 
                className="btn-tertiary text-sm"
                onClick={() => handleEditRuleSetClick(ruleSet.id)}
              >
                Edit
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-6">{ruleSet.description}</p>
            
            <div className="flex justify-between items-center">
              <div className="flex space-x-4">
                <div className="flex flex-col items-center">
                  <span className="text-h3 font-bold text-secondary">{ruleSet.rules}</span>
                  <span className="text-xs text-text-secondary">Rules</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-h3 font-bold text-primary">{ruleSet.assignedProducts}</span>
                  <span className="text-xs text-text-secondary">Products</span>
                </div>
              </div>
              <button 
                className="btn-secondary"
                onClick={() => handleViewRuleSetDetailsClick(ruleSet.id)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
        
        {filteredRuleSets.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-8 text-text-secondary">
            <p>No rule sets match your search</p>
          </div>
        )}
      </div>
      
      {/* Add Rule Set Modal */}
      <AddRuleSetModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleRuleSetSubmit}
      />
      
      {/* Edit Rule Set Modal */}
      <EditRuleSetModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={(data) => {
          if (!selectedRuleSet) return;
          
          // Update the rule set with edited data
          const updatedRuleSet = {
            ...selectedRuleSet,
            name: data.name,
            description: data.description,
            rules: data.rules.length || selectedRuleSet.rules
          };
          
          // Update the rule set in state
          setRuleSets(prev => 
            prev.map(rs => rs.id === selectedRuleSet.id ? updatedRuleSet : rs)
          );
        }}
        ruleSet={selectedRuleSet}
      />
    </div>
  );
};

export default RuleSetManagement;
