'use client';

import React, { useState } from 'react';
import AddAdvertiserModal from './modals/AddAdvertiserModal';
import EditAdvertiserModal from './modals/EditAdvertiserModal';

// Mock data for advertisers
const mockAdvertisers = [
  { 
    id: '1', 
    name: 'Chase', 
    status: 'Active', 
    contactInfo: { email: 'compliance@chase.com', phone: '555-123-4567' },
    products: [
      { name: 'Chase Sapphire Reserve', status: 'Active', lastScanned: '2025-04-23' },
      { name: 'Chase Freedom', status: 'Active', lastScanned: '2025-04-22' },
    ],
    totalProducts: 24,
    totalFlags: 58,
    complianceRate: 91
  },
  { 
    id: '2', 
    name: 'Amex', 
    status: 'Active', 
    contactInfo: { email: 'marketing@amex.com', phone: '555-987-6543' },
    products: [
      { name: 'Amex Platinum', status: 'Active', lastScanned: '2025-04-25' },
      { name: 'Amex Gold', status: 'Active', lastScanned: '2025-04-24' },
    ],
    totalProducts: 18,
    totalFlags: 32,
    complianceRate: 88
  },
  { 
    id: '3', 
    name: 'Discover', 
    status: 'Active', 
    contactInfo: { email: 'partners@discover.com', phone: '555-333-8888' },
    products: [
      { name: 'Discover it Cash Back', status: 'Active', lastScanned: '2025-04-22' },
    ],
    totalProducts: 6,
    totalFlags: 15,
    complianceRate: 94
  },
  { 
    id: '4', 
    name: 'Capital One', 
    status: 'Onboarding', 
    contactInfo: { email: 'marketing@capitalone.com', phone: '555-444-9999' },
    products: [],
    totalProducts: 0,
    totalFlags: 0,
    complianceRate: 0
  }
];

interface AdvertiserManagementProps {
  onAddAdvertiser: () => void;
  onEditAdvertiser: (id: string) => void;
}

