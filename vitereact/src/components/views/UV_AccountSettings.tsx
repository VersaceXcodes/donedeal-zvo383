import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface PasswordFields {
  current: string;
  new: string;
  confirm: string;
}
interface PasswordErrors {
  current?: string;
  new?: string;
  confirm?: string;
}
interface LinkedAccount {
  provider: 'google' | 'facebook';
  connected: boolean;
}
interface NotificationSettings {
  new_message_email: boolean;
  offer_email: boolean;
  favorite_email: boolean;
}
interface SettingsErrors {
  new_message_email?: string;
  offer_email?: string;
  favorite_email?: string;
}

const UV_AccountSettings: React.FC = () => {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = useAppStore((s) => s.auth.token);
  const auth = useAppStore((s) => s.auth);
  const setAuth = useAppStore((s) => s.set_auth);
  const logout = useAppStore((s) => s.logout);
  const addToast = useAppStore((s) => s.add_toast);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI Tab
  const [activeTab, setActiveTab] = useState<
    'password' | 'linked_accounts' | 'notifications' | 'delete_account'
  >('password');

  // Change Password
  const [passwordFields, setPasswordFields] = useState<PasswordFields>({
    current: '',
    new: '',
    confirm: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const changePasswordMutation = useMutation<void, any, PasswordFields>(
    async (fields) => {
      await axios.put(
        `${API_BASE}/api/users/me/password`,
        { current: fields.current, new: fields.new, confirm: fields.confirm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        setPasswordFields({ current: '', new: '', confirm: '' });
        setPasswordErrors({});
        addToast({
          id: Date.now().toString(),
          type: 'success',
          message: 'Password changed successfully.'
        });
      },
      onError: (err) => {
        const data = err.response?.data;
        if (data?.errors) {
          setPasswordErrors(data.errors);
        } else {
          addToast({
            id: Date.now().toString(),
            type: 'error',
            message: err.message || 'Error changing password.'
          });
        }
      }
    }
  );

  // Linked Accounts
  const fetchLinkedAccounts = async (): Promise<LinkedAccount[]> => {
    const { data } = await axios.get<LinkedAccount[]>(
      `${API_BASE}/api/users/me/oauth`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  };
  const {
    data: linkedAccounts = [],
    isLoading: isLoadingLinkedAccounts,
    refetch: refetchLinkedAccounts
  } = useQuery<LinkedAccount[], Error>(
    ['oauthAccounts', auth.user?.uid],
    fetchLinkedAccounts,
    { enabled: !!token }
  );
  const linkAccountMutation = useMutation<unknown, Error, 'google' | 'facebook'>(
    async (provider) => {
      await axios.post(
        `${API_BASE}/api/users/me/oauth`,
        { provider },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        addToast({
          id: Date.now().toString(),
          type: 'success',
          message: 'Account linked.'
        });
        refetchLinkedAccounts();
      },
      onError: (err) => {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: err.message || 'Error linking account.'
        });
      }
    }
  );
  const unlinkAccountMutation = useMutation<unknown, Error, 'google' | 'facebook'>(
    async (provider) => {
      await axios.delete(`${API_BASE}/api/users/me/oauth`, {
        data: { provider },
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    {
      onSuccess: () => {
        addToast({
          id: Date.now().toString(),
          type: 'success',
          message: 'Account unlinked.'
        });
        refetchLinkedAccounts();
      },
      onError: (err) => {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: err.message || 'Error unlinking account.'
        });
      }
    }
  );

  // Notification Preferences
  const initialNotif =
    auth.user?.notification_settings || {
      new_message_email: false,
      offer_email: false,
      favorite_email: false
    };
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(initialNotif);
  const [settingsErrors, setSettingsErrors] = useState<SettingsErrors>({});
  const saveNotificationSettingsMutation = useMutation<
    NotificationSettings,
    any,
    NotificationSettings
  >(
    async (settings) => {
      const { data } = await axios.put<NotificationSettings>(
        `${API_BASE}/api/users/me/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    {
      onSuccess: (data) => {
        // update global auth.user.notification_settings
        if (auth.user) {
          setAuth({
            ...auth,
            user: { ...auth.user, notification_settings: data }
          });
        }
        setSettingsErrors({});
        addToast({
          id: Date.now().toString(),
          type: 'success',
          message: 'Notification settings saved.'
        });
      },
      onError: (err) => {
        const data = err.response?.data;
        if (data?.errors) {
          setSettingsErrors(data.errors);
        } else {
          addToast({
            id: Date.now().toString(),
            type: 'error',
            message: err.message || 'Error saving settings.'
          });
        }
      }
    }
  );

  // Delete Account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteAccountMutation = useMutation<void, Error>(
    async () => {
      await axios.delete(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    {
      onSuccess: () => {
        logout();
        addToast({
          id: Date.now().toString(),
          type: 'info',
          message: 'Account deleted.'
        });
        navigate('/');
      },
      onError: (err) => {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: err.message || 'Error deleting account.'
        });
      }
    }
  );

  // Front-end validation for password
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let errs: PasswordErrors = {};
    if (passwordFields.new !== passwordFields.confirm) {
      errs.confirm = 'Passwords do not match.';
    }
    if (Object.keys(errs).length) {
      setPasswordErrors(errs);
      return;
    }
    changePasswordMutation.mutate(passwordFields);
  };

  const handleNotificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveNotificationSettingsMutation.mutate(notificationSettings);
  };

  return (
    <>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Account Settings</h1>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4">
            <button
              onClick={() => setActiveTab('password')}
              className={`px-4 py-2 ${
                activeTab === 'password'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Change Password
            </button>
            <button
              onClick={() => setActiveTab('linked_accounts')}
              className={`px-4 py-2 ${
                activeTab === 'linked_accounts'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Linked Accounts
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 ${
                activeTab === 'notifications'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('delete_account')}
              className={`px-4 py-2 ${
                activeTab === 'delete_account'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Delete Account
            </button>
          </nav>
        </div>

        {/* Change Password */}
        {activeTab === 'password' && (
          <div className="mt-6">
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordFields.current}
                  onChange={(e) =>
                    setPasswordFields((f) => ({ ...f, current: e.target.value }))
                  }
                  className="w-full border border-gray-300 px-3 py-2 rounded"
                />
                {passwordErrors.current && (
                  <p className="text-red-600 text-sm mt-1">
                    {passwordErrors.current}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordFields.new}
                  onChange={(e) =>
                    setPasswordFields((f) => ({ ...f, new: e.target.value }))
                  }
                  className="w-full border border-gray-300 px-3 py-2 rounded"
                />
                {passwordErrors.new && (
                  <p className="text-red-600 text-sm mt-1">
                    {passwordErrors.new}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordFields.confirm}
                  onChange={(e) =>
                    setPasswordFields((f) => ({ ...f, confirm: e.target.value }))
                  }
                  className="w-full border border-gray-300 px-3 py-2 rounded"
                />
                {passwordErrors.confirm && (
                  <p className="text-red-600 text-sm mt-1">
                    {passwordErrors.confirm}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={changePasswordMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {changePasswordMutation.isLoading
                  ? 'Saving...'
                  : 'Change Password'}
              </button>
            </form>
          </div>
        )}

        {/* Linked Accounts */}
        {activeTab === 'linked_accounts' && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">Linked Accounts</h2>
            {isLoadingLinkedAccounts ? (
              <p>Loading...</p>
            ) : (
              ['google', 'facebook'].map((prov) => {
                const p = prov as 'google' | 'facebook';
                const acct = linkedAccounts.find((a) => a.provider === p);
                const connected = acct?.connected;
                return (
                  <div
                    key={p}
                    className="flex items-center justify-between mb-4"
                  >
                    <span className="capitalize">{p}</span>
                    {connected ? (
                      <button
                        onClick={() => unlinkAccountMutation.mutate(p)}
                        disabled={unlinkAccountMutation.isLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                      >
                        {unlinkAccountMutation.isLoading
                          ? 'Processing...'
                          : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={() => linkAccountMutation.mutate(p)}
                        disabled={linkAccountMutation.isLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                      >
                        {linkAccountMutation.isLoading
                          ? 'Processing...'
                          : 'Connect'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Notification Preferences */}
        {activeTab === 'notifications' && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">
              Notification Preferences
            </h2>
            <form onSubmit={handleNotificationSubmit}>
              <div className="flex items-center mb-3">
                <input
                  id="new_message_email"
                  type="checkbox"
                  checked={notificationSettings.new_message_email}
                  onChange={(e) =>
                    setNotificationSettings((s) => ({
                      ...s,
                      new_message_email: e.target.checked
                    }))
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label
                  htmlFor="new_message_email"
                  className="ml-2 block text-sm"
                >
                  Email on new message
                </label>
              </div>
              {settingsErrors.new_message_email && (
                <p className="text-red-600 text-sm mb-2">
                  {settingsErrors.new_message_email}
                </p>
              )}
              <div className="flex items-center mb-3">
                <input
                  id="offer_email"
                  type="checkbox"
                  checked={notificationSettings.offer_email}
                  onChange={(e) =>
                    setNotificationSettings((s) => ({
                      ...s,
                      offer_email: e.target.checked
                    }))
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="offer_email" className="ml-2 block text-sm">
                  Email on offer update
                </label>
              </div>
              {settingsErrors.offer_email && (
                <p className="text-red-600 text-sm mb-2">
                  {settingsErrors.offer_email}
                </p>
              )}
              <div className="flex items-center mb-3">
                <input
                  id="favorite_email"
                  type="checkbox"
                  checked={notificationSettings.favorite_email}
                  onChange={(e) =>
                    setNotificationSettings((s) => ({
                      ...s,
                      favorite_email: e.target.checked
                    }))
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label
                  htmlFor="favorite_email"
                  className="ml-2 block text-sm"
                >
                  Email on favorites
                </label>
              </div>
              {settingsErrors.favorite_email && (
                <p className="text-red-600 text-sm mb-2">
                  {settingsErrors.favorite_email}
                </p>
              )}
              <button
                type="submit"
                disabled={saveNotificationSettingsMutation.isLoading}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {saveNotificationSettingsMutation.isLoading
                  ? 'Saving...'
                  : 'Save Preferences'}
              </button>
            </form>
          </div>
        )}

        {/* Delete Account */}
        {activeTab === 'delete_account' && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">Delete Account</h2>
            <p className="text-gray-600 mb-4">
              Deleting your account is irreversible. All your data will be
              lost.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Delete Account
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Confirm Account Deletion
              </h3>
              <p className="mb-6">
                Are you sure you want to delete your account? This action
                cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                >
                  {deleteAccountMutation.isLoading
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_AccountSettings;