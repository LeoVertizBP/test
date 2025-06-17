'use client';

import React, { useState, useEffect } from 'react';
import AddUserModal from './modals/AddUserModal';
import EditUserModal from './modals/EditUserModal';
// import { userRoles } from './modals/mockData'; // Not used directly, roles come from API
import userService, { User, UserCreatePayload, UserUpdatePayload } from '@/services/userService'; // Import service and User types
import { useAuth } from '@/services/auth/AuthContext'; // Import useAuth

// Define EnhancedUser type for UI display, based on the User type from userService
interface EnhancedUser extends User {
   assignedFlags?: number; // Placeholder count, can be removed if not used
   displayName: string; // Combined name for display
   // lastLoginFormatted is removed as last_login is not in the core User model from service
}

interface UserManagementProps {
  onAddUser?: () => void; // Made optional as it's not always used
  onEditUser?: (id: string) => void; // Made optional
}

const UserManagement: React.FC<UserManagementProps> = ({ onAddUser, onEditUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [users, setUsers] = useState<EnhancedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<EnhancedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: loggedInUser } = useAuth();

  // Function to fetch users
  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await userService.getAllUsers(); // Corrected: Call getAllUsers
      // Enhance data based on the User model from userService
      const enhancedData = response.data.map((u: User): EnhancedUser => {
        // Create a display name primarily from u.name
        // If u.first_name and u.last_name are available and populated from API, they can be used.
        let displayName = u.name; // Default to u.name
        if (u.first_name && u.last_name) {
          displayName = `${u.first_name} ${u.last_name}`;
        } else if (u.first_name) {
          displayName = u.first_name;
        } else if (u.last_name) { // This case might be redundant if u.name is always populated
          displayName = u.last_name;
        }

        return {
          ...u,
          displayName: displayName,
          assignedFlags: 0, // Placeholder - consider removing if not a real metric
          // lastLoginFormatted is removed
        };
      });
      setUsers(enhancedData);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.response?.data?.message || "Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch users from API on mount
  useEffect(() => {
    fetchUsers();
  }, []);


  // Get unique roles for filter dropdown from fetched data
  const uniqueRoles = Array.from(new Set(users.map(user => user.role).filter(Boolean))) as string[];

  // Filter users based on search term and role
  const filteredUsers = users.filter(user => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    // Check against displayName (derived from name/first_name/last_name) and email
    const matchesSearch =
      (user.displayName && user.displayName.toLowerCase().includes(lowerSearchTerm)) ||
      (user.email && user.email.toLowerCase().includes(lowerSearchTerm)) ||
      (user.username && user.username.toLowerCase().includes(lowerSearchTerm)); // Keep if username is a separate field

    const matchesRole = roleFilter === '' || (user.role && user.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  // Get role badge class
  const getRoleBadgeClass = (role: string): string => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-secondary bg-opacity-20 text-secondary';
      case 'reviewer':
        return 'bg-primary bg-opacity-20 text-primary';
      // Add other roles as needed
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
    if (onEditUser) {
      onEditUser(id); // Propagate event if handler exists
    }
  };

  // Handle user submission from modal (Add)
  const handleAddUserSubmit = async (data: { name: string; email: string; role: string; /* other fields from modal */ }) => {
     if (!loggedInUser || !loggedInUser.organizationId) {
       const errorMessage = !loggedInUser
         ? "Logged in user information not available."
         : "Organization ID for logged in user is missing.";
       setError(`Cannot create user: ${errorMessage}`);
       console.error("Add User Error:", errorMessage, { loggedInUser });
       return;
     }

     // Prepare data for API, matching UserCreatePayload from userService
     const userData: UserCreatePayload = {
       name: data.name, // Ensure AddUserModal provides 'name'
       email: data.email,
       role: data.role,
       organization_id: loggedInUser.organizationId,
     };

     console.log("Data received from AddUserModal:", data);
     console.log("Prepared userData for API call (createUser):", userData);

     if (!userData.name || !userData.email || !userData.role) {
        setError("Missing required fields: Name, Email, or Role.");
        console.error("Validation Failed - Prepared userData:", userData);
        return;
     }

     setIsSubmitting(true);
     setError(null);
     try {
       await userService.createUser(userData); // Use the implemented service function
       setShowAddModal(false);
       fetchUsers(); // Refetch list to show the new user

       if (onAddUser) {
         onAddUser(); // Propagate event if handler exists
       }
     } catch (error: any) {
       console.error('Error creating user:', error);
       setError(error.response?.data?.message || 'Failed to create user.');
     } finally {
       setIsSubmitting(false);
     }
  };

  // Handle user submission from modal (Edit)
   const handleEditUserSubmit = async (data: { name?: string; email?: string; role?: string; status?: string; firstName?: string; lastName?: string; /* other fields */ }) => {
     if (!selectedUser) return;

     // Prepare data for API, matching UserUpdatePayload from userService
     // The modal might still pass firstName, lastName; we should prioritize 'name' if available,
     // or construct it if the API expects separate fields and userService.UserUpdatePayload reflects that.
     const updateData: UserUpdatePayload = {
       name: data.name || (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.firstName || data.lastName), // Prioritize 'name', fallback to constructing from parts
       email: data.email,
       role: data.role,
       status: data.status,
       // If your UserUpdatePayload and API expect first_name, last_name separately:
       // first_name: data.firstName,
       // last_name: data.lastName,
     };
     // Remove undefined fields to avoid sending them in the payload if not intended
     Object.keys(updateData).forEach(key => updateData[key as keyof UserUpdatePayload] === undefined && delete updateData[key as keyof UserUpdatePayload]);


     console.log("Data received from EditUserModal:", data);
     console.log("Prepared updateData for API call (updateUser):", updateData);

     setIsSubmitting(true);
     setError(null);
     try {
       await userService.updateUser(selectedUser.id, updateData); // Use the implemented service function
       setShowEditModal(false);
       setSelectedUser(null);
       fetchUsers(); // Refetch list to show updated user
     } catch (error: any) {
       console.error('Error updating user:', error);
       setError(error.response?.data?.message || 'Failed to update user.');
     } finally {
       setIsSubmitting(false);
     }
   };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Users</h2> {/* Added styling for heading */}
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
            placeholder="Search users by name, username, or email..."
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

       {/* Loading State */}
       {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin mr-2">⟳</div>
          Loading users...
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && ( // Only show error if not loading
        <div className="alert alert-error">
          <p>{error}</p>
           <button className="btn-primary mt-2" onClick={fetchUsers}>Try Again</button>
        </div>
      )}


      {/* Users Table */}
      {!isLoading && !error && (
        <div className="overflow-x-auto bg-background-card p-4 rounded-lg shadow"> {/* Added container styling */}
          <table className="min-w-full divide-y divide-border-color"> {/* Improved table structure */}
            <thead className="bg-background-header">
              <tr>
                <th scope="col" className="table-header text-left">User</th>
                <th scope="col" className="table-header text-left">Role</th>
                <th scope="col" className="table-header text-center">Status</th> {/* Added Status Column */}
                <th scope="col" className="table-header text-center">Assigned Flags</th> {/* Keep if relevant */}
                {/* Last Login column removed */}
                <th scope="col" className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-background-card divide-y divide-border-color">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-background-hover transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium text-text-primary">{user.displayName}</div>
                    <div className="text-sm text-text-secondary">{user.email}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                      {user.role || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                     <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-success-light text-success-dark' : 'bg-warning-light text-warning-dark'}`}>
                       {user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Unknown'}
                     </span>
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {(user.assignedFlags ?? 0) > 0 ? (
                      <span className="bg-error bg-opacity-10 text-error px-2 py-1 rounded-full text-xs font-medium">
                        {user.assignedFlags}
                      </span>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                  {/* Last Login cell removed */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex justify-end space-x-2">
                      <button
                        className="btn-tertiary text-sm" // Added text-sm
                        onClick={() => handleEditUserClick(user.id)}
                      >
                        Edit
                      </button>
                      {/* Add other actions like Delete if needed */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-text-secondary">
              <p>No users match your search or filters.</p> {/* Slightly rephrased */}
            </div>
          )}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && ( /* Conditional rendering to ensure modal is mounted only when needed */
        <AddUserModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddUserSubmit}
          // Pass any necessary props like roles if the modal needs them
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && ( /* Conditional rendering */
        <EditUserModal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSubmit={handleEditUserSubmit}
          // Map EnhancedUser to the props expected by EditUserModal
          // Ensure EditUserModal expects 'name' instead of 'firstName'/'lastName' or adapt mapping
          user={selectedUser ? {
            id: selectedUser.id,
            name: selectedUser.name, 
            email: selectedUser.email,
            role: selectedUser.role,
            status: selectedUser.status,
            organization_id: selectedUser.organization_id, // Added missing organization_id
            // Ensure all other required fields from User type are present if any
            // publisher_id is optional, so it's fine if not included here unless specifically needed by modal
          } : null}
        />
      )}
    </div>
  );
};

export default UserManagement;
