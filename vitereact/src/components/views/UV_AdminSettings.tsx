import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface AdminSettingsPayload {
  max_images_per_listing: number;
  default_listing_durations: number[];
  allowed_file_types: string[];
  moderation_mode: 'auto' | 'manual';
  support_email: string;
  maintenance_mode: { enabled: boolean };
  max_listing_duration: { days: number };
}

const defaultSettings: AdminSettingsPayload = {
  max_images_per_listing: 5,
  default_listing_durations: [30, 60, 90],
  allowed_file_types: ['jpg', 'png'],
  moderation_mode: 'manual',
  support_email: 'support@example.com',
  maintenance_mode: { enabled: false },
  max_listing_duration: { days: 30 }
};

const UV_AdminSettings: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const setMaintenanceMode = useAppStore(state => state.set_maintenance_mode);
  const setMaxListingDuration = useAppStore(state => state.set_max_listing_duration);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<AdminSettingsPayload>(defaultSettings);
  const [initialSettings, setInitialSettings] = useState<AdminSettingsPayload>(defaultSettings);
  const [error, setError] = useState<string | null>(null);
  const [newDuration, setNewDuration] = useState<string>('');
  const [newFileType, setNewFileType] = useState<string>('');

  // Fetch settings
  const {
    data,
    isLoading,
    isError,
    error: queryError
  } = useQuery<AdminSettingsPayload, Error>(
    ['adminSettings'],
    async () => {
      if (!token) throw new Error('Not authenticated');
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const { data } = await axios.get<AdminSettingsPayload>(
        `${base}/api/admin/settings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    { retry: false }
  );

  useEffect(() => {
    if (data) {
      setSettings(data);
      setInitialSettings(data);
    }
  }, [data]);

  // Save mutation
  const { mutate: saveSettings, isLoading: isSaving } = useMutation<
    AdminSettingsPayload,
    Error,
    AdminSettingsPayload
  >(
    async (newSettings) => {
      if (!token) throw new Error('Not authenticated');
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const { data } = await axios.put<AdminSettingsPayload>(
        `${base}/api/admin/settings`,
        newSettings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    {
      onMutate: () => {
        setError(null);
      },
      onSuccess: (saved) => {
        // update local & global
        setSettings(saved);
        setInitialSettings(saved);
        setMaintenanceMode(saved.maintenance_mode.enabled);
        setMaxListingDuration(saved.max_listing_duration.days);
        queryClient.setQueryData(['adminSettings'], saved);
        addToast({
          id: `admin-settings-save-${Date.now()}`,
          type: 'success',
          message: 'Settings saved successfully'
        });
      },
      onError: (err) => {
        setError(err.message);
      }
    }
  );

  // Handlers for dynamic arrays
  const updateDuration = (idx: number, val: number) => {
    const arr = [...settings.default_listing_durations];
    arr[idx] = val;
    setSettings({ ...settings, default_listing_durations: arr });
  };
  const removeDuration = (idx: number) => {
    const arr = settings.default_listing_durations.filter((_, i) => i !== idx);
    setSettings({ ...settings, default_listing_durations: arr });
  };
  const addDuration = () => {
    const num = parseInt(newDuration, 10);
    if (!isNaN(num)) {
      setSettings({
        ...settings,
        default_listing_durations: [...settings.default_listing_durations, num]
      });
      setNewDuration('');
    }
  };

  const updateFileType = (idx: number, val: string) => {
    const arr = [...settings.allowed_file_types];
    arr[idx] = val;
    setSettings({ ...settings, allowed_file_types: arr });
  };
  const removeFileType = (idx: number) => {
    const arr = settings.allowed_file_types.filter((_, i) => i !== idx);
    setSettings({ ...settings, allowed_file_types: arr });
  };
  const addFileType = () => {
    const ft = newFileType.trim();
    if (ft) {
      setSettings({
        ...settings,
        allowed_file_types: [...settings.allowed_file_types, ft]
      });
      setNewFileType('');
    }
  };

  const handleCancel = () => {
    setSettings(initialSettings);
    setError(null);
  };

  return (
    <>
      {isLoading ? (
        <div className="p-4">Loading settings...</div>
      ) : isError ? (
        <div className="p-4 text-red-600">Error: {queryError?.message}</div>
      ) : (
        <div className="max-w-4xl mx-auto p-4">
          <h1 className="text-2xl font-semibold mb-6">Admin Site Settings</h1>
          {(error) && (
            <div className="mb-4 text-red-600">Error: {error}</div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings(settings);
            }}
          >
            {/* max_images_per_listing */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Images Per Listing
              </label>
              <input
                type="number"
                min={1}
                value={settings.max_images_per_listing}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_images_per_listing: parseInt(e.target.value, 10) || 0
                  })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>

            {/* default_listing_durations */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Listing Durations (days)
              </label>
              <ul className="space-y-2 mb-2">
                {settings.default_listing_durations.map((d, idx) => (
                  <li key={idx} className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={1}
                      value={d}
                      onChange={(e) =>
                        updateDuration(idx, parseInt(e.target.value, 10) || 0)
                      }
                      className="border border-gray-300 rounded-md p-1 w-24"
                    />
                    <button
                      type="button"
                      onClick={() => removeDuration(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Add duration"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="border border-gray-300 rounded-md p-1 w-24"
                />
                <button
                  type="button"
                  onClick={addDuration}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  Add
                </button>
              </div>
            </div>

            {/* allowed_file_types */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allowed File Types
              </label>
              <ul className="space-y-2 mb-2">
                {settings.allowed_file_types.map((ft, idx) => (
                  <li key={idx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={ft}
                      onChange={(e) => updateFileType(idx, e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-32"
                    />
                    <button
                      type="button"
                      onClick={() => removeFileType(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Add file type"
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value)}
                  className="border border-gray-300 rounded-md p-1 w-32"
                />
                <button
                  type="button"
                  onClick={addFileType}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  Add
                </button>
              </div>
            </div>

            {/* moderation_mode */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moderation Mode
              </label>
              <select
                value={settings.moderation_mode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    moderation_mode: e.target.value as 'auto' | 'manual'
                  })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {/* support_email */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Support Email
              </label>
              <input
                type="email"
                value={settings.support_email}
                onChange={(e) =>
                  setSettings({ ...settings, support_email: e.target.value })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>

            {/* maintenance_mode */}
            <div className="mb-6 flex items-center">
              <input
                id="maintenance_mode"
                type="checkbox"
                checked={settings.maintenance_mode.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maintenance_mode: { enabled: e.target.checked }
                  })
                }
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <label htmlFor="maintenance_mode" className="ml-2 text-sm">
                Enable Maintenance Mode
              </label>
            </div>

            {/* max_listing_duration */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Listing Duration (days)
              </label>
              <input
                type="number"
                min={1}
                value={settings.max_listing_duration.days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_listing_duration: {
                      days: parseInt(e.target.value, 10) || 0
                    }
                  })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isSaving}
                className={`${
                  isSaving ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                } text-white font-semibold py-2 px-4 rounded`}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default UV_AdminSettings;