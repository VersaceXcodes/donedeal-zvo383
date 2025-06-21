import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAppStore, ListingDraftData } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface SaveDraftPayload {
  location: string;
  location_lat: number;
  location_lng: number;
  listing_duration: number;
  tags: string[];
  status: 'draft';
}

interface PublishPayload extends Omit<SaveDraftPayload, never> {
  status: 'publish';
}

interface ListingResponse {
  uid: string;
  // ...other listing fields
}

const UV_ListingWizardStep3: React.FC = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { draftId?: string } };
  const draftId = state?.draftId;
  const queryClient = useQueryClient();

  const drafts = useAppStore(s => s.drafts);
  const setDraft = useAppStore(s => s.set_draft);
  const removeDraft = useAppStore(s => s.remove_draft);
  const addToast = useAppStore(s => s.add_toast);
  const token = useAppStore(s => s.auth.token);

  const [locationValue, setLocationValue] = useState<string>('');
  const [locationLat, setLocationLat] = useState<number>(0);
  const [locationLng, setLocationLng] = useState<number>(0);
  const [listingDuration, setListingDuration] = useState<number>(30);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [errors, setErrors] = useState<{
    location?: string;
    listingDuration?: string;
    tags?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Redirect back if no draftId
  useEffect(() => {
    if (!draftId) {
      navigate('/listings/new/step1', { replace: true });
    }
  }, [draftId, navigate]);

  // Fetch existing draft if not in store
  const draftData = draftId ? drafts[draftId] : undefined;
  const {
    data: fetchedData,
    isLoading: isLoadingDraft,
    isError: isErrorDraft,
    error: draftError
  } = useQuery<ListingDraftData & { uid: string }, Error>(
    ['listingDraft', draftId],
    async () => {
      const { data } = await axios.get(`${apiBase}/api/listings/${draftId}`);
      return data;
    },
    {
      enabled: !!draftId && !draftData
    }
  );

  // Initialize local state from draft store or fetched data
  useEffect(() => {
    const src = draftData || fetchedData;
    if (src) {
      setLocationValue(src.location || '');
      setLocationLat(src.location_lat || 0);
      setLocationLng(src.location_lng || 0);
      setListingDuration(src.listing_duration || 30);
      setTags(src.tags || []);
      if (src.uid && !draftData) {
        // seed global draft
        setDraft(src.uid, {
          location: src.location,
          location_lat: src.location_lat,
          location_lng: src.location_lng,
          listing_duration: src.listing_duration,
          tags: src.tags || []
        });
      }
    }
  }, [draftData, fetchedData, setDraft]);

  // Mutations
  const saveDraftMutation = useMutation<ListingResponse, Error, SaveDraftPayload>(
    payload =>
      axios
        .put(
          `${apiBase}/api/listings/${draftId}`,
          payload,
          {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          }
        )
        .then(res => res.data)
  );

  const publishMutation = useMutation<ListingResponse, Error, PublishPayload>(
    payload =>
      axios
        .put(
          `${apiBase}/api/listings/${draftId}`,
          payload,
          {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          }
        )
        .then(res => res.data)
  );

  // Handlers
  const handleSaveDraft = () => {
    setErrors({});
    setIsSubmitting(true);
    const payload: SaveDraftPayload = {
      location: locationValue,
      location_lat: locationLat,
      location_lng: locationLng,
      listing_duration: listingDuration,
      tags,
      status: 'draft'
    };
    saveDraftMutation.mutate(payload, {
      onSuccess: data => {
        setDraft(draftId!, {
          location: locationValue,
          location_lat: locationLat,
          location_lng: locationLng,
          listing_duration: listingDuration,
          tags
        });
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Draft saved' });
        setIsSubmitting(false);
      },
      onError: err => {
        addToast({ id: `${Date.now()}`, type: 'error', message: `Error saving draft: ${err.message}` });
        setIsSubmitting(false);
      }
    });
  };

  const handlePublish = () => {
    const newErrors: typeof errors = {};
    if (!locationValue.trim()) newErrors.location = 'Location is required';
    if (![30, 60, 90].includes(listingDuration)) newErrors.listingDuration = 'Select a duration';
    if (tags.length > 10) newErrors.tags = 'Max 10 tags allowed';
    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;

    setIsSubmitting(true);
    const payload: PublishPayload = {
      location: locationValue,
      location_lat: locationLat,
      location_lng: locationLng,
      listing_duration: listingDuration,
      tags,
      status: 'publish'
    };
    publishMutation.mutate(payload, {
      onSuccess: data => {
        removeDraft(draftId!);
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Listing published' });
        navigate(`/listings/${draftId}`);
        setIsSubmitting(false);
      },
      onError: err => {
        addToast({ id: `${Date.now()}`, type: 'error', message: `Error publishing: ${err.message}` });
        setIsSubmitting(false);
      }
    });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !tags.includes(val) && tags.length < 10) {
        setTags([...tags, val]);
        setTagInput('');
        setErrors({ ...errors, tags: undefined });
      }
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(x => x !== t));
  };

  const isFormValid = !!locationValue.trim() && [30, 60, 90].includes(listingDuration) && tags.length <= 10;

  if (!draftId) {
    return <></>;
  }
  if (isLoadingDraft) {
    return <div className="p-4">Loading draft...</div>;
  }
  if (isErrorDraft) {
    return <div className="p-4 text-red-600">Error loading draft: {draftError?.message}</div>;
  }

  const draft = drafts[draftId] || {};

  return (
    <>
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Create/Edit Listing – Step 3: Location & Review</h1>

        {/* Location Input */}
        <div className="mb-4">
          <label className="block font-medium mb-1">Location<span className="text-red-500">*</span></label>
          <input
            type="text"
            value={locationValue}
            onChange={e => { setLocationValue(e.target.value); setErrors({ ...errors, location: undefined }); }}
            className="w-full border rounded p-2"
            placeholder="Enter listing location"
          />
          {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
        </div>

        {/* Duration Select */}
        <div className="mb-4">
          <label className="block font-medium mb-1">Listing Duration (days)<span className="text-red-500">*</span></label>
          <select
            value={listingDuration}
            onChange={e => { setListingDuration(+e.target.value); setErrors({ ...errors, listingDuration: undefined }); }}
            className="w-full border rounded p-2"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          {errors.listingDuration && <p className="text-red-500 text-sm mt-1">{errors.listingDuration}</p>}
        </div>

        {/* Tags Input */}
        <div className="mb-4">
          <label className="block font-medium mb-1">Tags (max 10)</label>
          <div className="flex flex-wrap">
            {tags.map(t => (
              <span
                key={t}
                className="inline-flex items-center bg-gray-200 text-gray-700 rounded-full px-3 py-1 mr-2 mb-2"
              >
                {t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >&times;</button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="border rounded p-2 flex-grow min-w-[120px]"
              placeholder="Add tag and press Enter"
            />
          </div>
          {errors.tags && <p className="text-red-500 text-sm mt-1">{errors.tags}</p>}
        </div>

        {/* Review Summary */}
        <div className="mb-6 border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">Review Listing</h2>
          <p><strong>Title:</strong> {draft.title || '—'}</p>
          <p><strong>Category:</strong> {draft.category_uid || '—'}</p>
          <p><strong>Condition:</strong> {draft.condition || '—'}</p>
          <p><strong>Description:</strong> {draft.description || '—'}</p>
          <p><strong>Price:</strong> {draft.price != null ? `${draft.price} ${draft.currency}` : '—'}</p>
          <p><strong>Negotiable:</strong> {draft.negotiable ? 'Yes' : 'No'}</p>
          <p><strong>Images:</strong></p>
          <div className="flex flex-wrap mb-2">
            {(draft.images || []).map(img => (
              <img
                key={img.uid}
                src={img.url}
                alt="preview"
                className="w-16 h-16 object-cover mr-2 mb-2 rounded"
              />
            ))}
          </div>
          <p><strong>Location:</strong> {locationValue || '—'}</p>
          <p><strong>Duration:</strong> {listingDuration} days</p>
          <p><strong>Tags:</strong> {tags.join(', ') || '—'}</p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Link
            to="/listings/new/step2"
            state={{ draftId }}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Back
          </Link>
          <div className="space-x-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting || !isFormValid}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Publish
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_ListingWizardStep3;