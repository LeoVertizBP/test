'use client';

import React, { useState, useEffect } from 'react'; // Import useEffect
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import AddRuleSetModal from './modals/AddRuleSetModal';
import EditRuleSetModal from './modals/EditRuleSetModal';
import { ruleSetTypes } from './modals/mockData'; // Keep for type label if needed
// Correct service import assuming functions are in ruleService
import ruleService, { RuleSet } from '@/services/ruleService';

// Remove Mock data for rule sets
/*
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
*/

// Define EnhancedRuleSet type for UI display (add counts)
interface EnhancedRuleSet extends RuleSet {
  rules?: number; // Placeholder for rule count
  assignedProducts?: number; // Placeholder for product assignment count
}

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
  // const [ruleSets, setRuleSets] = useState(mockRuleSets); // Remove mock data state
  const [ruleSets, setRuleSets] = useState<EnhancedRuleSet[]>([]); // Use EnhancedRuleSet type
  const [selectedRuleSet, setSelectedRuleSet] = useState<EnhancedRuleSet | null>(null); // Use EnhancedRuleSet type
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state
  const router = useRouter();

  // Fetch rule sets from API
  useEffect(() => {
    const fetchRuleSets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use ruleService and assume getRuleSets function exists
        const response = await ruleService.getRuleSets();
        // Enhance data with placeholder counts (implement real counts later)
        const enhancedData = response.data.map((rs: RuleSet) => ({ // Add type annotation
          ...rs,
          rules: 0, // Placeholder
          assignedProducts: 0 // Placeholder
        }));
        setRuleSets(enhancedData);
      } catch (err) {
        console.error("Error fetching rule sets:", err);
        setError("Failed to load rule sets. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRuleSets();
  }, []);


  // Filter rule sets based on search term (use fetched data)
  const filteredRuleSets = ruleSets.filter((ruleSet: EnhancedRuleSet) => { // Add type annotation
    // Ensure description is checked safely as it might be null/undefined
    return ruleSet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (ruleSet.description && ruleSet.description.toLowerCase().includes(searchTerm.toLowerCase()));
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
  
  // Handle rule set submission from modal (Add)
  const handleAddRuleSetSubmit = async (data: any) => {
    // Prepare data for API (ensure fields match RuleSet interface expected by createRuleSet)
    // Note: The backend might expect advertiser_id, name, set_type, description, is_default
    // The RuleSet interface in ruleService has: id, name, description?, status, advertiser_id?, is_global, version, created_at, updated_at
    // We need to align what the modal sends (data) with what createRuleSet expects.
    // Assuming modal sends: name, description, advertiser_id, set_type, is_default, is_global
    const ruleSetData = {
      name: data.name,
      description: data.description || null, // Send null if empty
      advertiser_id: data.advertiser_id,
      // set_type: data.set_type, // set_type is NOT in the RuleSet interface, backend might handle this based on rules added? Or needs adding to interface/backend.
      is_default: data.is_default || false, // is_default is NOT in the RuleSet interface
      is_global: data.is_global || false,
      status: 'active', // Default status
      version: '1.0'   // Default version
    };

    // Validate required fields for API call
    if (!ruleSetData.name || !ruleSetData.advertiser_id /* || !ruleSetData.set_type */) {
       setError("Missing required fields (Name, Advertiser) to create rule set.");
       console.error("Missing required fields for rule set creation:", ruleSetData);
       return; // Stop submission
    }


    try {
      setIsLoading(true); // Indicate loading state
      // Use the correct service function (assuming createRuleSet exists and takes this shape)
      const createdRuleSetResponse = await ruleService.createRuleSet(ruleSetData as Omit<RuleSet, 'id' | 'created_at' | 'updated_at'>);

      // Enhance the created rule set with placeholder counts for UI
      const enhancedNewRuleSet: EnhancedRuleSet = {
        ...createdRuleSetResponse.data, // Use data from API response
        rules: 0, // Placeholder - rules are added separately
        assignedProducts: 0 // Placeholder
      };

      // Add the *actual* new rule set from the API response to the state
      setRuleSets(prev => [enhancedNewRuleSet, ...prev]);
      setShowAddModal(false); // Close modal on success

      // Call the parent component's handler if needed
      if (onAddRuleSet) {
        onAddRuleSet();
      }
    } catch (err) {
       console.error("Error creating rule set:", err);
       setError("Failed to create rule set. Please try again.");
       // Keep modal open to show error? Or close and show error on main page?
       // For now, just log error and set error state.
    } finally {
       setIsLoading(false); // End loading state
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
        onSubmit={handleAddRuleSetSubmit} // Use new handler name
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
          
          // TODO: Implement actual API call to update rule set
          console.log("Submitting updated rule set:", data);
          // TODO: Implement actual API call to update rule set using ruleService.updateRuleSet
          console.log("Submitting updated rule set:", data);
          // Update the rule set optimistically in state
          // Ensure we only update fields present in the form data and RuleSet interface
          const updatedRuleSetData: EnhancedRuleSet = {
            ...(selectedRuleSet as RuleSet), // Spread existing data from the base type
            name: data.name,
            description: data.description || undefined, // Handle optional description
            // is_default: data.is_default, // is_default is not part of RuleSet interface
            // Update placeholder counts if rules are passed back from modal
            rules: data.rules?.length ?? selectedRuleSet?.rules ?? 0,
            assignedProducts: selectedRuleSet?.assignedProducts ?? 0, // Keep existing placeholder
            updated_at: new Date().toISOString(),
            // Ensure other required fields from RuleSet are maintained
            status: selectedRuleSet?.status ?? 'active',
            is_global: selectedRuleSet?.is_global ?? false,
            version: selectedRuleSet?.version ?? '1.0',
            advertiser_id: selectedRuleSet?.advertiser_id, // Keep original advertiser_id
            created_at: selectedRuleSet?.created_at ?? '', // Keep original created_at
          };
          setRuleSets(prev =>
            prev.map(rs => (rs.id === selectedRuleSet?.id ? updatedRuleSetData : rs))
          );
          setShowEditModal(false); // Close modal after optimistic update
          setSelectedRuleSet(null);
        }}
        // Pass selectedRuleSet, ensuring description is a string and counts are numbers for RuleSetData compatibility
        ruleSet={selectedRuleSet ? {
          ...selectedRuleSet,
          description: selectedRuleSet.description || '',
          rules: selectedRuleSet.rules || 0, // Default rules to 0 if undefined
          assignedProducts: selectedRuleSet.assignedProducts || 0 // Default assignedProducts to 0 if undefined
        } : null}
      />
    </div>
  );
};

export default RuleSetManagement;
