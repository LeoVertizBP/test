'use client';

import React, { useState } from 'react';
import AddProductModal from './modals/AddProductModal';
import { mockAdvertisers } from './modals/mockData';

// Mock data for products
const mockProducts = [
  { 
    id: '101', 
    name: 'Premium Card', 
    primaryIssuer: 'Chase', 
    fee: 95.00,
    marketingBullets: [
      'Earn 2x points on travel and dining',
      'No foreign transaction fees',
      'Annual travel credit of $100'
    ],
    rules: 8,
    publishers: 3,
    complianceRate: 91,
    flagCount: 12
  },
  { 
    id: '102', 
    name: 'Travel Card', 
    primaryIssuer: 'Amex', 
    fee: 150.00,
    marketingBullets: [
      'Earn 3x points on flights',
      'Complimentary lounge access',
      'Global entry fee credit'
    ],
    rules: 10,
    publishers: 2,
    complianceRate: 85,
    flagCount: 18
  },
  { 
    id: '103', 
    name: 'Rewards Card', 
    primaryIssuer: 'Citi', 
    fee: 0.00,
    marketingBullets: [
      'Earn 5% cash back in rotating categories',
      'No annual fee',
      'Introductory 0% APR for 15 months'
    ],
    rules: 6,
    publishers: 4,
    complianceRate: 88,
    flagCount: 22
  },
  { 
    id: '104', 
    name: 'Basic Card', 
    primaryIssuer: 'Discover', 
    fee: 0.00,
    marketingBullets: [
      'Cash back match in first year',
      'No annual fee',
      'Free FICO score monthly'
    ],
    rules: 5,
    publishers: 2,
    complianceRate: 94,
    flagCount: 7
  },
  { 
    id: '105', 
    name: 'Sapphire Reserve', 
    primaryIssuer: 'Chase', 
    fee: 550.00,
    marketingBullets: [
      'Earn 3x points on travel and dining',
      'Annual travel credit of $300',
      'Priority Pass lounge access'
    ],
    rules: 12,
    publishers: 5,
    complianceRate: 87,
    flagCount: 32
  },
  { 
    id: '106', 
    name: 'Freedom Card', 
    primaryIssuer: 'Chase', 
    fee: 0.00,
    marketingBullets: [
      'Earn 5% on rotating categories',
      'No annual fee',
      'Cash back options'
    ],
    rules: 7,
    publishers: 4,
    complianceRate: 92,
    flagCount: 9
  },
  { 
    id: '107', 
    name: 'Platinum Card', 
    primaryIssuer: 'Amex', 
    fee: 695.00,
    marketingBullets: [
      'Comprehensive travel benefits',
      'Exclusive airport lounge access',
      'Annual statement credits'
    ],
    rules: 14,
    publishers: 6,
    complianceRate: 83,
    flagCount: 43
  },
  { 
    id: '108', 
    name: 'Gold Card', 
    primaryIssuer: 'Amex', 
    fee: 250.00,
    marketingBullets: [
      'Earn 4x points at restaurants',
      'Earn 4x points at supermarkets',
      'Annual dining credit'
    ],
    rules: 9,
    publishers: 3,
    complianceRate: 89,
    flagCount: 15
  },
  { 
    id: '109', 
    name: 'Cash Back Card', 
    primaryIssuer: 'Discover', 
    fee: 0.00,
    marketingBullets: [
      'Unlimited 1.5% cash back',
      'Cashback match first year',
      'No annual fee'
    ],
    rules: 6,
    publishers: 3,
    complianceRate: 95,
    flagCount: 5
  },
  { 
    id: '110', 
    name: 'Premier Card', 
    primaryIssuer: 'Citi', 
    fee: 95.00,
    marketingBullets: [
      'Earn 3x points on air travel',
      'Earn 2x points on dining',
      'Annual hotel savings benefit'
    ],
    rules: 11,
    publishers: 4,
    complianceRate: 86,
    flagCount: 24
  },
  { 
    id: '111', 
    name: 'Double Cash Card', 
    primaryIssuer: 'Citi', 
    fee: 0.00,
    marketingBullets: [
      '1% when you buy, 1% when you pay',
      'No annual fee',
      'Balance transfer options'
    ],
    rules: 5,
    publishers: 2,
    complianceRate: 93,
    flagCount: 8
  },
  { 
    id: '112', 
    name: 'Student Card', 
    primaryIssuer: 'Discover', 
    fee: 0.00,
    marketingBullets: [
      'Cash back for good grades',
      'No annual fee',
      'Build credit history'
    ],
    rules: 4,
    publishers: 1,
    complianceRate: 97,
    flagCount: 3
  }
];

