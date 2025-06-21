import React from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

interface Reporter {
  uid: string;
  display_name: string;
  profile_pic_url?: string;
}

interface ReportDetail {
  uid: string;
  reporter: Reporter;
  targetType: "listing" | "user";
  targetUid: string;
  reason: string;
  details?: string;
  status: "open" | "closed";
  created_at: string;
  closed_at?: string;
  closed_by_uid?: string;
}

interface ListingPreview {
  uid: string;
  title: string;
  thumbnailUrl: string;
  price: number;
  status: string;
}

interface UserPreview {
  uid: string;
  display_name: string;
  profile_pic_url?: string;
}

type TargetContent = ListingPreview | UserPreview;

const UV_AdminReportDetail: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const addToast = useAppStore((state) => state.add_toast);
  const queryClient = useQueryClient();

  // Fetch report detail
  const {
    data: report,
    isLoading: isReportLoading,
    error: reportError,
  } = useQuery<ReportDetail, Error>(
    ["report", reportId],
    async () => {
      const { data } = await axios.get<ReportDetail>(
        `${API_BASE_URL}/api/reports/${reportId}`
      );
      return data;
    },
    { enabled: !!reportId }
  );

  // Fetch target content preview
  const {
    data: targetContent,
    isLoading: isTargetLoading,
    error: targetError,
  } = useQuery<TargetContent, Error>(
    ["targetContent", reportId],
    async () => {
      if (!report) throw new Error("No report data");
      if (report.targetType === "listing") {
        const { data } = await axios.get<ListingPreview>(
          `${API_BASE_URL}/api/admin/listings/${report.targetUid}`
        );
        return data;
      } else {
        const { data } = await axios.get<UserPreview>(
          `${API_BASE_URL}/api/admin/users/${report.targetUid}`
        );
        return data;
      }
    },
    { enabled: !!report }
  );

  // Mutation to close report with various actions
  const mutation = useMutation<
    void,
    Error,
    { action: string }
  >(
    async ({ action }) => {
      await axios.put(
        `${API_BASE_URL}/api/reports/${reportId}/close`,
        { action }
      );
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(["report", reportId]);
        addToast({
          id: Math.random().toString(36).substr(2, 9),
          type: "success",
          message: `Action "${variables.action}" executed`,
        });
      },
      onError: (err) => {
        addToast({
          id: Math.random().toString(36).substr(2, 9),
          type: "error",
          message: err.message,
        });
      },
    }
  );

  const isLoading = isReportLoading || isTargetLoading;
  const errorMessage = reportError?.message || targetError?.message || null;
  const isClosed = report?.status === "closed";

  const handleAction = (action: string) => {
    mutation.mutate({ action });
  };

  return (
    <>
      {isLoading && (
        <div className="p-4 text-center text-gray-600">Loading...</div>
      )}
      {errorMessage && (
        <div className="p-4 text-center text-red-600">
          Error: {errorMessage}
        </div>
      )}
      {!isLoading && !errorMessage && report && (
        <div className="max-w-4xl mx-auto p-6 space-y-6 bg-white rounded shadow">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Report #{report.uid}</h1>
            <Link
              to="/admin/reports"
              className="text-blue-600 hover:underline"
            >
              &larr; Back
            </Link>
          </div>

          <section className="space-y-2">
            <h2 className="text-xl font-medium">Reporter</h2>
            <div className="flex items-center space-x-4">
              {report.reporter.profile_pic_url ? (
                <img
                  src={report.reporter.profile_pic_url}
                  alt={report.reporter.display_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200" />
              )}
              <div>
                <p className="font-medium">
                  {report.reporter.display_name}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(report.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-1">
            <h2 className="text-xl font-medium">Reason</h2>
            <p className="text-gray-700">{report.reason}</p>
            {report.details && (
              <p className="text-gray-600 italic">"{report.details}"</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-medium">Reported Content</h2>
            {report.targetType === "listing" &&
              (targetContent as ListingPreview) && (
                <div className="flex items-center space-x-4 p-4 border rounded">
                  <img
                    src={(targetContent as ListingPreview).thumbnailUrl}
                    alt={(targetContent as ListingPreview).title}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div>
                    <p className="font-medium">
                      {(targetContent as ListingPreview).title}
                    </p>
                    <p className="text-gray-600">
                      Price: $
                      {(targetContent as ListingPreview).price.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Status: {(targetContent as ListingPreview).status}
                    </p>
                  </div>
                </div>
              )}
            {report.targetType === "user" &&
              (targetContent as UserPreview) && (
                <div className="flex items-center space-x-4 p-4 border rounded">
                  {(
                    targetContent as UserPreview
                  ).profile_pic_url ? (
                    <img
                      src={(targetContent as UserPreview).profile_pic_url}
                      alt={(targetContent as UserPreview).display_name}
                      className="w-20 h-20 object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 rounded-full" />
                  )}
                  <p className="font-medium">
                    {(targetContent as UserPreview).display_name}
                  </p>
                </div>
              )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-medium">Status</h2>
            <p className="text-gray-700 capitalize">{report.status}</p>
            {report.status === "closed" && report.closed_at && (
              <p className="text-sm text-gray-500">
                Closed at{" "}
                {new Date(report.closed_at).toLocaleString()} by{" "}
                {report.closed_by_uid}
              </p>
            )}
          </section>

          <section className="space-x-4">
            {!isClosed ? (
              <>
                <button
                  onClick={() => handleAction("warn")}
                  disabled={mutation.isLoading}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                >
                  Warn User
                </button>
                <button
                  onClick={() =>
                    handleAction(
                      report.targetType === "listing"
                        ? "delete_listing"
                        : "delete_user"
                    )
                  }
                  disabled={mutation.isLoading}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  Remove Content
                </button>
                <button
                  onClick={() => handleAction("ban_user")}
                  disabled={mutation.isLoading}
                  className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                >
                  Ban User
                </button>
                <button
                  onClick={() => handleAction("close")}
                  disabled={mutation.isLoading}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  Close Report
                </button>
              </>
            ) : (
              <p className="text-gray-600">This report is closed.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export default UV_AdminReportDetail;