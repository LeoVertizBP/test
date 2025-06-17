'use client';

import React, { useState } from 'react';
import AddPublisherModal from './modals/AddPublisherModal';
import EditPublisherModal from './modals/EditPublisherModal';
import { mockPlatforms } from './modals/mockData';

// Mock data for publishers
const mockPublishers = [
  { 
    id: '1', 
    name: 'AcmeCo', 
    status: 'Active', 
    contactInfo: { email: 'contact@acmeco.com', phone: '555-123-4567' },
    channels: [
      { platform: 'YouTube', url: 'youtube.com/acmeco', status: 'Active', lastScanned: '2025-04-23' },
      { platform: 'Instagram', url: 'instagram.com/acmeco', status: 'Active', lastScanned: '2025-04-22' },
    ],
    totalContent: 124,
    totalFlags: 18,
    complianceRate: 85
  },
  { 
    id: '2', 
    name: 'BetaInc', 
    status: 'Active', 
    contactInfo: { email: 'affiliate@betainc.com', phone: '555-987-6543' },
    channels: [
      { platform: 'TikTok', url: 'tiktok.com/@betainc', status: 'Active', lastScanned: '2025-04-25' },
    ],
    totalContent: 86,
    totalFlags: 7,
    complianceRate: 92
  },
  { 
    id: '3', 
    name: 'GamesCo', 
    status: 'Onboarding', 
    contactInfo: { email: 'partners@gamesco.com', phone: '555-333-8888' },
    channels: [
      { platform: 'YouTube', url: 'youtube.com/gamesco', status: 'Pending', lastScanned: null },
    ],
    totalContent: 0,
    totalFlags: 0,
    complianceRate: 0
  },
  { 
    id: '4', 
    name: 'TechFirm', 
    status: 'Inactive', 
    contactInfo: { email: 'marketing@techfirm.com', phone: '555-444-9999' },
    channels: [
      { platform: 'Instagram', url: 'instagram.com/techfirm', status: 'Inactive', lastScanned: '2025-03-15' },
      { platform: 'TikTok', url: 'tiktok.com/@techfirm', status: 'Inactive', lastScanned: '2025-03-15' },
    ],
    totalContent: 67,
    totalFlags: 12,
    complianceRate: 82
  }
];

interface PublisherManagementProps {
  onAddPublisher: () => void;
  onEditPublisher: (id: string) => void;
}

const PublisherManagement: React.FC<PublisherManagementProps> = ({ 
  onAddPublisher, 
  onEditPublisher 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [publishers, setPublishers] = useState(mockPublishers);
  const [selectedPublisher, setSelectedPublisher] = useState<any>(null);
  
  // Filter publishers based on search term and status
  const filteredPublishers = mockPublishers.filter(publisher => {
    const matchesSearch = publisher.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || publisher.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
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
  
  // Handle adding a new publisher
  const handleAddPublisherClick = () => {
    setShowAddModal(true);
  };
  
  // Handle publisher submission from modal
  const handlePublisherSubmit = (data: any) => {
    const newPublisher = {
      id: `new-${Date.now()}`, // Generate a temporary ID
      name: data.name,
      status: data.status.charAt(0).toUpperCase() + data.status.slice(1), // Capitalize first letter
      contactInfo: { 
        email: data.contactEmail || 'Not provided', 
        phone: data.contactPhone || 'Not provided' 
      },
      channels: data.channels.map((channel: any) => ({
        platform: channel.platform ? mockPlatforms.find(p => p.value === channel.platform)?.label || channel.platform : '',
        url: channel.url,
        status: channel.status.charAt(0).toUpperCase() + channel.status.slice(1), // Capitalize first letter
        lastScanned: null
      })).filter((channel: any) => channel.platform && channel.url), // Only include complete channels
      totalContent: 0,
      totalFlags: 0,
      complianceRate: 0
    };
    
    // Add the new publisher to the state
    setPublishers(prev => [newPublisher, ...prev]);
    
    // Call the parent component's handler if needed
    if (onAddPublisher) {
      onAddPublisher();
    }
  };
  
  // Handle edit publisher button click
  const handleEditPublisherClick = (id: string) => {
    // Find the publisher to edit
    const publisher = publishers.find(p => p.id === id);
    if (publisher) {
      setSelectedPublisher(publisher);
      setShowEditModal(true);
    }
    
    // Also call the parent component's handler if needed
    if (onEditPublisher) {
      onEditPublisher(id);
    }
  };
  
  // Handle publisher edit submission from modal
  const handleEditPublisherSubmit = (data: any) => {
    if (!selectedPublisher) return;
    
    // Update the publisher with edited data
    const updatedPublisher = {
      ...selectedPublisher,
      name: data.name,
      status: data.status.charAt(0).toUpperCase() + data.status.slice(1), // Capitalize first letter
      contactInfo: { 
        email: data.contactEmail || 'Not provided', 
        phone: data.contactPhone || 'Not provided' 
      },
      channels: data.channels.map((channel: any) => ({
        platform: channel.platform ? mockPlatforms.find(p => p.value === channel.platform)?.label || channel.platform : '',
        url: channel.url,
        status: channel.status.charAt(0).toUpperCase() + channel.status.slice(1), // Capitalize first letter
        lastScanned: null
      })).filter((channel: any) => channel.platform && channel.url) // Only include complete channels
    };
    
    // Update the publisher in the state
    setPublishers(prev => 
      prev.map(p => p.id === selectedPublisher.id ? updatedPublisher : p)
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Publishers</h2>
        <button 
          className="btn-primary"
          onClick={handleAddPublisherClick}
        >
          Add Publisher
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search publishers..."
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
      
      {/* Publishers Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header text-left">Publisher</th>
              <th className="table-header text-left">Status</th>
              <th className="table-header text-left">Contacts</th>
              <th className="table-header text-center">Channels</th>
              <th className="table-header text-center">Compliance</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPublishers.map((publisher, index) => (
              <tr key={publisher.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                <td className="py-3 px-4">
                  <div className="font-medium">{publisher.name}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`status-pill ${getStatusBadgeClass(publisher.status)}`}>
                    {publisher.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm">{publisher.contactInfo.email}</div>
                  <div className="text-xs text-text-secondary">{publisher.contactInfo.phone}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex flex-wrap justify-center gap-1">
                    {publisher.channels.map((channel, idx) => (
                      <span key={idx} className="inline-flex items-center">
                        {channel.platform === 'YouTube' && (
                          <svg className="w-4 h-4 text-error mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                          </svg>
                        )}
                        {channel.platform === 'Instagram' && (
                          <svg className="w-4 h-4 text-secondary mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        )}
                        {channel.platform === 'TikTok' && (
                          <svg className="w-4 h-4 text-primary mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                          </svg>
                        )}
                      </span>
                    ))}
                    <span className="text-xs text-text-secondary ml-1">({publisher.channels.length})</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  {publisher.status !== 'Onboarding' ? (
                    <div className={`font-bold ${getComplianceColor(publisher.complianceRate)}`}>
                      {publisher.complianceRate}%
                    </div>
                  ) : (
                    <span className="text-text-secondary">N/A</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button 
                    className="btn-tertiary"
                    onClick={() => handleEditPublisherClick(publisher.id)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredPublishers.length === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No publishers match your filters</p>
          </div>
        )}
      </div>
      
      {/* Add Publisher Modal */}
      <AddPublisherModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handlePublisherSubmit}
      />
      
      {/* Edit Publisher Modal */}
      <EditPublisherModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditPublisherSubmit}
        publisher={selectedPublisher}
      />
    </div>
  );
};

export default PublisherManagement;
