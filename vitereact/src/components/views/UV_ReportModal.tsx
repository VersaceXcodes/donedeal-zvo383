import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface UVReportModalProps {
  target: {
    type: 'listing' | 'user';
    uid: string;
  };
  onClose: () => void;
}

interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetUid: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_ReportModal: React.FC<UVReportModalProps> = ({ target, onClose }) => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);

  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if already reported
  const {
    data: existingReports,
    isLoading: isChecking,
    isError: isCheckError,
    error: checkError,
    refetch
  } = useQuery<Report[], Error>(
    ['reports', 'already', target.type, target.uid],
    async () => {
      const resp = await axios.get<Report[]>(`${API_BASE_URL}/api/reports`, {
        params: {
          reporter: 'current',
          target_type: target.type,
          target_uid: target.uid
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });
      return resp.data;
    },
    {
      enabled: !!token,
      onError: () => {
        // nothing extra
      }
    }
  );

  const alreadyReported = Array.isArray(existingReports) && existingReports.length > 0;

  // Submit mutation
  const reportMutation = useMutation<Report, Error, {
    target_type: string;
    target_uid: string;
    reason: string;
    details: string;
  }>(
    payload =>
      axios
        .post<Report>(`${API_BASE_URL}/api/reports`, payload, {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined
          }
        })
        .then(res => res.data),
    {
      onSuccess: () => {
        addToast({
          id: Date.now().toString(),
          type: 'success',
          message: 'Report submitted successfully.'
        });
        onClose();
      },
      onError: (error) => {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: error.message || 'Failed to submit report.'
        });
      }
    }
  );

  const handleSubmit = () => {
    const v: Record<string, string> = {};
    if (!reason) {
      v.reason = 'Please select a reason.';
    }
    if (reason === 'other' && details.length > 500) {
      v.details = 'Details must be 500 characters or less.';
    }
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors({});
    reportMutation.mutate({
      target_type: target.type,
      target_uid: target.uid,
      reason,
      details
    });
  };

  const isSubmitting = reportMutation.isLoading;

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75"></div>
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
          {isChecking ? (
            <div className="p-6 text-center text-gray-700">Checking report status...</div>
          ) : isCheckError ? (
            <div className="p-6">
              <p className="text-red-600 mb-4">
                Error checking report status: {checkError?.message}
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : alreadyReported ? (
            <div className="p-6">
              <p className="text-gray-800">
                You have already reported this{' '}
                {target.type === 'listing' ? 'listing' : 'user'}.
              </p>
              <div className="flex justify-end mt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">Report Content</h2>
              </div>
              <div className="px-6 py-4">
                <div className="mb-4">
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                    Reason
                  </label>
                  <select
                    id="reason"
                    name="reason"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a reason</option>
                    <option value="spam">Spam</option>
                    <option value="prohibited">Prohibited item</option>
                    <option value="inappropriate">Inappropriate</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.reason && (
                    <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
                  )}
                </div>
                {reason === 'other' && (
                  <div className="mb-4">
                    <label htmlFor="details" className="block text-sm font-medium text-gray-700">
                      Details (optional)
                    </label>
                    <textarea
                      id="details"
                      name="details"
                      rows={4}
                      value={details}
                      onChange={e => setDetails(e.target.value)}
                      disabled={isSubmitting}
                      maxLength={500}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {details.length}/500
                    </p>
                    {errors.details && (
                      <p className="mt-1 text-sm text-red-600">{errors.details}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t flex justify-end space-x-2">
                <button
                  onClick={onClose}
                  type="button"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  type="button"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ReportModal;