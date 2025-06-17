'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import { userRoles } from './mockData'; // Keep for role dropdown options
import { User } from '@/services/userService'; // Import User from userService

// This interface represents the data structure for the form within this modal
interface EditUserFormData {
  name: string;
  email: string;
  role: string;
  status: string; // Added status field
  password?: string; // Optional for password change
  confirmPassword?: string; // Optional for password change
}

// This interface represents the data structure submitted by the modal
// It should align with UserUpdatePayload or a subset of it relevant to the modal's purpose
export interface EditUserSubmitData {
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  password?: string;
  // firstName and lastName are not primary fields in User service, use 'name'
}


interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EditUserSubmitData) => void; // Use the new submit data type
  user: User | null; // Use User from userService
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  user
}) => {
  const initialData: EditUserFormData = {
    name: '',
    email: '',
    role: 'reviewer', // Default role
    status: 'active', // Default status
    password: '',
    confirmPassword: ''
  };
  
  const [formData, setFormData] = useState<EditUserFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  
  // Update form when user data changes
  useEffect(() => {
    if (user) {
      const roleValue = userRoles.find(r => 
        r.label.toLowerCase() === user.role?.toLowerCase() // Handle potentially undefined user.role
      )?.value || user.role || 'reviewer'; // Fallback to user.role if defined, then 'reviewer'
      
      setFormData({
        name: user.name || '', // Handle potentially undefined user.name
        email: user.email || '', // Handle potentially undefined user.email
        role: roleValue,
        status: user.status || 'active', // Use user's status or default to 'active'
        password: '',
        confirmPassword: ''
      });
      setChangePassword(false);
    } else {
      // If no user is passed (e.g., modal is closed and re-opened for a new "add" action, though this is an Edit modal)
      // Or if user becomes null, reset to initialData
      setFormData(initialData); 
    }
  }, [user, isOpen]); // Add isOpen to dependencies to reset if modal is closed then reopened with no user
  
  // Reset form fields and errors when modal closes, but only if it was truly closed (not just re-rendered)
  useEffect(() => {
    if (!isOpen) {
      // Resetting form to initialData when user is null is handled above.
      // Here, just clear errors and submitting state.
      setErrors({});
      setIsSubmitting(false);
      setChangePassword(false);
      // If user prop is cleared when closing, the other useEffect will reset formData.
      // If user prop persists, formData should retain its values.
    }
  }, [isOpen]);
  
  // Update field values
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // Toggle password change section
  const handleTogglePasswordChange = () => {
    setChangePassword(!changePassword);
    
    // Clear any password errors when toggling
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.password;
      delete newErrors.confirmPassword;
      return newErrors;
    });
    
    // Clear password fields
    setFormData(prev => ({
      ...prev,
      password: '',
      confirmPassword: ''
    }));
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // Email is required and must be valid
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    // Role is required
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }
    
    // Validate password fields only if password change is enabled
    if (changePassword) {
      if (!formData.password) {
        newErrors.password = 'New password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      setIsSubmitting(true);
      
      // Prepare submission data, aligning with EditUserSubmitData
      const submissionData: EditUserSubmitData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
      };
      
      if (changePassword && formData.password) {
        submissionData.password = formData.password;
      }
        
      // No simulation, call the actual onSubmit prop
      onSubmit(submissionData); 
      // Parent component (UserManagement) will handle API call, closing modal, and re-fetching.
      // For now, we can keep the local isSubmitting and onClose for immediate UI feedback if needed,
      // but ideally, parent controls this flow.
      // setIsSubmitting(false); // This should be set by parent or after onSubmit promise resolves
      // onClose(); // Parent should control closing
    }
  };
  
  // Modal footer with action buttons
  const modalFooter = (
    <div className="flex justify-end space-x-3">
      <button 
        type="button" 
        className="btn-secondary" 
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button 
        type="button" 
        className="btn-primary"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
        ) : 'Save Changes'}
      </button>
    </div>
  );
  
  if (!user) return null;
  
  return (
    <BaseModal
      title="Edit User"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="md"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">User Information</h3>
          <div className="space-y-4">
            <FormField 
              label="Name" 
              htmlFor="name" 
              required
              error={errors.name}
            >
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Enter user name"
              />
            </FormField>
            
            <FormField 
              label="Email" 
              htmlFor="email" 
              required
              error={errors.email}
            >
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Enter email address"
              />
            </FormField>
            
            <FormField 
              label="Role" 
              htmlFor="role"
              required
              error={errors.role}
            >
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="input w-full"
              >
                {userRoles.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Status"
              htmlFor="status"
              required
              error={errors.status}
            >
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="input w-full"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                {/* Add other statuses if applicable */}
              </select>
            </FormField>
          </div>
        </div>
        
        {/* Password Change Section (remains largely the same) */}
        <div>
          <div className="flex items-center">
            <h3 className="text-md font-semibold">Change Password</h3>
            <button 
              type="button"
              onClick={handleTogglePasswordChange}
              className="ml-2 px-2 py-1 text-xs font-medium text-secondary hover:bg-secondary hover:bg-opacity-10 rounded"
            >
              {changePassword ? 'Cancel' : 'Change'}
            </button>
          </div>
          
          {changePassword && (
            <div className="mt-3 space-y-4 bg-background p-4 rounded-md">
              <FormField 
                label="New Password" 
                htmlFor="password" 
                required={changePassword} // Only required if changing password
                error={errors.password}
              >
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password || ''}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Enter new password"
                />
              </FormField>
              
              <FormField 
                label="Confirm Password" 
                htmlFor="confirmPassword" 
                required={changePassword} // Only required if changing password
                error={errors.confirmPassword}
              >
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword || ''}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Confirm new password"
                />
              </FormField>
            </div>
          )}
          
          {!changePassword && (
            <div className="mt-2 text-sm text-text-secondary">
              Password will remain unchanged.
            </div>
          )}
        </div>
        
        {/* User Activity Section REMOVED as lastLogin and assignedFlags are not part of the core User model from service */}
      </div>
    </BaseModal>
  );
};

export default EditUserModal;
