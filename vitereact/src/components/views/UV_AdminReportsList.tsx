import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Link, useSearchParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface ReportSummary {
  uid: string;
  reporterUid: string;
  reporterName: string;
  targetType: 'listing' | 'user';
  targetUid: string;
  reason: string;
  status: string;
  created_at: string;
}

interface ReportFilters {
  status?: string;
  search?: string;
  page: number;
  per_page: number;
}

interface FetchReportsResponse {
  reports: ReportSummary[];
  total: number;
}

const UV_AdminReportsList: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local filter inputs
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [searchFilter, setSearchFilter] = useState<string>(searchParams.get('search') || '');

  // Selected reports for bulk actions
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  // Derive filters object from URL params
  const filters: ReportFilters = {
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
    page: parseInt(searchParams.get('page') || '1', 10),
    per_page: parseInt(searchParams.get('per_page') || '20', 10)
  };

  // Sync local inputs when URL changes
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setSearchFilter(searchParams.get('search') || '');
  }, [searchParams]);

  // Fetch reports list
  const fetchReports = async ({ queryKey }: { queryKey: any[] }): Promise<FetchReportsResponse> => {
    const [, filters] = queryKey as [string, ReportFilters];
    const response = await axios.get<ReportSummary[]>(
      `${API_BASE_URL}/api/admin/reports`,
      {
        params: filters,
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const total = Number(response.headers['x-total-count'] ?? 0);
    return { reports: response.data, total };
  };

  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery(['adminReports', filters], fetchReports, { keepPreviousData: true });

  const reports = data?.reports || [];
  const total = data?.total || 0;

  // Single close mutation
  const { mutate: closeReport, isLoading: isClosing } = useMutation<void, Error, string>(
    (reportId) =>
      axios.put(
        `${API_BASE_URL}/api/admin/reports/${reportId}/close`,
        { action: 'close' },
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(() => {}),
    {
      onSuccess: (_data, reportId) => {
        queryClient.invalidateQueries(['adminReports']);
        setSelectedReportIds(prev => prev.filter(id => id !== reportId));
      }
    }
  );

  // Bulk close mutation
  const { mutate: bulkClose, isLoading: isBulkClosing } = useMutation<void, Error, string[]>(
    (reportIds) =>
      Promise.all(
        reportIds.map(id =>
          axios.put(
            `${API_BASE_URL}/api/admin/reports/${id}/close`,
            { action: 'close' },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      ).then(() => {}),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['adminReports']);
        setSelectedReportIds([]);
      }
    }
  );

  // Handlers
  const handleFilterSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (searchFilter) params.search = searchFilter;
    params.page = '1';
    params.per_page = filters.per_page.toString();
    setSearchParams(params);
  };

  const toggleSelect = (uid: string) => {
    setSelectedReportIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedReportIds(reports.map(r => r.uid));
    } else {
      setSelectedReportIds([]);
    }
  };

  const handleCloseOne = (uid: string) => {
    if (window.confirm('Close this report?')) {
      closeReport(uid);
    }
  };

  const handleBulkClose = () => {
    if (selectedReportIds.length && window.confirm('Close selected reports?')) {
      bulkClose(selectedReportIds);
    }
  };

  const gotoPage = (newPage: number) => {
    const params = Object.fromEntries(searchParams.entries());
    params.page = newPage.toString();
    setSearchParams(params);
  };

  return (
    <>
      <div className="max-w-full">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <button
            onClick={handleBulkClose}
            disabled={selectedReportIds.length === 0 || isBulkClosing}
            className={`px-4 py-2 text-white rounded ${
              selectedReportIds.length === 0 || isBulkClosing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isBulkClosing ? 'Closing...' : 'Bulk Close'}
          </button>
        </div>

        <form onSubmit={handleFilterSubmit} className="flex space-x-2 mb-4">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <input
            type="text"
            placeholder="Search by ID or reporter"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="border rounded px-2 py-1 flex-1"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Filter
          </button>
        </form>

        {isLoading ? (
          <div>Loading reports...</div>
        ) : isError ? (
          <div className="text-red-600">Error: {error?.message}</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={reports.length > 0 && selectedReportIds.length === reports.length}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Report ID</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Reporter</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Target</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Reason</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map(report => (
                  <tr key={report.uid}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedReportIds.includes(report.uid)}
                        onChange={() => toggleSelect(report.uid)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800">{report.uid}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">{report.reporterName}</td>
                    <td className="px-4 py-2 text-sm text-blue-600 hover:underline">
                      {report.targetType === 'listing' ? (
                        <Link to={`/admin/listings/${report.targetUid}`}>
                          Listing: {report.targetUid}
                        </Link>
                      ) : (
                        <Link to={`/admin/users/${report.targetUid}`}>
                          User: {report.targetUid}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800">{report.reason}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">
                      {new Date(report.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800">{report.status}</td>
                    <td className="px-4 py-2 text-sm space-x-2">
                      <Link
                        to={`/admin/reports/${report.uid}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleCloseOne(report.uid)}
                        disabled={isClosing}
                        className={`text-red-600 hover:text-red-900 ${
                          isClosing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => gotoPage(filters.page - 1)}
                disabled={filters.page <= 1}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              <div>
                Page {filters.page} of {Math.ceil(total / filters.per_page) || 1}
              </div>
              <button
                onClick={() => gotoPage(filters.page + 1)}
                disabled={filters.page * filters.per_page >= total}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default UV_AdminReportsList;