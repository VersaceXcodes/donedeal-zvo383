import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, Toast } from '@/store/main';

const AUTO_DISMISS_MS = 5000;

const GV_ToastContainer: React.FC = () => {
  // Global toasts and removal action
  const globalToasts = useAppStore(state => state.ui.toasts);
  const remove_toast = useAppStore(state => state.remove_toast);

  // Local copy for scheduling timers & immediate removal
  const [visibleToasts, setVisibleToasts] = useState<Toast[]>([]);
  const scheduledIdsRef = useRef<Set<string>>(new Set());

  // 1) Sync local state when global ui.toasts changes
  useEffect(() => {
    setVisibleToasts(globalToasts);
  }, [globalToasts]);

  // 2) Schedule auto-dismiss for each new toast
  useEffect(() => {
    visibleToasts.forEach((toast) => {
      if (!scheduledIdsRef.current.has(toast.id)) {
        scheduledIdsRef.current.add(toast.id);
        setTimeout(() => {
          handleDismiss(toast.id);
        }, AUTO_DISMISS_MS);
      }
    });
  }, [visibleToasts]);

  // Dismiss handler: remove locally & from global store
  const handleDismiss = (id: string) => {
    // Immediate local removal for UI responsiveness
    setVisibleToasts((prev) => prev.filter((t) => t.id !== id));
    // Update global state
    remove_toast(id);
  };

  return (
    <>
      {visibleToasts.length > 0 && (
        <div
          aria-live="assertive"
          className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2"
        >
          {visibleToasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-sm w-full shadow-lg rounded bg-white ring-1 ring-black ring-opacity-5 ${
                toast.type === 'success'
                  ? 'border-l-4 border-green-400'
                  : toast.type === 'error'
                  ? 'border-l-4 border-red-400'
                  : 'border-l-4 border-blue-400'
              }`}
            >
              <div className="flex p-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {toast.type === 'success' ? (
                    <svg
                      className="h-6 w-6 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2l4 -4"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 22c5.523 0 10 -4.477 10 -10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10z"
                      />
                    </svg>
                  ) : toast.type === 'error' ? (
                    <svg
                      className="h-6 w-6 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 22c5.523 0 10 -4.477 10 -10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-6 w-6 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1 -4h.01"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 22c5.523 0 10 -4.477 10 -10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10z"
                      />
                    </svg>
                  )}
                </div>

                {/* Message */}
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    {toast.message}
                  </p>
                </div>

                {/* Close button */}
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => handleDismiss(toast.id)}
                    aria-label="Close"
                    className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293 -4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414 -1.414L8.586 10 4.293 5.707a1 1 0 010 -1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default GV_ToastContainer;