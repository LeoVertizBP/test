'use client';

import React, { useState, useEffect } from 'react'; // Import useEffect
import AddRuleModal from './modals/AddRuleModal';
import EditRuleModal from './modals/EditRuleModal';
import { ruleCategories } from './modals/mockData'; // Keep for labels if needed
import ruleService, { Rule } from '@/services/ruleService'; // Import service and type
import advertiserService, { Advertiser } from '@/services/advertiserService'; // Import advertiser service and type

// Define EnhancedRule type for UI display (add counts)
interface EnhancedRule extends Rule {
  products?: number; // Placeholder for product assignment count
  violationCount?: number; // Placeholder for violation count
}


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
  const [categoryFilter, setCategoryFilter] = useState(''); // Keep for semantic category filtering for now
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rules, setRules] = useState<EnhancedRule[]>([]); // State for fetched rules
  const [selectedRule, setSelectedRule] = useState<EnhancedRule | null>(null);
  const [advertisersList, setAdvertisersList] = useState<Advertiser[]>([]); // State for advertisers
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state

  // Fetch rules and advertisers from API
  useEffect(() => {
    const fetchData = async () => { // Renamed function
      setIsLoading(true);
      setError(null);
      try {
        // Fetch rules and advertisers in parallel
        const [productRulesResponse, channelRulesResponse, advertisersResponse] = await Promise.allSettled([
          ruleService.getProductRules(),
          ruleService.getChannelRules(),
          advertiserService.getAdvertisers() // Fetch advertisers
        ]);

        let combinedRules: Rule[] = [];
        if (productRulesResponse.status === 'fulfilled') {
          combinedRules = combinedRules.concat(productRulesResponse.value.data);
        } else {
          console.error("Error fetching product rules:", productRulesResponse.reason);
        }
        if (channelRulesResponse.status === 'fulfilled') {
          combinedRules = combinedRules.concat(channelRulesResponse.value.data);
        } else {
          console.error("Error fetching channel rules:", channelRulesResponse.reason);
        }

        // Enhance data with placeholder counts
        const enhancedData = combinedRules.map((r: Rule) => ({
          ...r,
          products: 0, // Placeholder
          violationCount: 0 // Placeholder
        }));

        setRules(enhancedData);

        // Set advertisers list state
        if (advertisersResponse.status === 'fulfilled') {
          setAdvertisersList(advertisersResponse.value.data);
        } else {
          console.error("Error fetching advertisers:", advertisersResponse.reason);
          // Set error only if rules also failed? Or show partial error?
          if (productRulesResponse.status === 'rejected' && channelRulesResponse.status === 'rejected') {
             setError("Failed to load rules and advertisers list.");
          } else {
             console.warn("Failed to load advertisers list.");
             // Optionally set a specific error for advertisers, but keep rules if they loaded
             // setError("Failed to load advertisers list.");
          }
        }

        // Handle potential partial failures for rules
        if (productRulesResponse.status === 'rejected' && channelRulesResponse.status === 'rejected' && advertisersResponse.status === 'fulfilled') {
           setError("Failed to load any rules, but advertisers loaded.");
        } else if (productRulesResponse.status === 'rejected' || channelRulesResponse.status === 'rejected') {
           console.warn("Partial failure loading rules.");
        }


      } catch (err) { // Catch unexpected errors during Promise.allSettled or mapping
        console.error("Unexpected error fetching data:", err);
        setError("An unexpected error occurred while loading data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData(); // Call the renamed function
  }, []);


  // Get unique categories for filter dropdown from fetched data
  const uniqueCategories = Array.from(new Set(rules.map(rule => rule.category).filter(Boolean))) as string[];

  // Filter rules based on search term and category (use fetched data)
  const filteredRules = rules.filter((rule: EnhancedRule) => {
    // Ensure rule and properties exist before accessing
    const nameMatch = rule.name ? rule.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const descriptionMatch = rule.description ? rule.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = nameMatch || descriptionMatch;
    // Keep filtering by semantic category for now
    const matchesCategory = categoryFilter === '' || (rule.category && rule.category === categoryFilter);
    return matchesSearch && matchesCategory;
  });

  // Removed getSeverityBadgeClass function

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

  // Handle rule submission from modal (Add)
  const handleAddRuleSubmit = async (data: any) => {
    // TODO: Implement actual API call (createProductRule or createChannelRule based on type)
    console.log("Submitting new rule:", data);
    // Optimistic update (basic)
    const categoryLabel = ruleCategories.find(c => c.value === data.category)?.label || data.category;
    const newRule: EnhancedRule = {
      id: `temp-${Date.now()}`, // Temporary ID
      name: data.name,
      description: data.description,
      rule_type: data.rule_type, // Use rule_type from form data
      status: 'active', // Default
      version: data.version || '1.0', // Default (assuming modal might add version later)
      severity: data.severity as Rule['severity'], // Keep severity from form data for optimistic update
      category: categoryLabel,
      advertiser_id: data.advertiser_id, // Assuming modal provides this
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      products: 0, // Placeholder count
      violationCount: 0 // Placeholder count
    };

    // Add the new rule optimistically to the state
    setRules(prev => [newRule, ...prev]);

    // Call the parent component's handler if needed
    if (onAddRule) {
      onAddRule();
    }
  };

  // Handle rule submission from modal (Edit)
  const handleEditRuleSubmit = async (data: any) => {
     if (!selectedRule) return;

    try {
      // TODO: Implement actual API call (updateProductRule or updateChannelRule based on type)
      console.log("Submitting updated rule:", data);

      // Update the rule optimistically in state
      const categoryLabel = ruleCategories.find(c => c.value === data.category)?.label || data.category;
      const updatedRuleData: EnhancedRule = {
        ...(selectedRule as Rule), // Spread existing data
        name: data.name,
        description: data.description,
        category: categoryLabel,
        severity: data.severity as Rule['severity'], // Keep severity from form data
        version: selectedRule?.version || '1.0', // Use existing version or default
        updated_at: new Date().toISOString(),
        // Keep placeholder counts
        products: selectedRule?.products ?? 0,
        violationCount: selectedRule?.violationCount ?? 0,
      };
      setRules(prev =>
        prev.map(r => (r.id === selectedRule?.id ? updatedRuleData : r))
      );
      setShowEditModal(false);
      setSelectedRule(null);
    } catch (error) {
       console.error("Error updating rule:", error);
       setError("Failed to update rule. Please try again.");
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

       {/* Loading State */}
       {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin mr-2">⟳</div>
          Loading rules...
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && ( // Only show error if not loading
        <div className="alert alert-error">
          <p>{error}</p>
           {/* Optional: Add a retry button similar to other components */}
        </div>
      )}


      {/* Rules Table */}
      {!isLoading && !error && (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Rule</th>
                <th className="table-header text-left">Type</th> {/* Changed Category to Type */}
                {/* <th className="table-header text-left">Severity</th> */} {/* Removed Severity column */}
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
                     {/* Display rule_type */}
                    <div>{rule.rule_type}</div>
                  </td>
                  {/* Removed Severity cell */}
                  {/* <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadgeClass(rule.severity)}`}>
                      {rule.severity}
                    </span>
                  </td> */}
                  <td className="py-3 px-4 text-center">
                    <span className="bg-background px-2 py-1 rounded-full text-sm">
                      {rule.products ?? 0} {/* Use nullish coalescing */}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-bold text-error">
                      {rule.violationCount ?? 0} {/* Use nullish coalescing */}
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
      )}

      {/* Add Rule Modal */}
      <AddRuleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddRuleSubmit} // Use correct handler name
        advertisers={advertisersList} // Pass advertisers list
      />

      {/* Edit Rule Modal */}
      <EditRuleModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditRuleSubmit} // Use correct handler name
        // Pass selectedRule, ensuring optional fields have defaults for EditRuleModal compatibility
        rule={selectedRule ? {
          ...selectedRule,
          // category: selectedRule.category || '', // Removed category
          description: selectedRule.description || '',
          // Ensure products and violationCount are numbers for the modal if it expects them
          products: selectedRule.products || 0,
          violationCount: selectedRule.violationCount || 0,
          // Severity is handled by the modal's internal state based on its props
        } : null}
        advertisers={advertisersList} // Pass advertisers list
      />
    </div>
  );
};

export default RuleManagement;
