import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface ListingResponse {
  id: string;
  title: string;
  description: string;
  category_uid: string;
  // optional, in case back-end supports it
  subcategory_uid?: string;
  condition: 'new' | 'like_new' | 'good' | 'acceptable';
}

interface DraftFields {
  uid: string | null;
  title: string;
  categoryUid: string;
  subcategoryUid: string;
  condition: string;
  description: string;
}

const UV_ListingWizardStep1: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAppStore(state => state.auth.token);
  const navCategories = useAppStore(state => state.nav.categories);

  const [draft, setDraft] = useState<DraftFields>({
    uid: id ?? null,
    title: '',
    categoryUid: '',
    subcategoryUid: '',
    condition: '',
    description: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySearch, setCategorySearch] = useState<string>('');

  // Fetch existing listing if editing
  const {
    data: listingData,
    isLoading: isLoadingListing,
    isError: isErrorListing,
    error: fetchError
  } = useQuery<ListingResponse, Error>(
    ['listing', id],
    async () => {
      const { data } = await axios.get<ListingResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/listings/${id}`,
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      return data;
    },
    { enabled: Boolean(id) }
  );

  useEffect(() => {
    if (listingData) {
      setDraft({
        uid: listingData.id,
        title: listingData.title,
        categoryUid: listingData.category_uid,
        subcategoryUid: listingData.subcategory_uid || '',
        condition: listingData.condition,
        description: listingData.description
      });
    }
  }, [listingData]);

  // Field validation
  const validateField = (name: keyof DraftFields, value: string) => {
    let message = '';
    if (name === 'title') {
      if (!value.trim()) message = 'Title is required';
      else if (value.length > 100) message = 'Title must be at most 100 characters';
    } else if (name === 'categoryUid') {
      if (!value) message = 'Category is required';
    } else if (name === 'subcategoryUid') {
      const parent = navCategories.find(c => c.uid === draft.categoryUid);
      if (parent && parent.children.length > 0 && !value) {
        message = 'Subcategory is required';
      }
    } else if (name === 'condition') {
      if (!value) message = 'Condition is required';
    } else if (name === 'description') {
      if (!value.trim()) message = 'Description is required';
      else if (value.length > 2000) message = 'Description must be at most 2000 characters';
    }
    setErrors(prev => {
      const copy = { ...prev };
      if (message) copy[name] = message;
      else delete copy[name];
      return copy;
    });
  };

  const isFormValid = () => {
    // run once to populate errors
    validateField('title', draft.title);
    validateField('categoryUid', draft.categoryUid);
    validateField('subcategoryUid', draft.subcategoryUid);
    validateField('condition', draft.condition);
    validateField('description', draft.description);

    const baseValid =
      draft.title.trim() &&
      draft.categoryUid &&
      draft.condition &&
      draft.description.trim();
    if (!baseValid) return false;

    const parent = navCategories.find(c => c.uid === draft.categoryUid);
    if (parent && parent.children.length > 0 && !draft.subcategoryUid) return false;

    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setDraft(prev => ({ ...prev, [name]: value }));
    validateField(name as keyof DraftFields, value);
  };

  // Mutations
  const createListing = useMutation<ListingResponse, Error, Partial<ListingResponse>>({
    mutationFn: async payload => {
      const { data } = await axios.post<ListingResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/listings`,
        {
          title: payload.title,
          category_uid: payload.category_uid,
          subcategory_uid: payload.subcategory_uid,
          condition: payload.condition,
          description: payload.description,
          status: 'draft'
        },
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      return data;
    },
    onSuccess: data => {
      navigate(`/listings/new/step2?id=${data.id}`);
    }
  });

  const updateListing = useMutation<ListingResponse, Error, Partial<ListingResponse>>({
    mutationFn: async payload => {
      if (!draft.uid) throw new Error('Missing listing id');
      const { data } = await axios.put<ListingResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/listings/${draft.uid}`,
        {
          title: payload.title,
          category_uid: payload.category_uid,
          subcategory_uid: payload.subcategory_uid,
          condition: payload.condition,
          description: payload.description,
          status: 'draft'
        },
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      return data;
    },
    onSuccess: data => {
      navigate(`/listings/${data.id}/edit/step2`);
    }
  });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    const payload: Partial<ListingResponse> = {
      title: draft.title.trim(),
      category_uid: draft.categoryUid,
      subcategory_uid: draft.subcategoryUid || undefined,
      condition: draft.condition as any,
      description: draft.description.trim()
    };
    if (draft.uid) {
      updateListing.mutate(payload);
    } else {
      createListing.mutate(payload);
    }
  };

  const isSubmitting = createListing.isLoading || updateListing.isLoading;

  if (isLoadingListing) {
    return <div className="p-4 text-center">Loading listing...</div>;
  }
  if (isErrorListing) {
    return (
      <div className="p-4 text-center text-red-600">
        Error loading listing: {fetchError?.message}
      </div>
    );
  }

  // Filter categories by search
  const filteredCats = navCategories.filter(cat =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const selectedCategory = navCategories.find(c => c.uid === draft.categoryUid);

  const conditionOptions: Record<string, string> = {
    new: 'New',
    like_new: 'Like New',
    good: 'Good',
    acceptable: 'Acceptable'
  };

  return (
    <>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Create/Edit Listing – Step 1</h1>
        <form onSubmit={handleNext}>
          <div className="mb-5">
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={draft.title}
              onChange={handleInputChange}
              className={`w-full border rounded px-3 py-2 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          <div className="mb-5">
            <label htmlFor="categorySearch" className="block text-sm font-medium mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="categorySearch"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
            />
            <select
              id="categoryUid"
              name="categoryUid"
              value={draft.categoryUid}
              onChange={handleInputChange}
              className={`w-full border rounded px-3 py-2 ${
                errors.categoryUid ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Category</option>
              {filteredCats.map(cat => (
                <option key={cat.uid} value={cat.uid}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryUid && (
              <p className="text-red-500 text-sm mt-1">{errors.categoryUid}</p>
            )}
          </div>

          {selectedCategory && selectedCategory.children.length > 0 && (
            <div className="mb-5">
              <label htmlFor="subcategoryUid" className="block text-sm font-medium mb-1">
                Subcategory <span className="text-red-500">*</span>
              </label>
              <select
                id="subcategoryUid"
                name="subcategoryUid"
                value={draft.subcategoryUid}
                onChange={handleInputChange}
                className={`w-full border rounded px-3 py-2 ${
                  errors.subcategoryUid ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Subcategory</option>
                {selectedCategory.children.map(sub => (
                  <option key={sub.uid} value={sub.uid}>
                    {sub.name}
                  </option>
                ))}
              </select>
              {errors.subcategoryUid && (
                <p className="text-red-500 text-sm mt-1">{errors.subcategoryUid}</p>
              )}
            </div>
          )}

          <div className="mb-5">
            <fieldset>
              <legend className="block text-sm font-medium mb-1">
                Condition <span className="text-red-500">*</span>
              </legend>
              <div className="space-y-2">
                {Object.entries(conditionOptions).map(([val, label]) => (
                  <div key={val} className="flex items-center">
                    <input
                      type="radio"
                      id={`condition_${val}`}
                      name="condition"
                      value={val}
                      checked={draft.condition === val}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <label htmlFor={`condition_${val}`} className="ml-2">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
              {errors.condition && (
                <p className="text-red-500 text-sm mt-1">{errors.condition}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Examples: “New” = brand new & unopened; “Like New” = minimal signs of
                wear; “Good” = used, fully functional; “Acceptable” = noticeable wear.
              </p>
            </fieldset>
          </div>

          <div className="mb-5">
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              value={draft.description}
              onChange={handleInputChange}
              className={`w-full border rounded px-3 py-2 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={2000}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid() || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
          >
            Next
          </button>
        </form>
      </div>
    </>
  );
};

export default UV_ListingWizardStep1;