const AdvertiserManagement: React.FC<AdvertiserManagementProps> = ({ 
  onAddAdvertiser, 
  onEditAdvertiser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [advertisers, setAdvertisers] = useState(mockAdvertisers);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  
  // Filter advertisers based on search term and status
  const filteredAdvertisers = advertisers.filter(advertiser => {
    const matchesSearch = advertiser.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || advertiser.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  // Paginate the filtered advertisers
  const paginatedAdvertisers = filteredAdvertisers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredAdvertisers.length / itemsPerPage);
  
  // Get a color for the compliance rate
  const getComplianceColor = (rate: number): string => {
    if (rate >= 90) return 'text-success';
    if (rate >= 75) return 'text-warning';
    return 'text-error';
  };
  
  // Get a status badge class
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Active':
        return 'status-success';
      case 'Onboarding':
        return 'status-warning';
      case 'Inactive':
        return 'bg-neutral-gray bg-opacity-10 text-neutral-gray';
      default:
        return 'bg-text-secondary bg-opacity-10 text-text-secondary';
    }
  };
  
  // Handle adding a new advertiser
  const handleAddAdvertiserClick = () => {
    setShowAddModal(true);
  };
  
  // Handle advertiser submission from modal
  const handleAdvertiserSubmit = (data: any) => {
    const newAdvertiser = {
      id: `new-${Date.now()}`, // Generate a temporary ID
      name: data.name,
      status: data.status.charAt(0).toUpperCase() + data.status.slice(1), // Capitalize first letter
      contactInfo: { 
        email: data.contactEmail || 'Not provided', 
        phone: data.contactPhone || 'Not provided' 
      },
      products: [],
      totalProducts: 0,
      totalFlags: 0,
      complianceRate: 0
    };
    
    // Add the new advertiser to the state
    setAdvertisers(prev => [newAdvertiser, ...prev]);
    
    // Call the parent component's handler if needed
    if (onAddAdvertiser) {
      onAddAdvertiser();
    }
  };
  
  // Handle edit advertiser button click
  const handleEditAdvertiserClick = (id: string) => {
    // Find the advertiser to edit
    const advertiser = advertisers.find(p => p.id === id);
    if (advertiser) {
      setSelectedAdvertiser(advertiser);
      setShowEditModal(true);
    }
    
    // Also call the parent component's handler if needed
    if (onEditAdvertiser) {
      onEditAdvertiser(id);
    }
  };
  
  // Handle advertiser edit submission from modal
  const handleEditAdvertiserSubmit = (data: any) => {
    if (!selectedAdvertiser) return;
    
    // Update the advertiser with edited data
    const updatedAdvertiser = {
      ...selectedAdvertiser,
      name: data.name,
      status: data.status.charAt(0).toUpperCase() + data.status.slice(1), // Capitalize first letter
      contactInfo: { 
        email: data.contactEmail || 'Not provided', 
        phone: data.contactPhone || 'Not provided' 
      },
      // Keep the existing products
      products: selectedAdvertiser.products
    };
    
    // Update the advertiser in the state
    setAdvertisers(prev => 
      prev.map(p => p.id === selectedAdvertiser.id ? updatedAdvertiser : p)
    );
  };
  
  // Navigate to different page
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Advertisers</h2>
        <button 
          className="btn-primary"
          onClick={handleAddAdvertiserClick}
        >
          Add Advertiser
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search advertisers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Onboarding">Onboarding</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      
      {/* Advertisers Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header text-left">Advertiser</th>
              <th className="table-header text-left">Status</th>
              <th className="table-header text-left">Contacts</th>
              <th className="table-header text-center">Products</th>
              <th className="table-header text-center">Compliance</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAdvertisers.map((advertiser, index) => (
              <tr key={advertiser.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                <td className="py-3 px-4">
                  <div className="font-medium">{advertiser.name}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`status-pill ${getStatusBadgeClass(advertiser.status)}`}>
                    {advertiser.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm">{advertiser.contactInfo.email}</div>
                  <div className="text-xs text-text-secondary">{advertiser.contactInfo.phone}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="text-sm font-medium">{advertiser.totalProducts} Products</div>
                  <div className="text-xs text-text-secondary">
                    {advertiser.products.length > 0 ? (
                      `${advertiser.products.slice(0, 2).map(p => p.name).join(', ')}${advertiser.products.length > 2 ? '...' : ''}`
                    ) : 'No products'}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  {advertiser.status !== 'Onboarding' ? (
                    <div className={`font-bold ${getComplianceColor(advertiser.complianceRate)}`}>
                      {advertiser.complianceRate}%
                    </div>
                  ) : (
                    <span className="text-text-secondary">N/A</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button 
                    className="btn-tertiary"
                    onClick={() => handleEditAdvertiserClick(advertiser.id)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredAdvertisers.length === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No advertisers match your filters</p>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="flex space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded ${
                currentPage === 1
                  ? 'bg-background text-text-secondary cursor-not-allowed'
                  : 'bg-background text-text-primary hover:bg-neutral-light'
              }`}
            >
              &laquo;
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded ${
                  currentPage === page
                    ? 'bg-primary text-white'
                    : 'bg-background text-text-primary hover:bg-neutral-light'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded ${
                currentPage === totalPages
                  ? 'bg-background text-text-secondary cursor-not-allowed'
                  : 'bg-background text-text-primary hover:bg-neutral-light'
              }`}
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
      
      {/* Add Advertiser Modal */}
      <AddAdvertiserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAdvertiserSubmit}
      />
      
      {/* Edit Advertiser Modal */}
      <EditAdvertiserModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditAdvertiserSubmit}
        advertiser={selectedAdvertiser}
      />
    </div>
  );
};

export default AdvertiserManagement;
