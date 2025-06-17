'use client';

import React, { useState } from 'react';
import AddUserModal from './modals/AddUserModal';
import EditUserModal from './modals/EditUserModal';
import { userRoles } from './modals/mockData';

// Mock data for users
const mockUsers = [
  { 
    id: '101', 
    name: 'Sarah Chen', 
    email: 'sarah.chen@example.com',
    role: 'Admin',
    lastLogin: '2025-04-25',
    assignedFlags: 14,
  },
  { 
    id: '102', 
    name: 'Michael Brown', 
    email: 'michael.brown@example.com',
    role: 'Reviewer',
    lastLogin: '2025-04-26',
    assignedFlags: 8,
  },
  { 
    id: '103', 
    name: 'Alex Johnson', 
    email: 'alex.johnson@example.com',
    role: 'Reviewer',
    lastLogin: '2025-04-23',
    assignedFlags: 12,
  },
  { 
    id: '104', 
    name: 'Taylor Smith', 
    email: 'taylor.smith@example.com',
    role: 'Publisher Manager',
    lastLogin: '2025-04-24',
    assignedFlags: 0,
  },
];

interface UserManagementProps {
  onAddUser: () => void;
  onEditUser: (id: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onAddUser, onEditUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [users, setUsers] = useState(mockUsers);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Get unique roles for filter dropdown
  const uniqueRoles = Array.from(new Set(mockUsers.map(user => user.role)));
  
  // Filter users based on search term and role
  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === '' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });
  
  // Get role badge class
  const getRoleBadgeClass = (role: string): string => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-secondary bg-opacity-20 text-secondary';
      case 'reviewer':
        return 'bg-primary bg-opacity-20 text-primary';
      case 'publisher manager':
        return 'bg-warning bg-opacity-20 text-warning';
      default:
        return 'bg-text-secondary bg-opacity-20 text-text-secondary';
    }
  };
  
  // Handle adding a new user
  const handleAddUserClick = () => {
    setShowAddModal(true);
  };
  
  // Handle editing a user
  const handleEditUserClick = (id: string) => {
    const user = users.find(u => u.id === id);
    if (user) {
      setSelectedUser(user);
      setShowEditModal(true);
    }
    
    // Also call the parent component's handler
    if (onEditUser) {
      onEditUser(id);
    }
  };
  
  // Handle user submission from modal
  const handleUserSubmit = (data: any) => {
    // Get role label for display
    const roleLabel = userRoles.find(r => r.value === data.role)?.label || data.role;
    
    const newUser = {
      id: `new-${Date.now()}`, // Generate a temporary ID
      name: data.name,
      email: data.email,
      role: roleLabel,
      lastLogin: 'Never',
      assignedFlags: 0 // New user has no assigned flags
    };
    
    // Add the new user to the state
    setUsers(prev => [newUser, ...prev]);
    
    // Call the parent component's handler if needed
    if (onAddUser) {
      onAddUser();
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Users</h2>
        <button 
          className="btn-primary"
          onClick={handleAddUserClick}
        >
          Add User
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Users Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header text-left">User</th>
              <th className="table-header text-left">Role</th>
              <th className="table-header text-center">Assigned Flags</th>
              <th className="table-header text-center">Last Login</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, index) => (
              <tr key={user.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                <td className="py-3 px-4">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-text-secondary">{user.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {user.assignedFlags > 0 ? (
                    <span className="bg-error bg-opacity-10 text-error px-2 py-1 rounded-full text-xs font-medium">
                      {user.assignedFlags}
                    </span>
                  ) : (
                    <span className="text-text-secondary">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center text-sm">
                  {user.lastLogin}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button 
                      className="btn-tertiary"
                      onClick={() => handleEditUserClick(user.id)}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No users match your filters</p>
          </div>
        )}
      </div>
      
      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleUserSubmit}
      />
      
      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={selectedUser}
        onSubmit={(data) => {
          if (!selectedUser) return;
          
          // Get role label for display
          const roleLabel = userRoles.find(r => r.value === data.role)?.label || data.role;
          
          // Update the user with edited data
          const updatedUser = {
            ...selectedUser,
            name: data.name,
            email: data.email,
            role: roleLabel
            // Password changes are handled server-side
          };
          
          // Update the user in state
          setUsers(prev => 
            prev.map(u => u.id === selectedUser.id ? updatedUser : u)
          );
        }}
      />
    </div>
  );
};

export default UserManagement;