interface ProductManagementProps {
  onAddProduct: () => void;
  onEditProduct: (id: string) => void;
  onViewProductFlags: (id: string) => void;
}

const ProductManagement: React.FC<ProductManagementProps> = ({ 
  onAddProduct, 
  onEditProduct,
  onViewProductFlags
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [products, setProducts] = useState(mockProducts);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  
  // Get unique issuers for filter dropdown
  const uniqueIssuers = Array.from(new Set(mockProducts.map(product => product.primaryIssuer)));
  
  // Filter products based on search term and issuer
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIssuer = issuerFilter === '' || product.primaryIssuer === issuerFilter;
    return matchesSearch && matchesIssuer;
  });
  
  // Paginate the filtered products
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  
  // Get a color for the compliance rate
  const getComplianceColor = (rate: number): string => {
    if (rate >= 90) return 'text-success';
    if (rate >= 75) return 'text-warning';
    return 'text-error';
  };
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return amount === 0 
      ? 'No Annual Fee' 
      : `$${amount.toFixed(2)}`;
  };
  
  // Handle adding a new product
  const handleAddProductClick = () => {
    setShowAddModal(true);
  };
  
  // Handle editing a product
  const handleEditProductClick = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      setSelectedProduct(product);
      setShowEditModal(true);
    }
    
    // Also call the parent component's handler
    if (onEditProduct) {
      onEditProduct(id);
    }
  };
  
  // Handle viewing flags for a product
  const handleViewFlagsClick = (id: string) => {
    // Call the parent component's handler
    if (onViewProductFlags) {
      onViewProductFlags(id);
    }
  };
  
  // Navigate to different page
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };
  
  // Handle product submission from modal
  const handleProductSubmit = (data: any) => {
    const advertiserLabel = mockAdvertisers.find(a => a.value === data.advertiser)?.label || 'Unknown';
    
    const newProduct = {
      id: `new-${Date.now()}`, // Generate a temporary ID
      name: data.name,
      primaryIssuer: advertiserLabel,
      fee: typeof data.fee === 'number' ? data.fee : 0,
      marketingBullets: data.marketingBullets,
      rules: data.rules.length + data.ruleSets.length, // Total rules based on selections
      publishers: 0, // New product has no publishers yet
      complianceRate: 100, // Start with perfect compliance
      flagCount: 0 // No flags for new product
    };
    
    // Add the new product to the state
    setProducts(prev => [newProduct, ...prev]);
    
    // Call the parent component's handler if needed
    if (onAddProduct) {
      onAddProduct();
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Products</h2>
        <button 
          className="btn-primary"
          onClick={handleAddProductClick}
        >
          Add Product
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <select
            value={issuerFilter}
            onChange={(e) => setIssuerFilter(e.target.value)}
            className="input"
          >
            <option value="">All Issuers</option>
            {uniqueIssuers.map(issuer => (
              <option key={issuer} value={issuer}>{issuer}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Products Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header text-left">Product</th>
              <th className="table-header text-left">Issuer</th>
              <th className="table-header text-left">Fee</th>
              <th className="table-header text-center">Rules</th>
              <th className="table-header text-center">Publishers</th>
              <th className="table-header text-center">Compliance</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product, index) => (
              <tr key={product.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                <td className="py-3 px-4">
                  <div className="font-medium">{product.name}</div>
                </td>
                <td className="py-3 px-4">
                  <div>{product.primaryIssuer}</div>
                </td>
                <td className="py-3 px-4">
                  <div>{formatCurrency(product.fee)}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="bg-background px-2 py-1 rounded-full text-sm">
                    {product.rules}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="bg-background px-2 py-1 rounded-full text-sm">
                    {product.publishers}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className={`font-bold ${getComplianceColor(product.complianceRate)}`}>
                    {product.complianceRate}%
                    {product.flagCount > 0 && (
                      <span className="ml-2 text-xs bg-error bg-opacity-10 text-error px-2 py-0.5 rounded-full">
                        {product.flagCount} flags
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button 
                      className="btn-tertiary"
                      onClick={() => handleEditProductClick(product.id)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-tertiary"
                      onClick={() => handleViewFlagsClick(product.id)}
                    >
                      View Flags
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No products match your filters</p>
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
      
      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleProductSubmit}
      />
    </div>
  );
};

export default ProductManagement;
