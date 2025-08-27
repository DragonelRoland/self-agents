import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Crown, Shield, User, UserMinus } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import apiService from '../services/apiService';

interface Organization {
  id: string;
  name: string;
  slug: string;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  isOwner: boolean;
  owner: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  members: {
    id: string;
    role: 'ADMIN' | 'MEMBER';
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
  }[];
  subscription?: {
    plan: string;
    maxTeamMembers?: number;
  };
  _count: {
    members: number;
    repositories: number;
  };
}

interface CreateOrgForm {
  name: string;
  slug: string;
}

interface InviteMemberForm {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'organizations'>('profile');
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState<string | null>(null);
  const [createOrgForm, setCreateOrgForm] = useState<CreateOrgForm>({ name: '', slug: '' });
  const [inviteForm, setInviteForm] = useState<InviteMemberForm>({ email: '', role: 'MEMBER' });
  
  const queryClient = useQueryClient();

  // Fetch user's organizations
  const { data: organizationsData, isLoading: orgLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await apiService.get('/organizations/my-organizations');
      return response.organizations as Organization[];
    },
    enabled: activeTab === 'organizations'
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (data: CreateOrgForm) => {
      return await apiService.post('/organizations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setShowCreateOrg(false);
      setCreateOrgForm({ name: '', slug: '' });
    }
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ orgId, data }: { orgId: string; data: InviteMemberForm }) => {
      return await apiService.post(`/organizations/${orgId}/invite`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setShowInviteMember(null);
      setInviteForm({ email: '', role: 'MEMBER' });
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ orgId, memberId }: { orgId: string; memberId: string }) => {
      return await apiService.delete(`/organizations/${orgId}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ orgId, memberId, role }: { orgId: string; memberId: string; role: string }) => {
      return await apiService.put(`/organizations/${orgId}/members/${memberId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  });

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    createOrgMutation.mutate(createOrgForm);
  };

  const handleInviteMember = (e: React.FormEvent, orgId: string) => {
    e.preventDefault();
    inviteMemberMutation.mutate({ orgId, data: inviteForm });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const canManageMembers = (org: Organization) => {
    return org.isOwner || org.userRole === 'ADMIN';
  };

  const isAtMemberLimit = (org: Organization) => {
    return org.subscription?.maxTeamMembers && 
           org._count.members >= org.subscription.maxTeamMembers;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account and team settings.</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="w-5 h-5 inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('organizations')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'organizations'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-5 h-5 inline mr-2" />
            Organizations
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Settings</h2>
          <p className="text-gray-600">Profile management coming soon...</p>
        </div>
      )}

      {/* Organizations Tab */}
      {activeTab === 'organizations' && (
        <div>
          {/* Create Organization Button */}
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
            <Button onClick={() => setShowCreateOrg(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>

          {/* Organizations List */}
          {orgLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : organizationsData && organizationsData.length > 0 ? (
            <div className="space-y-6">
              {organizationsData.map((org) => (
                <div key={org.id} className="bg-white rounded-lg shadow">
                  {/* Organization Header */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                          <p className="text-sm text-gray-500">@{org.slug}</p>
                        </div>
                        {getRoleIcon(org.userRole)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {org._count.members} members · {org._count.repositories} repositories
                        </p>
                        <p className="text-xs text-gray-400">
                          {org.subscription?.plan || 'Free'} Plan
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Team Members</h4>
                      {canManageMembers(org) && !isAtMemberLimit(org) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowInviteMember(org.id)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Invite
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Owner */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            {org.owner.avatar ? (
                              <img
                                src={org.owner.avatar}
                                alt={org.owner.name}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <User className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{org.owner.name}</p>
                            <p className="text-sm text-gray-500">{org.owner.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Crown className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium text-gray-700">Owner</span>
                        </div>
                      </div>

                      {/* Members */}
                      {org.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                              {member.user.avatar ? (
                                <img
                                  src={member.user.avatar}
                                  alt={member.user.name}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <User className="w-4 h-4 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.user.name}</p>
                              <p className="text-sm text-gray-500">{member.user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getRoleIcon(member.role)}
                            {canManageMembers(org) ? (
                              <select
                                value={member.role}
                                onChange={(e) => updateRoleMutation.mutate({
                                  orgId: org.id,
                                  memberId: member.id,
                                  role: e.target.value
                                })}
                                className="text-sm border border-gray-300 rounded px-2 py-1"
                              >
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                            ) : (
                              <span className="text-sm font-medium text-gray-700">{member.role}</span>
                            )}
                            {canManageMembers(org) && (
                              <button
                                onClick={() => removeMemberMutation.mutate({
                                  orgId: org.id,
                                  memberId: member.id
                                })}
                                className="text-red-600 hover:text-red-800 p-1"
                                disabled={removeMemberMutation.isPending}
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {isAtMemberLimit(org) && (
                      <p className="text-sm text-orange-600 mt-3">
                        Team member limit reached. Upgrade to add more members.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations yet</h3>
              <p className="text-gray-600 mb-4">Create an organization to collaborate with your team.</p>
              <Button onClick={() => setShowCreateOrg(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Organization
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Organization</h3>
            <form onSubmit={handleCreateOrg}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={createOrgForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCreateOrgForm({
                      name,
                      slug: generateSlug(name)
                    });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Acme Corp"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Slug
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={createOrgForm.slug}
                    onChange={(e) => setCreateOrgForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="acme-corp"
                    pattern="^[a-z0-9-]+$"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateOrg(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createOrgMutation.isPending}
                >
                  {createOrgMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
            <form onSubmit={(e) => handleInviteMember(e, showInviteMember)}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="colleague@example.com"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value as 'ADMIN' | 'MEMBER' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="MEMBER">Member - Can view and analyze repositories</option>
                  <option value="ADMIN">Admin - Can manage team members and settings</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteMember(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={inviteMemberMutation.isPending}
                >
                  {inviteMemberMutation.isPending ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;