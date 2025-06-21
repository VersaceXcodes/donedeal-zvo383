import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface CategoryNode {
  uid: string;
  name: string;
  parent_uid: string | null;
  children: CategoryNode[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_AdminCategoriesList: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  const [newCategory, setNewCategory] = useState<{ name: string; parent_uid: string | null }>({
    name: '',
    parent_uid: null
  });
  const [categoryEdits, setCategoryEdits] = useState<Record<string, { name: string }>>({});
  const [categoryToDelete, setCategoryToDelete] = useState<{ uid: string; hasChildren: boolean }>({
    uid: '',
    hasChildren: false
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery<CategoryNode[], Error>(
    ['adminCategories'],
    async () => {
      const resp = await axios.get<CategoryNode[]>(
        `${API_BASE_URL}/api/admin/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return resp.data;
    },
    {
      onError: err => setError(err.message)
    }
  );

  // Add category
  const addCategoryMutation = useMutation<CategoryNode, Error, { name: string; parent_uid: string | null }>(
    payload =>
      axios.post<CategoryNode>(
        `${API_BASE_URL}/api/admin/categories`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['adminCategories']);
        setNewCategory({ name: '', parent_uid: null });
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Category added successfully' });
        setError(null);
      },
      onError: err => setError(err.message)
    }
  );

  // Edit category
  const editCategoryMutation = useMutation<CategoryNode, Error, { uid: string; name: string }>(
    ({ uid, name }) =>
      axios.put<CategoryNode>(
        `${API_BASE_URL}/api/admin/categories/${uid}`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['adminCategories']);
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Category updated successfully' });
        setError(null);
      },
      onError: err => setError(err.message),
      onSettled: (_data, _err, vars) => {
        // clear inline edit
        setCategoryEdits(prev => {
          const next = { ...prev };
          delete next[vars.uid];
          return next;
        });
      }
    }
  );

  // Delete category
  const deleteCategoryMutation = useMutation<void, Error, string>(
    uid =>
      axios.delete(
        `${API_BASE_URL}/api/admin/categories/${uid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(() => {}),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['adminCategories']);
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Category deleted successfully' });
        setError(null);
        setIsDeleteModalOpen(false);
      },
      onError: err => setError(err.message)
    }
  );

  // Flatten all nodes for parent-select dropdown
  const allNodes: { uid: string; name: string; depth: number }[] = [];
  const flattenAll = (nodes: CategoryNode[], depth: number) => {
    nodes.forEach(n => {
      allNodes.push({ uid: n.uid, name: n.name, depth });
      if (n.children.length) flattenAll(n.children, depth + 1);
    });
  };
  flattenAll(categories, 0);

  // Flatten displayed nodes for tree rendering (respecting expand/collapse)
  const displayList: { node: CategoryNode; depth: number }[] = [];
  const traverse = (nodes: CategoryNode[], depth: number) => {
    nodes.forEach(n => {
      displayList.push({ node: n, depth });
      if (expandedNodes[n.uid]) traverse(n.children, depth + 1);
    });
  };
  traverse(categories, 0);

  // Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }
    addCategoryMutation.mutate({ name: newCategory.name.trim(), parent_uid: newCategory.parent_uid });
  };

  const handleStartEdit = (uid: string, name: string) => {
    setError(null);
    setCategoryEdits(prev => ({ ...prev, [uid]: { name } }));
  };

  const handleCancelEdit = (uid: string) => {
    setError(null);
    setCategoryEdits(prev => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  const handleSaveEdit = (uid: string) => {
    const edit = categoryEdits[uid];
    if (!edit || !edit.name.trim()) {
      setError('Category name cannot be empty');
      return;
    }
    editCategoryMutation.mutate({ uid, name: edit.name.trim() });
  };

  const handleOpenDelete = (uid: string, hasChildren: boolean) => {
    setError(null);
    setCategoryToDelete({ uid, hasChildren });
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    setError(null);
    setIsDeleteModalOpen(false);
    setCategoryToDelete({ uid: '', hasChildren: false });
  };

  const handleConfirmDelete = () => {
    deleteCategoryMutation.mutate(categoryToDelete.uid);
  };

  const toggleNode = (uid: string) => {
    setExpandedNodes(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Categories Management</h1>
      {error && <div className="mb-4 text-red-600">{error}</div>}

      {/* Add Category Form */}
      <form onSubmit={handleAddCategory} className="mb-6 flex items-center space-x-2">
        <input
          type="text"
          placeholder="New category name"
          value={newCategory.name}
          onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
          className="flex-1 border rounded px-2 py-1"
        />
        <select
          value={newCategory.parent_uid || ''}
          onChange={e => setNewCategory({ ...newCategory, parent_uid: e.target.value || null })}
          className="border rounded px-2 py-1"
        >
          <option value="">None</option>
          {allNodes.map(item => (
            <option key={item.uid} value={item.uid}>
              {'—'.repeat(item.depth)} {item.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={addCategoryMutation.isLoading}
          className="bg-blue-500 text-white px-4 py-1 rounded disabled:opacity-50"
        >
          {addCategoryMutation.isLoading ? 'Adding...' : 'Add Category'}
        </button>
      </form>

      {/* Categories Tree */}
      {isLoading ? (
        <div>Loading categories...</div>
      ) : (
        <div>
          {displayList.map(({ node, depth }) => (
            <div key={node.uid} className="flex items-center mb-2" style={{ marginLeft: depth * 20 }}>
              {node.children.length > 0 ? (
                <button onClick={() => toggleNode(node.uid)} className="mr-2">
                  {expandedNodes[node.uid] ? '▼' : '▶'}
                </button>
              ) : (
                <span className="inline-block w-4 mr-2" />
              )}

              {categoryEdits[node.uid] ? (
                <>
                  <input
                    type="text"
                    value={categoryEdits[node.uid].name}
                    onChange={e =>
                      setCategoryEdits(prev => ({
                        ...prev,
                        [node.uid]: { name: e.target.value }
                      }))
                    }
                    className="flex-1 border rounded px-2 py-1 mr-2"
                  />
                  <button onClick={() => handleSaveEdit(node.uid)} className="text-green-500 mr-2">
                    Save
                  </button>
                  <button onClick={() => handleCancelEdit(node.uid)} className="text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1">{node.name}</span>
                  <button onClick={() => handleStartEdit(node.uid, node.name)} className="text-blue-500 mr-2">
                    Edit
                  </button>
                  <button
                    onClick={() => handleOpenDelete(node.uid, node.children.length > 0)}
                    className="text-red-500"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-1/3">
            {categoryToDelete.hasChildren ? (
              <p className="mb-4 text-red-600">Cannot delete category with subcategories.</p>
            ) : (
              <p className="mb-4">Are you sure you want to delete this category?</p>
            )}
            {error && <div className="mb-4 text-red-600">{error}</div>}
            <div className="flex justify-end space-x-2">
              <button onClick={handleCancelDelete} className="px-4 py-1 border rounded">
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={categoryToDelete.hasChildren || deleteCategoryMutation.isLoading}
                className="px-4 py-1 bg-red-500 text-white rounded disabled:opacity-50"
              >
                {deleteCategoryMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminCategoriesList;