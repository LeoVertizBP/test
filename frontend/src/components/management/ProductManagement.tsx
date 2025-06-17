'use client';

import React, { useState, useEffect } from 'react';
import AddProductModal from './modals/AddProductModal';
import EditProductModal from './modals/EditProductModal';
import advertiserService, { Advertiser } from '@/services/advertiserService'; // Import Advertiser type
import productService, { Product } from '@/services/productService';
import ruleService, { ProductRuleDetail, ChannelRule, RuleSet } from '@/services/ruleService'; // Import rule types and service

// Extend the Product interface with fields that might come from the API but aren't in the interface
// and with UI-specific properties
interface EnhancedProduct extends Product {
  // Additional API fields that might be returned but aren't in the interface
  primary_issuer?: string;
  fee?: string;
  marketing_bullets?: string;
  
  // UI-specific properties
  primaryIssuer?: string;
  marketingBullets?: string[];
  rules?: number;
  publishers?: number;
  complianceRate?: number;
  flagCount?: number;
}

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
  const [products, setProducts] = useState<EnhancedProduct[]>([]);
  const [issuers, setIssuers] = useState<string[]>([]);
  const [allAdvertisers, setAllAdvertisers] = useState<Advertiser[]>([]);
  const [allRules, setAllRules] = useState<(ProductRuleDetail | ChannelRule)[]>([]);
  const [allRuleSets, setAllRuleSets] = useState<RuleSet[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<EnhancedProduct | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 25;
  
  // Fetch products data from API
  useEffect(() => {
    const fetchData = async () => { // Renamed for clarity
      setIsLoading(true);
      setError(null);
      
      try {
        const [
          productsResponse,
          advertisersResponse,
          productRulesResponse,
          channelRulesResponse,
          ruleSetsResponse
        ] = await Promise.allSettled([
          productService.getProducts(),
          advertiserService.getAdvertisers(),
          ruleService.getProductRules(),
          ruleService.getChannelRules(),
          ruleService.getRuleSets()
        ]);

        let advertisersData: Advertiser[] = [];
        if (advertisersResponse.status === 'fulfilled') {
          advertisersData = advertisersResponse.value.data;
          setAllAdvertisers(advertisersData);
          const uniqueIssuerNames = Array.from(new Set(advertisersData.map(adv => adv.name)));
          setIssuers(uniqueIssuerNames);
        } else {
          console.error('Failed to fetch advertisers:', advertisersResponse.reason);
          // Handle error for advertisers if needed, e.g., setError or provide empty array
        }
        
        if (productsResponse.status === 'fulfilled') {
          const productsData = productsResponse.value.data;
          const enhancedProducts = productsData.map(product => {
            const advertiser = advertisersData.find(adv => adv.id === product.advertiser_id);
          
          // Cast the product to EnhancedProduct to access additional fields
          const enhancedProduct = product as EnhancedProduct;
          
          // Try to parse marketing bullets if they exist
          let parsedBullets: string[] = [];
          try {
            if (enhancedProduct.marketing_bullets) {
              parsedBullets = JSON.parse(enhancedProduct.marketing_bullets);
            }
          } catch (e) {
            console.error(`Error parsing marketing bullets for product ${product.id}:`, e);
            // If parsing fails, just use an empty array
            parsedBullets = [];
          }
          
          return {
            ...enhancedProduct,
            primaryIssuer: enhancedProduct.primary_issuer || (advertiser?.name || 'Unknown'),
            marketingBullets: parsedBullets,
            rules: 0, // Initialize with default values
            publishers: 0,
            complianceRate: 0,
            flagCount: 0
          };
        });
        
        setProducts(enhancedProducts);
        } else {
          console.error('Failed to fetch products:', productsResponse.reason);
          setError('Failed to load products.');
        }

        let combinedRules: (ProductRuleDetail | ChannelRule)[] = [];
        if (productRulesResponse.status === 'fulfilled') {
          combinedRules = combinedRules.concat(productRulesResponse.value.data);
        } else {
          console.error('Failed to fetch product rules:', productRulesResponse.reason);
        }
        if (channelRulesResponse.status === 'fulfilled') {
          combinedRules = combinedRules.concat(channelRulesResponse.value.data);
        } else {
          console.error('Failed to fetch channel rules:', channelRulesResponse.reason);
        }
        setAllRules(combinedRules);

        if (ruleSetsResponse.status === 'fulfilled') {
          setAllRuleSets(ruleSetsResponse.value.data);
        } else {
          console.error('Failed to fetch rule sets:', ruleSetsResponse.reason);
        }

      } catch (err) { // This catch might be redundant if all promises are handled by allSettled
        console.error('Error fetching management data:', err);
        setError('Failed to load management data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const uniqueIssuers = issuers; // Restore this line

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
  const formatCurrency = (amount: string | number | undefined): string => {
    if (amount === undefined || amount === null) return 'No Annual Fee';
    
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numericAmount) || numericAmount === 0) {
      return 'No Annual Fee';
    } else {
      return `$${numericAmount.toFixed(2)}`;
    }
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

  // Handle product edit submission from modal
  const handleEditProductSubmit = async (data: any) => {
    if (!selectedProduct) return;

    try {
      // Prepare update data (only fields that can be edited)
      // Assuming EditProductModal returns data matching EnhancedProduct structure or similar
      const updateData = {
        name: data.name,
        primary_issuer: data.issuer, // Map form field to DB field
        fee: data.fee,
        marketing_bullets: JSON.stringify(data.marketingBullets || []),
        // Add other editable fields as needed
      };

      // Call the update service
      const updatedProduct = await productService.updateProduct(selectedProduct.id, updateData);

      // Extract the actual updated product data from the response
      const updatedProductData = updatedProduct.data;

      // Refresh the product list in the state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === selectedProduct.id
            ? {
                ...p, 
                ...updatedProductData,
                primary_issuer: updatedProductData.primary_issuer ?? undefined, // Ensure undefined if null
                primaryIssuer: updatedProductData.primary_issuer ?? p.primaryIssuer ?? undefined, // Ensure undefined if null
                marketingBullets: data.marketingBullets || [], 
              } as EnhancedProduct // Cast to EnhancedProduct
            : p
        )
      );

      setShowEditModal(false); // Close modal on success
      setSelectedProduct(null); // Clear selection

    } catch (error) {
      console.error('Error updating product:', error);
      // Optionally set an error state to display in the modal or main page
      setError('Failed to update product. Please try again.');
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
  const handleProductSubmit = async (data: any) => {
    console.log('[ProductManagement] handleProductSubmit data from modal:', JSON.stringify(data, null, 2));
    try {
      const selectedAdvertiserObj = allAdvertisers.find(adv => adv.id === data.advertiser);
      const primaryIssuerName = selectedAdvertiserObj ? selectedAdvertiserObj.name : 'Unknown';

      const productPayload = {
        name: data.name,
        advertiserId: data.advertiser, // Changed from advertiser_id to advertiserId
        primary_issuer: primaryIssuerName, // Name of the advertiser
        fee: data.fee === '' ? null : parseFloat(String(data.fee)), // Ensure fee is number or null
        marketing_bullets: JSON.stringify(data.marketingBullets?.filter((b: string) => b.trim() !== '') || []),
        ruleIds: data.rules, // Array of selected rule IDs
        ruleSetIds: data.ruleSets, // Array of selected rule set IDs
        // Include other fields like description, status, code, category if they are part of the form & Product type
        // For example, if 'description' is collected in 'data.description':
        // description: data.description, 
      };
      
      // Create the product in the API
      // The backend's productService.createProduct should now handle all these fields including relations
      console.log('[ProductManagement] productPayload to be sent:', JSON.stringify(productPayload, null, 2));
      const response = await productService.createProduct(productPayload as any); // Use 'as any' for now if type is complex
      console.log('[ProductManagement] Product creation API response:', response);
      const newProduct = response.data;
            
      // Add the new product to the state with enhanced properties
      const enhancedProduct: EnhancedProduct = {
        ...newProduct, // newProduct from API should have all basic fields
        primary_issuer: newProduct.primary_issuer ?? undefined, 
        primaryIssuer: newProduct.primary_issuer ?? primaryIssuerName, 
        fee: newProduct.fee === null ? undefined : String(newProduct.fee ?? ''), 
        marketing_bullets: newProduct.marketing_bullets ?? undefined, // Ensure undefined if null
        marketingBullets: data.marketingBullets?.filter((b: string) => b.trim() !== '') || [],
        rules: data.rules?.length || 0, 
        publishers: 0, // New product has no publishers yet
        complianceRate: 100, // Start with perfect compliance
        flagCount: 0 // No flags for new product
      };
      
      setProducts(prev => [enhancedProduct, ...prev]);
      
      // Call the parent component's handler if needed
      if (onAddProduct) {
        onAddProduct();
      }
      console.log('[ProductManagement] Product processing complete. New product (from API):', newProduct);
    } catch (error: any) {
      console.error('[ProductManagement] Error creating product:', error.response ? error.response.data : error.message, error.stack);
      setError('Failed to create product. Check console for details.');
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
      
      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin mr-2">⟳</div>
          Loading products...
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
              productService.getProducts()
                .then(response => {
                  setProducts(response.data.map(product => {
                    const enhancedProduct = product as EnhancedProduct;
                    return {
                      ...enhancedProduct,
                      primaryIssuer: enhancedProduct.primary_issuer || 'Unknown',
                      marketingBullets: [],
                      rules: 0,
                      publishers: 0,
                      complianceRate: 0,
                      flagCount: 0
                    };
                  }));
                  setIsLoading(false);
                })
                .catch(err => {
                  console.error('Error refetching products:', err);
                  setError('Failed to load products. Please try again.');
                  setIsLoading(false);
                });
            }}
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Products Table */}
      {!isLoading && !error && (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Product</th>
                <th className="table-header text-left">Advertiser</th> {/* Changed Issuer to Advertiser */}
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
                      {product.rules || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-background px-2 py-1 rounded-full text-sm">
                      {product.publishers || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className={`font-bold ${getComplianceColor(product.complianceRate || 0)}`}>
                      {product.complianceRate || 0}%
                      {(product.flagCount || 0) > 0 && (
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
          
          {filteredProducts.length === 0 && !isLoading && (
            <div className="text-center py-8 text-text-secondary">
              <p>No products found. Try adjusting your filters or adding a new product.</p>
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
      
      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleProductSubmit}
        advertisers={allAdvertisers}
        rules={allRules}
        ruleSets={allRuleSets}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProduct(null); // Clear selection on close
        }}
        onSubmit={handleEditProductSubmit}
        product={selectedProduct} // Pass the selected product data
      />
    </div>
  );
};

export default ProductManagement;
