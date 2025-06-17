'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import { userRoles } from './mockData';

interface UserFormData {
  name: string;
  email: string;
  role: string;
  password: string;
  confirmPassword: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: string;
  assignedFlags: number;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
  user: User | null;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  user
}) => {
  const initialData: UserFormData = {
    name: '',
    email: '',
    role: 'reviewer',
    password: '',
    confirmPassword: ''
  };
  
  const [formData, setFormData] = useState<UserFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  
  // Update form when user data changes
  useEffect(() => {
    if (user) {
      // Try to find the matching role value for the dropdown
      const roleValue = userRoles.find(r => 
        r.label.toLowerCase() === user.role.toLowerCase()
      )?.value || 'reviewer';
      
      setFormData({
        name: user.name,
        email: user.email,
        role: roleValue,
        password: '',
        confirmPassword: ''
      });
      
      // Reset password change flag
      setChangePassword(false);
    }
  }, [user]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      setIsSubmitting(false);
      setChangePassword(false);
      // Don't reset formData here, as we want to keep it populated with the user data
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
      
      // Prepare submission data, omitting password fields if not changing
      const submissionData = !changePassword ? 
        { name: formData.name, email: formData.email, role: formData.role } : 
        formData;
        
      // Simulate API call
      setTimeout(() => {
        onSubmit(submissionData as UserFormData);
        setIsSubmitting(false);
        onClose();
      }, 500);
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
          </div>
        </div>
        
        {/* Password Change Section */}
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
                required
                error={errors.password}
              >
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Enter new password"
                />
              </FormField>
              
              <FormField 
                label="Confirm Password" 
                htmlFor="confirmPassword" 
                required
                error={errors.confirmPassword}
              >
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Confirm new password"
                />
              </FormField>
            </div>
          )}
          
          {!changePassword && (
            <div className="mt-2 text-sm text-text-secondary">
              Password will remain unchanged
            </div>
          )}
        </div>
        
        {/* User Activity Section */}
        <div className="bg-background p-4 rounded-md">
          <h3 className="text-md font-semibold mb-2">User Activity</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Last Login:</span>
              <span>{user.lastLogin || 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Assigned Flags:</span>
              <span>{user.assignedFlags}</span>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default EditUserModal;
