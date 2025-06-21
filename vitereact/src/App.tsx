import React, { Suspense, useEffect } from 'react';
import './App.css';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useMatch,
  Outlet
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { shallow } from 'zustand/shallow';
import { useAppStore } from '@/store/main';

/* Global Views */
import GV_TopNav from '@/components/views/GV_TopNav.tsx';
import GV_SideDrawer from '@/components/views/GV_SideDrawer.tsx';
import GV_Breadcrumb from '@/components/views/GV_Breadcrumb.tsx';
import GV_ToastContainer from '@/components/views/GV_ToastContainer.tsx';
import GV_AdminSidebar from '@/components/views/GV_AdminSidebar.tsx';
import GV_AdminTopBar from '@/components/views/GV_AdminTopBar.tsx';

/* Lazy‐loaded Consumer Views */
const UV_Landing                = React.lazy(() => import('@/components/views/UV_Landing.tsx'));
const UV_SignUp                 = React.lazy(() => import('@/components/views/UV_SignUp.tsx'));
const UV_Login                  = React.lazy(() => import('@/components/views/UV_Login.tsx'));
const UV_ForgotPassword         = React.lazy(() => import('@/components/views/UV_ForgotPassword.tsx'));
const UV_ForgotPasswordNotice   = React.lazy(() => import('@/components/views/UV_ForgotPasswordNotice.tsx'));
const UV_OTPVerification        = React.lazy(() => import('@/components/views/UV_OTPVerification.tsx'));
const UV_ResetPassword          = React.lazy(() => import('@/components/views/UV_ResetPassword.tsx'));
const UV_EmailVerificationNotice= React.lazy(() => import('@/components/views/UV_EmailVerificationNotice.tsx'));
const UV_EmailVerificationResult= React.lazy(() => import('@/components/views/UV_EmailVerificationResult.tsx'));
const UV_ProfileSetup           = React.lazy(() => import('@/components/views/UV_ProfileSetup.tsx'));
const UV_HomeFeed               = React.lazy(() => import('@/components/views/UV_HomeFeed.tsx'));
const UV_CategoryBrowse         = React.lazy(() => import('@/components/views/UV_CategoryBrowse.tsx'));
const UV_SearchResults          = React.lazy(() => import('@/components/views/UV_SearchResults.tsx'));
const UV_ListingDetail          = React.lazy(() => import('@/components/views/UV_ListingDetail.tsx'));
const UV_ListingWizardStep1     = React.lazy(() => import('@/components/views/UV_ListingWizardStep1.tsx'));
const UV_ListingWizardStep2     = React.lazy(() => import('@/components/views/UV_ListingWizardStep2.tsx'));
const UV_ListingWizardStep3     = React.lazy(() => import('@/components/views/UV_ListingWizardStep3.tsx'));
const UV_ProfileListings        = React.lazy(() => import('@/components/views/UV_ProfileListings.tsx'));
const UV_ProfileDrafts          = React.lazy(() => import('@/components/views/UV_ProfileDrafts.tsx'));
const UV_ProfileFavorites       = React.lazy(() => import('@/components/views/UV_ProfileFavorites.tsx'));
const UV_ProfileOffers          = React.lazy(() => import('@/components/views/UV_ProfileOffers.tsx'));
const UV_TransactionsList       = React.lazy(() => import('@/components/views/UV_TransactionsList.tsx'));
const UV_MessagesList           = React.lazy(() => import('@/components/views/UV_MessagesList.tsx'));
const UV_MessageThread          = React.lazy(() => import('@/components/views/UV_MessageThread.tsx'));
const UV_AccountSettings        = React.lazy(() => import('@/components/views/UV_AccountSettings.tsx'));
const UV_NotificationsPage      = React.lazy(() => import('@/components/views/UV_NotificationsPage.tsx'));

/* Lazy‐loaded Admin Views */
const UV_AdminLogin             = React.lazy(() => import('@/components/views/UV_AdminLogin.tsx'));
const UV_AdminDashboardHome     = React.lazy(() => import('@/components/views/UV_AdminDashboardHome.tsx'));
const UV_AdminUsersList         = React.lazy(() => import('@/components/views/UV_AdminUsersList.tsx'));
const UV_AdminUserDetail        = React.lazy(() => import('@/components/views/UV_AdminUserDetail.tsx'));
const UV_AdminListingsList      = React.lazy(() => import('@/components/views/UV_AdminListingsList.tsx'));
const UV_AdminListingDetail     = React.lazy(() => import('@/components/views/UV_AdminListingDetail.tsx'));
const UV_AdminReportsList       = React.lazy(() => import('@/components/views/UV_AdminReportsList.tsx'));
const UV_AdminReportDetail      = React.lazy(() => import('@/components/views/UV_AdminReportDetail.tsx'));
const UV_AdminCategoriesList    = React.lazy(() => import('@/components/views/UV_AdminCategoriesList.tsx'));
const UV_AdminSettings          = React.lazy(() => import('@/components/views/UV_AdminSettings.tsx'));

const queryClient = new QueryClient();

/* Error Boundary Fallback */
function ErrorFallback({
  error,
  resetErrorBoundary
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div role="alert" className="p-4 bg-red-100 text-red-800">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
}

/* Scroll to top on route change */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

/* Centralized auth + role guard */
interface PrivateRouteProps {
  children: JSX.Element;
  requiredRole?: 'admin' | 'buyer' | 'seller';
}
const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  requiredRole
}) => {
  const [isAuthenticated, userRole] = useAppStore(
    (state) => [state.auth.is_authenticated, state.auth.user?.role],
    shallow
  );
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return children;
};

