'use client';

import React, { useState, useEffect } from 'react';
import AddAdvertiserModal from './modals/AddAdvertiserModal';
import EditAdvertiserModal from './modals/EditAdvertiserModal';
import advertiserService, { Advertiser } from '@/services/advertiserService';
import productService from '@/services/productService';

// Extend the Advertiser interface with UI-specific properties
interface EnhancedAdvertiser extends Omit<Advertiser, 'status'> {
  status: string;  // Making status required and non-undefined
  contactInfo: {
    email: string;
    phone: string;
  };
  products: {
    name: string;
    status: string;
    lastScanned: string;
  }[];
  totalProducts: number;
  totalFlags: number;
  complianceRate: number;
}

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
  const [advertisers, setAdvertisers] = useState<EnhancedAdvertiser[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<EnhancedAdvertiser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 25;
  
  // Fetch advertisers from API
  useEffect(() => {
    const fetchAdvertisers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await advertiserService.getAdvertisers();
        const advertisersData = response.data;
        
        // Process advertisers data to enhance with UI-specific properties
        const enhancedAdvertisers: EnhancedAdvertiser[] = await Promise.all(
          advertisersData.map(async (advertiser) => {
            // Get advertiser products if any
            let allAdvertiserProducts: any[] = []; // Store the full list
            let advertiserProducts: any[] = []; // For mapping (will be same as allAdvertiserProducts now)
            let totalFlags = 0;
            let complianceRate = 0;

            try {
              const productsResponse = await advertiserService.getAdvertiserProducts(advertiser.id);
              if (productsResponse.data && Array.isArray(productsResponse.data)) {
                allAdvertiserProducts = productsResponse.data; // Assign full list
                advertiserProducts = allAdvertiserProducts; // Use full list (no slice)

                // Calculate total flags and compliance (simplified for now)
                totalFlags = Math.floor(Math.random() * 100); // Placeholder
                complianceRate = Math.floor(70 + Math.random() * 30); // Placeholder between 70-100%
              }
            } catch (error) {
              console.error(`Error fetching products for advertiser ${advertiser.id}:`, error);
              // Continue with empty products array
            }
            
            // Create enhanced advertiser with guaranteed string status
            const enhancedAdvertiser: EnhancedAdvertiser = {
              ...advertiser,
              status: advertiser.status || 'Active', // Ensure status is a string
              contactInfo: {
                email: advertiser.contact_email || 'No email provided',
                phone: advertiser.contact_name || 'No phone provided'
              },
              products: advertiserProducts.map(p => ({
                name: p.name,
                status: p.status || 'Active',
                lastScanned: p.updated_at || new Date().toISOString().split('T')[0]
              })),
              totalProducts: allAdvertiserProducts.length, // Use length of the full list
              totalFlags,
              complianceRate
            };
            
            return enhancedAdvertiser;
          })
        );
        
        setAdvertisers(enhancedAdvertisers);
      } catch (err) {
        console.error('Error fetching advertisers:', err);
        setError('Failed to load advertisers. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAdvertisers();
  }, []);
  
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
  const handleAdvertiserSubmit = async (data: any) => {
    try {
      // Create advertiser basic data
      const advertiserData = {
        name: data.name,
        status: data.status,
        contact_email: data.contactEmail,
        contact_name: data.contactPhone, // Using contact_name for phone number for now
        website: data.website || '',
        description: data.description || ''
      };
      
      // Create the advertiser in the API
      const response = await advertiserService.createAdvertiser(advertiserData);
      const newAdvertiser = response.data;
      
      // Add the new advertiser to the state with enhanced properties
      const enhancedAdvertiser: EnhancedAdvertiser = {
        ...newAdvertiser,
        status: newAdvertiser.status || 'Active', // Ensure status is a string
        contactInfo: {
          email: newAdvertiser.contact_email || 'Not provided',
          phone: newAdvertiser.contact_name || 'Not provided'
        },
        products: [],
        totalProducts: 0,
        totalFlags: 0,
        complianceRate: 100 // Start with perfect compliance
      };
      
      setAdvertisers(prev => [enhancedAdvertiser, ...prev]);
      
      // Call the parent component's handler if needed
      if (onAddAdvertiser) {
        onAddAdvertiser();
      }
    } catch (error) {
      console.error('Error creating advertiser:', error);
      setError('Failed to create advertiser. Please try again.');
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
  const handleEditAdvertiserSubmit = async (data: any) => {
    if (!selectedAdvertiser) return;
    
    try {
      // Update advertiser data
      const advertiserData = {
        name: data.name,
        status: data.status,
        contact_email: data.contactEmail,
        contact_name: data.contactPhone, // Using contact_name for phone number
        website: data.website || selectedAdvertiser.website,
        description: data.description || selectedAdvertiser.description
      };
      
      // Update the advertiser in the API
      const response = await advertiserService.updateAdvertiser(selectedAdvertiser.id, advertiserData);
      const updatedAdvertiser = response.data;
      
      // Update the advertiser in the state with enhanced properties
      const enhancedUpdatedAdvertiser: EnhancedAdvertiser = {
        ...updatedAdvertiser,
        status: updatedAdvertiser.status || 'Active', // Ensure status is a string
        contactInfo: {
          email: updatedAdvertiser.contact_email || 'Not provided',
          phone: updatedAdvertiser.contact_name || 'Not provided'
        },
        // Keep the existing products and stats
        products: selectedAdvertiser.products,
        totalProducts: selectedAdvertiser.totalProducts,
        totalFlags: selectedAdvertiser.totalFlags,
        complianceRate: selectedAdvertiser.complianceRate
      };
      
      setAdvertisers(prev => 
        prev.map(p => p.id === selectedAdvertiser.id ? enhancedUpdatedAdvertiser : p)
      );
    } catch (error) {
      console.error('Error updating advertiser:', error);
      setError('Failed to update advertiser. Please try again.');
    }
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
      
      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin mr-2">⟳</div>
          Loading advertisers...
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
          <button 
            className="btn-primary mt-4"
            onClick={() => {
              setIsLoading(true);
              setError(null);
              advertiserService.getAdvertisers()
                .then(response => {
                  setAdvertisers(response.data.map(advertiser => ({
                    ...advertiser,
                    status: advertiser.status || 'Active', // Ensure status is a string
                    contactInfo: {
                      email: advertiser.contact_email || 'No email provided',
                      phone: advertiser.contact_name || 'No phone provided'
                    },
                    products: [],
                    totalProducts: 0,
                    totalFlags: 0,
                    complianceRate: 0
                  })));
                  setIsLoading(false);
                })
                .catch(err => {
                  console.error('Error refetching advertisers:', err);
                  setError('Failed to load advertisers. Please try again.');
                  setIsLoading(false);
                });
            }}
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Advertisers Table */}
      {!isLoading && !error && (
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
                    {/* Display only the total count */}
                    <div className="text-sm font-medium">{advertiser.totalProducts} Products</div>
                    {/* Removed the display of product names list */}
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
      )}
      
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
