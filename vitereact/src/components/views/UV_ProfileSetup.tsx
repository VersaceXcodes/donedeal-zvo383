import React, { useState, useEffect, ChangeEvent } from 'react';
import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore, User } from '@/store/main';
import { useNavigate } from 'react-router-dom';

const UV_ProfileSetup: React.FC = () => {
  // base URLs and keys
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  // global state
  const token = useAppStore(state => state.auth.token);
  const isAuthenticated = useAppStore(state => state.auth.is_authenticated);
  const existingUser = useAppStore(state => state.auth.user);
  const setAuth = useAppStore(state => state.set_auth);
  const add_toast = useAppStore(state => state.add_toast);

  const navigate = useNavigate();

  // local form state
  const [displayName, setDisplayName] = useState<string>(existingUser?.display_name || '');
  const [location, setLocation] = useState<string>('');
  const [locationLat, setLocationLat] = useState<number>(0);
  const [locationLng, setLocationLng] = useState<number>(0);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string>(existingUser?.profile_pic_url || '');
  const [bio, setBio] = useState<string>('');
  const [errors, setErrors] = useState<{
    displayName?: string;
    location?: string;
    bio?: string;
  }>({});

  // fetch place suggestions
  interface PlaceSuggestion { description: string; place_id: string; }
  interface GoogleAutocompleteResponse { predictions: PlaceSuggestion[]; status: string; }
  const {
    data: suggestions = [],
    isFetching: isFetchingSuggestions
  } = useQuery<PlaceSuggestion[], Error>(
    ['place_suggestions', location],
    () => axios
      .get<GoogleAutocompleteResponse>(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        { params: { input: location, key: GOOGLE_PLACES_API_KEY } }
      )
      .then(res => res.data.predictions),
    { enabled: !!GOOGLE_PLACES_API_KEY && location.trim().length > 2 }
  );

  // upload profile pic mutation
  const uploadPicMutation = useMutation<string, Error, File>(
    (file) => {
      const formData = new FormData();
      formData.append('profile_pic', file);
      return axios.post<{ url: string }>(
        `${API_BASE_URL}/api/users/me/profile-pic`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      ).then(res => res.data.url);
    },
    {
      onSuccess: (url) => {
        setProfilePicUrl(url);
        add_toast({
          id: crypto.randomUUID(),
          type: 'success',
          message: 'Profile picture uploaded'
        });
      },
      onError: (err) => {
        add_toast({
          id: crypto.randomUUID(),
          type: 'error',
          message: err.message
        });
      }
    }
  );

  // update profile mutation
  interface ProfileUpdatePayload {
    display_name: string;
    location: string;
    location_lat: number;
    location_lng: number;
    bio: string;
  }
  const updateProfileMutation = useMutation<User, Error, ProfileUpdatePayload>(
    (payload) =>
      axios
        .put<User>(
          `${API_BASE_URL}/api/users/me`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then(res => res.data),
    {
      onSuccess: (updatedUser) => {
        setAuth({
          is_authenticated: true,
          token: token!,
          user: updatedUser
        });
        add_toast({
          id: crypto.randomUUID(),
          type: 'success',
          message: 'Profile updated successfully'
        });
        navigate('/home');
      },
      onError: (err) => {
        add_toast({
          id: crypto.randomUUID(),
          type: 'error',
          message: err.message
        });
      }
    }
  );

  // handlers
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      add_toast({
        id: crypto.randomUUID(),
        type: 'error',
        message: 'Only JPEG or PNG allowed'
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      add_toast({
        id: crypto.randomUUID(),
        type: 'error',
        message: 'File must be ≤5MB'
      });
      return;
    }
    setProfilePicFile(file);
    // preview
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicUrl(reader.result as string);
    reader.readAsDataURL(file);
    // upload
    uploadPicMutation.mutate(file);
  };

  const handleSelectSuggestion = async (s: PlaceSuggestion) => {
    setLocation(s.description);
    // get lat/lng
    try {
      const resp = await axios.get<{ result: { geometry: { location: { lat: number; lng: number } } } }>(
        'https://maps.googleapis.com/maps/api/place/details/json',
        { params: { place_id: s.place_id, key: GOOGLE_PLACES_API_KEY } }
      );
      const loc = resp.data.result.geometry.location;
      setLocationLat(loc.lat);
      setLocationLng(loc.lng);
    } catch (err: any) {
      add_toast({
        id: crypto.randomUUID(),
        type: 'error',
        message: 'Failed to fetch location details'
      });
    }
  };

  const handleSubmit = () => {
    const newErrors: typeof errors = {};
    if (!displayName.trim()) newErrors.displayName = 'Display name is required';
    else if (displayName.length > 50) newErrors.displayName = 'Max 50 characters';
    if (!location.trim()) newErrors.location = 'Location is required';
    if (bio.length > 200) newErrors.bio = 'Max 200 characters';
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    updateProfileMutation.mutate({
      display_name: displayName.trim(),
      location: location.trim(),
      location_lat: locationLat,
      location_lng: locationLng,
      bio: bio.trim()
    });
  };

  const isFormValid = displayName.trim() !== '' && location.trim() !== '';
  const isSubmitting = updateProfileMutation.isLoading;

  return (
    <>
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Complete Your Profile</h1>
        {/* Display Name */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">Display Name *</label>
          <input
            type="text"
            maxLength={50}
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setErrors({...errors, displayName: undefined}); }}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter display name"
          />
          {errors.displayName && (
            <p className="text-red-600 text-sm mt-1">{errors.displayName}</p>
          )}
        </div>
        {/* Location */}
        <div className="mb-4 relative">
          <label className="block mb-1 font-medium">Location *</label>
          <input
            type="text"
            value={location}
            onChange={e => { setLocation(e.target.value); setErrors({...errors, location: undefined}); }}
            className="w-full border rounded px-3 py-2"
            placeholder="Start typing your address..."
          />
          {isFetchingSuggestions && (
            <p className="text-gray-500 text-sm mt-1">Loading suggestions...</p>
          )}
          {suggestions.length > 0 && (
            <ul className="absolute z-10 bg-white border rounded w-full max-h-40 overflow-auto mt-1">
              {suggestions.map(s => (
                <li
                  key={s.place_id}
                  onClick={() => handleSelectSuggestion(s)}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                >
                  {s.description}
                </li>
              ))}
            </ul>
          )}
          {errors.location && (
            <p className="text-red-600 text-sm mt-1">{errors.location}</p>
          )}
        </div>
        {/* Profile Picture */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">Profile Picture</label>
          {profilePicUrl && (
            <img
              src={profilePicUrl}
              alt="Preview"
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            className="block"
          />
          {uploadPicMutation.isLoading && (
            <p className="text-gray-500 text-sm mt-1">Uploading...</p>
          )}
        </div>
        {/* Bio */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">Bio</label>
          <textarea
            maxLength={200}
            rows={4}
            value={bio}
            onChange={e => { setBio(e.target.value); setErrors({...errors, bio: undefined}); }}
            className="w-full border rounded px-3 py-2"
            placeholder="Tell us a bit about yourself..."
          />
          <p className="text-gray-500 text-sm mt-1">{bio.length}/200</p>
          {errors.bio && (
            <p className="text-red-600 text-sm mt-1">{errors.bio}</p>
          )}
        </div>
        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </>
  );
};

export default UV_ProfileSetup;