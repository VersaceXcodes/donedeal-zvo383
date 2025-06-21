import React, { useMemo } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { useAppStore, CategoryTree } from '@/store/main';

interface BreadcrumbItem {
  title: string;
  path: string;
}

/** 
 * Recursively find a path from the root categories to the category with uid === targetUid.
 * Returns an array of CategoryTree nodes from root down to the target, or null if not found.
 */
function findCategoryPath(
  categories: CategoryTree[],
  targetUid: string
): CategoryTree[] | null {
  for (const cat of categories) {
    if (cat.uid === targetUid) {
      return [cat];
    }
    if (cat.children && cat.children.length > 0) {
      const childPath = findCategoryPath(cat.children, targetUid);
      if (childPath) {
        return [cat, ...childPath];
      }
    }
  }
  return null;
}

const GV_Breadcrumb: React.FC = () => {
  const categories = useAppStore(state => state.nav.categories);
  const isAuthenticated = useAppStore(state => state.auth.is_authenticated);
  const location = useLocation();

  // Match the three routes where breadcrumb is shown:
  const matchCategory = useMatch({ path: '/categories/:categoryId', end: true });
  const matchSearch = useMatch({ path: '/search', end: true });
  const matchListing = useMatch({ path: '/listings/:listingId', end: true });

  const homePath = isAuthenticated ? '/home' : '/';

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const crumbs: BreadcrumbItem[] = [];
    // Home always first
    crumbs.push({ title: 'Home', path: homePath });

    if (matchCategory) {
      const { categoryId } = matchCategory.params;
      if (categoryId) {
        const pathNodes = findCategoryPath(categories, categoryId);
        if (pathNodes) {
          pathNodes.forEach(node => {
            crumbs.push({
              title: node.name,
              path: `/categories/${node.uid}`
            });
          });
        } else {
          // fallback to showing raw id
          crumbs.push({
            title: categoryId,
            path: `/categories/${categoryId}`
          });
        }
      }
    } else if (matchSearch) {
      crumbs.push({
        title: 'Search Results',
        path: `${location.pathname}${location.search}`
      });
    } else if (matchListing) {
      crumbs.push({
        title: 'Listing Details',
        path: location.pathname
      });
    }
    return crumbs;
  }, [
    categories,
    homePath,
    location.pathname,
    location.search,
    matchCategory,
    matchSearch,
    matchListing
  ]);

  return (
    <>
      <nav
        className="bg-white px-4 py-2 border-b border-gray-200"
        aria-label="Breadcrumb"
      >
        <div className="text-sm text-gray-600">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="inline-flex items-center">
              {idx > 0 && <span className="mx-2">/</span>}
              {idx < breadcrumbs.length - 1 ? (
                <Link
                  to={crumb.path}
                  className="hover:underline text-blue-600"
                >
                  {crumb.title}
                </Link>
              ) : (
                <span className="font-semibold text-gray-900">
                  {crumb.title}
                </span>
              )}
            </span>
          ))}
        </div>
      </nav>
    </>
  );
};

export default GV_Breadcrumb;