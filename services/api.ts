import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 1. Get the Environment (passed via app.config.ts -> extra)
const environment = Constants.expoConfig?.extra?.APP_ENV || 'development';

// 2. Get the API URL from .env (EXPO_PUBLIC_API_URL)
//    If not set, fallback to production or specific local logic
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

// Optional: Keep hardcoded fallbacks just in case .env is missing
const BACKUP_PROD_URL = 'https://lakeviewhaus.onrender.com';
const BACKUP_LOCAL_URL = Platform.select({
    ios: 'http://172.20.10.2:5002',
    android: 'http://172.20.10.2:5002',
    default: 'http://127.0.0.1:5002',
});

// Calculate final URL
export const API_URL = ENV_API_URL || (__DEV__ ? BACKUP_LOCAL_URL : BACKUP_PROD_URL);

console.log(`[API] 🌍 Environment: ${environment}`);
console.log(`[API] 🔗 Base URL: ${API_URL}`);

const getHeaders = async (tokenOverride?: string) => {
    const token = tokenOverride || await SecureStore.getItemAsync('access_token');
    console.log('[API] Getting headers, token present:', !!token);
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const refreshAccessToken = async (): Promise<string | null> => {
    try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) return null;

        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${refreshToken}`
            }
        });

        if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                await SecureStore.setItemAsync('access_token', data.access_token);
                return data.access_token;
            } else {
                const text = await res.text();
                console.error("Token refresh returned non-JSON response:", text.substring(0, 200));
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error("Token refresh failed", error);
        return null;
    }
};

const request = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: any) => {
    let headers = await getHeaders();

    const isFormData = body instanceof FormData;
    if (isFormData) {
        // @ts-ignore
        delete headers['Content-Type'];
    }

    let config: RequestInit = {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
    };

    let res = await fetch(`${API_URL}${endpoint}`, config);

    if (res.status === 401) {
        console.log("401 detected, attempting to refresh token...");
        const newToken = await refreshAccessToken();

        if (newToken) {
            console.log("Token refreshed successfully, retrying request...");
            headers = await getHeaders(newToken);
            config.headers = headers;
            res = await fetch(`${API_URL}${endpoint}`, config);
        } else {
            console.log("Refresh failed or no refresh token. Logging out...");
            // Clear tokens to force logout on next app check or via interceptor
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('refresh_token');
            await SecureStore.deleteItemAsync('user_data');
            // We can't easily access AuthContext's logout here, but clearing storage is a start.
            throw { status: 401, error: "Session expired" };
        }
    }

    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`[API] Non-JSON response from ${endpoint}:`, text.substring(0, 200));
        console.error(`[API] Status: ${res.status}, Content-Type: ${contentType}`);
        throw {
            status: res.status,
            error: `Server returned non-JSON response (${res.status})`,
            details: text.substring(0, 500)
        };
    }

    const data = await res.json();
    if (!res.ok) {
        throw { status: res.status, ...data };
    }
    return data;
};

export const api = {
    API_URL: API_URL,
    get: async (endpoint: string) => {
        return request('GET', endpoint);
    },

    post: async (endpoint: string, body: any) => {
        return request('POST', endpoint, body);
    },

    put: async (endpoint: string, body: any) => {
        return request('PUT', endpoint, body);
    },

    delete: async (endpoint: string) => {
        // @ts-ignore
        // We need to implement DELETE in request function if not supported? 
        // request signature is (method: 'GET' | 'POST' | 'PUT', ...)
        // I need to update request signature too? 
        return request('DELETE' as any, endpoint);
    },

    // Branch / Merchant
    merchant: {
        getBranches: () => api.get('/merchant/branches'),
        createBranch: (data: any) => api.post('/merchant/branches', data),
        updateBranch: (id: number, data: any) => api.put(`/merchant/branches/${id}`, data),
        deleteBranch: (id: number) => api.delete(`/merchant/branches/${id}`),
        updateBranchStatus: (id: number, isActive: boolean) => api.put(`/merchant/branches/${id}/status`, { is_active: isActive }),
        getStats: (branchId?: number | string) => api.get(`/merchant/stats${branchId ? `?branch_id=${branchId}` : ''}`),
        getStatDetails: (type: 'redemptions' | 'points', period?: string, branchId?: number | string) => api.get(`/merchant/stats/details?type=${type}&period=${period || 'all'}${branchId ? `&branch_id=${branchId}` : ''}`),
        // Settings
        updateProfile: (data: any) => api.put('/merchant/profile', data),
        updatePassword: (data: any) => api.put('/merchant/password', data),

        awardPoints: (qrToken: string, amount: number) => api.post('/transaction/award', { qr_token: qrToken, amount }),

        // Lucky Draws (Merchant)
        luckyDraws: {
            getAll: () => api.get('/merchant/lucky-draws'),
            create: (data: any) => api.post('/merchant/lucky-draws', data),
            get: (id: string | number) => api.get(`/merchant/lucky-draws/${id}`),
            update: (id: string | number, data: any) => api.put(`/merchant/lucky-draws/${id}`, data),
            delete: (id: string | number) => api.delete(`/merchant/lucky-draws/${id}`),
            addPrize: (drawId: string | number, data: any) => api.post(`/merchant/lucky-draws/${drawId}/prizes`, data),
            updatePrize: (drawId: string | number, prizeId: string | number, data: any) => api.put(`/merchant/lucky-draws/${drawId}/prizes/${prizeId}`, data),
            deletePrize: (drawId: string | number, prizeId: string | number) => api.delete(`/merchant/lucky-draws/${drawId}/prizes/${prizeId}`),
            getStats: (id: string | number) => api.get(`/merchant/lucky-draws/${id}/statistics`),
        }
    },

    // Menu Management
    menu: {
        getCategories: (branchId?: number) => api.get(`/menu/categories${branchId ? `?target_branch_id=${branchId}` : ''}`),
        createCategory: (data: any) => api.post('/menu/categories', data),
        updateCategory: (id: number, data: any) => api.put(`/menu/categories/${id}`, data),
        deleteCategory: (id: number) => api.delete(`/menu/categories/${id}`),

        getProducts: (branchId?: number) => api.get(`/menu/products${branchId ? `?target_branch_id=${branchId}` : ''}`),
        createProduct: (data: any) => api.post('/menu/products', data),
        updateProduct: (id: number, data: any) => api.put(`/menu/products/${id}`, data),

        getOptionGroups: (branchId?: number) => api.get(`/menu/option-groups${branchId ? `?target_branch_id=${branchId}` : ''}`),

        getCollections: (branchId?: number) => api.get(`/menu/collections${branchId ? `?target_branch_id=${branchId}` : ''}`),
        createCollection: (data: any) => api.post('/menu/collections', data),
        updateCollection: (id: number, data: any) => api.put(`/menu/collections/${id}`, data),
    },

    // Rewards Management
    rewards: {
        // Merchant management (is_main only)
        getRewards: (filters?: { category?: string; branch_id?: string; active_only?: boolean }) => {
            const params = new URLSearchParams();
            if (filters?.category) params.append('category', filters.category);
            if (filters?.branch_id) params.append('branch_id', filters.branch_id);
            if (filters?.active_only) params.append('active_only', 'true');
            return api.get(`/rewards${params.toString() ? `?${params.toString()}` : ''}`);
        },
        createReward: (data: any) => api.post('/rewards', data),
        getReward: (id: string | number) => api.get(`/rewards/${id}`),
        updateReward: (id: string | number, data: any) => api.put(`/rewards/${id}`, data),
        deleteReward: (id: string | number) => api.delete(`/rewards/${id}`),
        getCategories: () => api.get('/rewards/categories'),

        // Customer availability
        getAvailableRewards: (params?: { category?: string; page?: number; per_page?: number }) => {
            const searchParams = new URLSearchParams();
            if (params?.category) searchParams.append('category', params.category);
            if (params?.page) searchParams.append('page', params.page.toString());
            if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
            return api.get(`/rewards/available${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
        },

        // Customer redemption
        redeemReward: (id: string | number) => api.post(`/rewards/${id}/redeem`, {}),
        getMyRewards: (status?: string) => api.get(`/rewards/my-rewards${status ? `?status=${status}` : ''}`),

        // Merchant validation
        previewRedemption: (code: string) => api.post('/rewards/preview', { redemption_code: code }),
        validateRedemption: (code: string) => api.post('/rewards/validate', { redemption_code: code }),
        getRedemptions: (filters?: { branch_id?: string; status?: string }) => {
            const params = new URLSearchParams();
            if (filters?.branch_id) params.append('branch_id', filters.branch_id);
            if (filters?.status) params.append('status', filters.status);
            return api.get(`/rewards/redemptions${params.toString() ? `?${params.toString()}` : ''}`);
        },
    },

    // Marketing (Display)
    marketing: {
        getBanners: () => api.get('/marketing/banners'),
        createBanner: (data: any) => api.post('/marketing/banners', data),
        deleteBanner: (id: number) => api.delete(`/marketing/banners/${id}`),

        getTopPicks: () => api.get('/marketing/top-picks'),
        addTopPick: (data: any) => api.post('/marketing/top-picks', data),
        removeTopPick: (id: number) => api.delete(`/marketing/top-picks/${id}`),
        reorderBanners: (ids: number[]) => api.post('/marketing/banners/reorder', { ids }),
        reorderTopPicks: (ids: number[]) => api.post('/marketing/top-picks/reorder', { ids }),
    },

    // Gamification
    getCheckInStatus: async () => {
        return api.get('/gamification/status');
    },
    performCheckIn: async () => {
        return api.post('/gamification/check-in', {});
    },

    // QR Code
    generateQRToken: async () => {
        return api.post('/auth/generate-qr-token', {});
    },
    submitReferral: async (code: string) => {
        return api.post('/auth/referral', { referral_code: code });
    },
    validateQR: async (qrToken: string) => {
        return api.post('/transaction/validate-qr', { qr_token: qrToken });
    },

    transactions: {
        getHistory: () => api.get('/transaction/history'),
    },

    // Authenticated User
    user: {
        updateProfile: (data: { username?: string; profile_pic_url?: string }) => api.post('/auth/profile', data),
    },

    // User Lucky Draw (Customer)
    userLuckyDraw: {
        getAvailableDraws: () => api.get('/lucky-draws'),
        getDrawDetails: (id: string | number) => api.get(`/lucky-draws/${id}`),
        spin: (id: string | number, spinType: 'points_redemption' | 'day7_checkin' = 'points_redemption') =>
            api.post(`/lucky-draws/${id}/spin`, { spin_type: spinType }),
        getHistory: (page = 1, limit = 20) => api.get(`/lucky-draws/history?page=${page}&per_page=${limit}`),
        getDay7Draw: () => api.get('/lucky-draws/day7-draw'),
    },

    // Customer / Public
    customer: {
        getBranches: () => api.get('/customer/branches'),
        getCategories: (branchId: number) => api.get(`/customer/menu/categories?branch_id=${branchId}`),
        getProducts: (branchId: number, categoryId?: number) => api.get(`/customer/menu/products?branch_id=${branchId}${categoryId ? `&category_id=${categoryId}` : ''}`),
        getBanners: () => api.get('/customer/marketing/banners'),
        getTopPicks: () => api.get('/customer/marketing/top-picks'),
    }
};