/* Admin Layout */
const AdminLayout: React.FC = () => (
  <div className="flex min-h-screen">
    <GV_AdminSidebar />
    <div className="flex-1 flex flex-col">
      <GV_AdminTopBar />
      <main className="flex-1 p-4 pt-16">
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  </div>
);

/* Consumer Layout */
const ConsumerLayout: React.FC = () => {
  const showBreadcrumb =
    useMatch('/categories/:categoryId') ||
    useMatch('/search') ||
    useMatch('/listings/:listingId');

  return (
    <>
      <GV_TopNav />
      <GV_SideDrawer />
      {showBreadcrumb && <GV_Breadcrumb />}
      <main className="pt-16">
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ScrollToTop />
        <Routes>
          {/* Admin Routes */}
          <Route path="admin">
            <Route
              path="login"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <UV_AdminLogin />
                </Suspense>
              }
            />
            <Route
              element={
                <PrivateRoute requiredRole="admin">
                  <AdminLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<UV_AdminDashboardHome />} />
              <Route path="users" element={<UV_AdminUsersList />} />
              <Route path="users/:userId" element={<UV_AdminUserDetail />} />
              <Route path="listings" element={<UV_AdminListingsList />} />
              <Route
                path="listings/:listingId"
                element={<UV_AdminListingDetail />}
              />
              <Route path="reports" element={<UV_AdminReportsList />} />
              <Route
                path="reports/:reportId"
                element={<UV_AdminReportDetail />}
              />
              <Route
                path="categories"
                element={<UV_AdminCategoriesList />}
              />
              <Route path="settings" element={<UV_AdminSettings />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>

          {/* Consumer Routes */}
          <Route element={<ConsumerLayout />}>
            <Route
              index
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <UV_Landing />
                </Suspense>
              }
            />
            <Route
              path="signup"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <UV_SignUp />
                </Suspense>
              }
            />
            <Route
              path="login"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <UV_Login />
                </Suspense>
              }
            />
            <Route path="forgot-password" element={<UV_ForgotPassword />} />
            <Route
              path="forgot-password/sent"
              element={<UV_ForgotPasswordNotice />}
            />
            <Route path="verify-otp" element={<UV_OTPVerification />} />
            <Route path="reset-password" element={<UV_ResetPassword />} />
            <Route
              path="verify-email/sent"
              element={<UV_EmailVerificationNotice />}
            />
            <Route
              path="verify-email"
              element={<UV_EmailVerificationResult />}
            />
            <Route
              path="profile/setup"
              element={
                <PrivateRoute>
                  <UV_ProfileSetup />
                </PrivateRoute>
              }
            />
            <Route
              path="home"
              element={
                <PrivateRoute>
                  <UV_HomeFeed />
                </PrivateRoute>
              }
            />
            <Route
              path="categories/:categoryId"
              element={<UV_CategoryBrowse />}
            />
            <Route path="search" element={<UV_SearchResults />} />
            <Route
              path="listings/:listingId"
              element={<UV_ListingDetail />}
            />
            <Route
              path="listings/new/step1"
              element={
                <PrivateRoute>
                  <UV_ListingWizardStep1 />
                </PrivateRoute>
              }
            />
            <Route
              path="listings/new/step2"
              element={
                <PrivateRoute>
                  <UV_ListingWizardStep2 />
                </PrivateRoute>
              }
            />
            <Route
              path="listings/new/step3"
              element={
                <PrivateRoute>
                  <UV_ListingWizardStep3 />
                </PrivateRoute>
              }
            />
            <Route
              path="listings/:listingId/edit/step1"
              element={
                <PrivateRoute>
                  <UV_ListingWizardStep1 />
                </PrivateRoute>
              }
            />
            <Route
              path="profile/me/listings"
              element={
                <PrivateRoute>
                  <UV_ProfileListings />
                </PrivateRoute>
              }
            />
            <Route
              path="profile/me/drafts"
              element={
                <PrivateRoute>
                  <UV_ProfileDrafts />
                </PrivateRoute>
              }
            />
            <Route
              path="profile/me/favorites"
              element={
                <PrivateRoute>
                  <UV_ProfileFavorites />
                </PrivateRoute>
              }
            />
            <Route
              path="profile/me/offers"
              element={
                <PrivateRoute>
                  <UV_ProfileOffers />
                </PrivateRoute>
              }
            />
            <Route
              path="profile/me/transactions"
              element={
                <PrivateRoute>
                  <UV_TransactionsList />
                </PrivateRoute>
              }
            />
            <Route
              path="messages"
              element={
                <PrivateRoute>
                  <UV_MessagesList />
                </PrivateRoute>
              }
            />
            <Route
              path="messages/:threadId"
              element={
                <PrivateRoute>
                  <UV_MessageThread />
                </PrivateRoute>
              }
            />
            <Route
              path="profile/me/settings"
              element={
                <PrivateRoute>
                  <UV_AccountSettings />
                </PrivateRoute>
              }
            />
            <Route
              path="notifications"
              element={
                <PrivateRoute>
                  <UV_NotificationsPage />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>

        {/* Single, global toast container */}
        <GV_ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;