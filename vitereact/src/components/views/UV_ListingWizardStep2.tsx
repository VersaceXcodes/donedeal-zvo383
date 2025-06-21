import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore, ListingDraftData } from '@/store/main';

interface ListingImage {
  uid: string;
  url: string;
  sort_order: number;
}

interface UploadError {
  fileName: string;
  message: string;
}

const UV_ListingWizardStep2: React.FC = () => {
  const navigate = useNavigate();
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Global store hooks
  const drafts = useAppStore(state => state.drafts);
  const token = useAppStore(state => state.auth.token);
  const setDraft = useAppStore(state => state.set_draft);
  const addToast = useAppStore(state => state.add_toast);

  // Determine current draft ID (first key in drafts record)
  const draftId = useMemo<string | undefined>(() => {
    const keys = Object.keys(drafts);
    return keys.length > 0 ? keys[0] : undefined;
  }, [drafts]);

  // Redirect if not authenticated or no draft
  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    } else if (!draftId) {
      navigate('/listings/new/step1', { replace: true });
    }
  }, [token, draftId, navigate]);

  // Local state
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [negotiable, setNegotiable] = useState<boolean>(false);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from draft store
  useEffect(() => {
    if (!draftId) return;
    const draft: ListingDraftData = drafts[draftId];
    if (!draft) return;
    if (typeof draft.price === 'number') setPrice(draft.price);
    if (draft.currency) setCurrency(draft.currency);
    setNegotiable(!!draft.negotiable);
    if (Array.isArray(draft.images)) {
      setImages(draft.images.map(img => ({
        uid: img.uid,
        url: img.url,
        sort_order: img.sort_order
      })));
    }
  }, [draftId, drafts]);

  // Mutations
  const uploadImageMutation = useMutation<ListingImage, Error, File>(
    (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return axios
        .post<ListingImage>(
          `${baseURL}/api/listings/${draftId}/images`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        )
        .then(res => res.data);
    },
    {
      onSuccess: img => {
        setImages(prev => [...prev, img]);
      },
      onError: (err, file) => {
        setUploadErrors(prev => [
          ...prev,
          { fileName: file.name, message: err.message }
        ]);
      }
    }
  );

  const deleteImageMutation = useMutation<void, Error, string>(
    (imageUid: string) => {
      return axios
        .delete(
          `${baseURL}/api/listings/${draftId}/images/${imageUid}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        .then(res => res.data);
    },
    {
      onSuccess: (_data, imageUid) => {
        setImages(prev => prev.filter(img => img.uid !== imageUid));
      },
      onError: err => {
        addToast({
          id: `${Date.now()}`,
          type: 'error',
          message: `Delete failed: ${err.message}`
        });
      }
    }
  );

  const updateDraftMutation = useMutation<ListingDraftData, Error>(
    () => {
      const payload = {
        price,
        currency,
        negotiable,
        images: images.map(img => ({
          uid: img.uid,
          sort_order: img.sort_order
        }))
      };
      return axios
        .put<ListingDraftData>(
          `${baseURL}/api/listings/${draftId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        .then(res => res.data);
    },
    {
      onSuccess: data => {
        // sync into global draft store
        setDraft(draftId!, data);
        navigate('/listings/new/step3');
      },
      onError: err => {
        addToast({
          id: `${Date.now()}`,
          type: 'error',
          message: `Save draft failed: ${err.message}`
        });
      }
    }
  );

  // Handlers
  const handleFiles = async (files: FileList) => {
    if (!draftId) return;
    setUploadErrors([]);
    setIsUploading(true);
    const list = Array.from(files).slice(0, 10 - images.length);
    for (const file of list) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setUploadErrors(prev => [
          ...prev,
          { fileName: file.name, message: 'Unsupported file type' }
        ]);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadErrors(prev => [
          ...prev,
          { fileName: file.name, message: 'File exceeds 5 MB' }
        ]);
        continue;
      }
      try {
        await uploadImageMutation.mutateAsync(file);
      } catch {
        // handled in onError
      }
    }
    setIsUploading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleBack = () => {
    navigate('/listings/new/step1');
  };

  const handleNext = () => {
    updateDraftMutation.mutate();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };
  const handleDragOverThumb = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDropThumb = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const targetIdx = Number((e.currentTarget as HTMLElement).dataset.index);
    const newImages = [...images];
    const [moved] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIdx, 0, moved);
    // reassign sort_order
    newImages.forEach((img, i) => {
      img.sort_order = i;
    });
    setImages(newImages);
    setDraggedIndex(null);
  };

  const currencyOptions = ['USD', 'EUR', 'GBP'];

  // Prevent render until ready
  if (!token || !draftId) {
    return null;
  }

  return (
    <>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Step 2: Pricing & Media</h1>

        <div className="space-y-6">
          {/* Price & Currency */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Price</label>
            <div className="flex">
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(parseFloat(e.target.value))}
                className="flex-1 border rounded-l p-2 focus:outline-none"
              />
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="border-t border-b border-r rounded-r p-2 focus:outline-none"
              >
                {currencyOptions.map(curr => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Negotiable Toggle */}
          <div className="flex items-center space-x-2">
            <input
              id="negotiable"
              type="checkbox"
              checked={negotiable}
              onChange={e => setNegotiable(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="negotiable" className="text-sm">
              Accept offers (Negotiable)
            </label>
          </div>

          {/* Image Uploader */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Images (1–10)
            </label>
            <div
              className={`relative p-6 border-2 border-dashed rounded cursor-pointer ${
                dragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 bg-white'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading && (
                <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <p className="text-gray-500 text-center">
                Drag & drop images here, or click to select
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png, image/jpeg"
                className="hidden"
                onChange={e => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = '';
                }}
                disabled={isUploading || images.length >= 10}
              />
            </div>
            {uploadErrors.length > 0 && (
              <ul className="text-red-600 text-sm space-y-1">
                {uploadErrors.map(err => (
                  <li key={err.fileName}>
                    {err.fileName}: {err.message}
                  </li>
                ))}
              </ul>
            )}

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                {images
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((img, idx) => (
                    <div
                      key={img.uid}
                      className="relative"
                      draggable
                      data-index={idx}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOverThumb}
                      onDrop={handleDropThumb}
                    >
                      <img
                        src={img.url}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => deleteImageMutation.mutate(img.uid)}
                        className="absolute top-1 right-1 bg-white rounded-full p-1 hover:bg-gray-100"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                      <div className="absolute bottom-1 left-1 bg-white bg-opacity-75 rounded-full p-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M7 4h2v2H7V4zm0 4h2v2H7V8zm0 4h2v2H7v-2zm4-8h2v2h-2V4zm0 4h2v2h-2V8zm0 4h2v2h-2v-2z" />
                        </svg>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={images.length < 1 || updateDraftMutation.isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          >
            {updateDraftMutation.isLoading ? 'Saving...' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
};

export default UV_ListingWizardStep2;