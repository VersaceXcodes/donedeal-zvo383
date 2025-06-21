import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface User {
  uid: string;
  email?: string;
  phone?: string;
  display_name: string;
  profile_pic_url?: string;
  role: 'buyer' | 'seller' | 'admin';
  notification_settings: {
    new_message_email: boolean;
    offer_email: boolean;
    favorite_email: boolean;
  };
  is_email_verified: boolean;
  is_phone_verified: boolean;
}

export interface CategoryTree {
  uid: string;
  name: string;
  children: CategoryTree[];
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ListingDraftData {
  uid?: string;
  title?: string;
  description?: string;
  category_uid?: string;
  condition?: 'new' | 'like_new' | 'good' | 'acceptable';
  price?: number;
  currency?: string;
  negotiable?: boolean;
  location?: string;
  location_lat?: number;
  location_lng?: number;
  listing_duration?: number;
  tags?: string[];
  images?: { uid: string; url: string; sort_order: number }[];
  status?: 'draft' | 'pending' | 'active' | 'sold' | 'expired' | 'archived';
}

export interface AdminMetrics {
  total_users: number;
  new_users_7d: number;
  active_listings: number;
  new_listings_7d: number;
  pending_reports: number;
  open_reports: number;
}

export interface SiteSettings {
  maintenance_mode: { enabled: boolean };
  max_listing_duration: { days: number };
}

export interface AppState {
  auth: {
    is_authenticated: boolean;
    token: string | null;
    user: User | null;
  };
  nav: {
    categories: CategoryTree[];
    unread_messages_count: number;
    unread_notifications_count: number;
    is_side_drawer_open: boolean;
  };
  ui: {
    toasts: Toast[];
  };
  drafts: Record<string, ListingDraftData>;
  admin: {
    metrics: AdminMetrics;
  };
  site_settings: SiteSettings;
  socket: Socket | null;

  // auth actions
  set_auth: (payload: { is_authenticated: boolean; token: string | null; user: User | null }) => void;
  login: (token: string, user: User) => void;
  logout: () => void;

  // nav actions
  set_nav_categories: (categories: CategoryTree[]) => void;
  set_unread_messages_count: (count: number) => void;
  set_unread_notifications_count: (count: number) => void;
  toggle_side_drawer: (open: boolean) => void;

  // ui actions
  add_toast: (toast: Toast) => void;
  remove_toast: (id: string) => void;
  clear_toasts: () => void;

  // drafts actions
  set_draft: (uid: string, draft: ListingDraftData) => void;
  remove_draft: (uid: string) => void;
  clear_drafts: () => void;

  // admin actions
  set_admin_metrics: (metrics: AdminMetrics) => void;

  // site_settings actions
  set_maintenance_mode: (enabled: boolean) => void;
  set_max_listing_duration: (days: number) => void;

  // realtime/socket actions
  init_socket: () => void;
  close_socket: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // initial state
      auth: { is_authenticated: false, token: null, user: null },
      nav: {
        categories: [],
        unread_messages_count: 0,
        unread_notifications_count: 0,
        is_side_drawer_open: false
      },
      ui: { toasts: [] },
      drafts: {},
      admin: {
        metrics: {
          total_users: 0,
          new_users_7d: 0,
          active_listings: 0,
          new_listings_7d: 0,
          pending_reports: 0,
          open_reports: 0
        }
      },
      site_settings: {
        maintenance_mode: { enabled: false },
        max_listing_duration: { days: 30 }
      },
      socket: null,

      // auth actions
      set_auth: (payload) => set({ auth: payload }),
      login: (token, user) => {
        set({ auth: { is_authenticated: true, token, user } });
        get().init_socket();
      },
      logout: () => {
        const sock = get().socket;
        if (sock) sock.disconnect();
        set({
          auth: { is_authenticated: false, token: null, user: null },
          nav: {
            ...get().nav,
            unread_messages_count: 0,
            unread_notifications_count: 0
          },
          socket: null
        });
      },

      // nav actions
      set_nav_categories: (categories) => set({ nav: { ...get().nav, categories } }),
      set_unread_messages_count: (count) =>
        set({ nav: { ...get().nav, unread_messages_count: count } }),
      set_unread_notifications_count: (count) =>
        set({ nav: { ...get().nav, unread_notifications_count: count } }),
      toggle_side_drawer: (open) =>
        set({ nav: { ...get().nav, is_side_drawer_open: open } }),

      // ui actions
      add_toast: (toast) =>
        set((state) => ({ ui: { toasts: [...state.ui.toasts, toast] } })),
      remove_toast: (id) =>
        set((state) => ({ ui: { toasts: state.ui.toasts.filter((t) => t.id !== id) } })),
      clear_toasts: () => set({ ui: { toasts: [] } }),

      // drafts actions
      set_draft: (uid, draft) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [uid]: { ...state.drafts[uid], ...draft }
          }
        })),
      remove_draft: (uid) =>
        set((state) => {
          const d = { ...state.drafts };
          delete d[uid];
          return { drafts: d };
        }),
      clear_drafts: () => set({ drafts: {} }),

      // admin actions
      set_admin_metrics: (metrics) => set({ admin: { metrics } }),

      // site_settings actions
      set_maintenance_mode: (enabled) =>
        set((state) => ({
          site_settings: {
            ...state.site_settings,
            maintenance_mode: { enabled }
          }
        })),
      set_max_listing_duration: (days) =>
        set((state) => ({
          site_settings: {
            ...state.site_settings,
            max_listing_duration: { days }
          }
        })),

      // socket actions
      init_socket: () => {
        const { socket, auth } = get();
        if (socket || !auth.is_authenticated || !auth.token) return;
        const sock: Socket = io(API_BASE_URL, {
          auth: { token: auth.token },
          transports: ['websocket']
        });
        sock.on('message:new', () => {
          set((s) => ({
            nav: {
              ...s.nav,
              unread_messages_count: s.nav.unread_messages_count + 1
            }
          }));
        });
        sock.on('notification:new', () => {
          set((s) => ({
            nav: {
              ...s.nav,
              unread_notifications_count: s.nav.unread_notifications_count + 1
            }
          }));
        });
        set({ socket: sock });
      },
      close_socket: () => {
        const sock = get().socket;
        if (sock) sock.disconnect();
        set({ socket: null });
      }
    }),
    {
      name: 'app_store',
      getStorage: () => localStorage,
      partialize: (state) => ({
        auth: state.auth,
        nav: state.nav,
        ui: state.ui,
        drafts: state.drafts,
        admin: state.admin,
        site_settings: state.site_settings
      })
    }
  )
);