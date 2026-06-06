import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 15000,
});

const RETRYABLE_METHODS = new Set(['get', 'head', 'options', 'put']);
const MAX_RETRIES = 2;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const stringifyErrorValue = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value.message === 'string') return value.message;
    if (value.message) return stringifyErrorValue(value.message);
    if (typeof value.error === 'string') return value.error;
    if (value.error) return stringifyErrorValue(value.error);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export const getApiErrorMessage = (error: any, fallback = '请重试'): string => {
    const message = stringifyErrorValue(
        error?.response?.data?.error ??
        error?.response?.data?.message ??
        error?.response?.data ??
        error?.message ??
        error
    );
    return message || fallback;
};

// Interceptor to add auth token
api.interceptors.request.use(async (config) => {
    const session = supabase.auth.session();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

api.interceptors.response.use(
    response => response,
    async (error) => {
        const config = error.config || {};
        const method = String(config.method || 'get').toLowerCase();
        const status = error.response?.status;
        const errorCode = error.response?.data?.code || error.code;
        const shouldRetry =
            RETRYABLE_METHODS.has(method) &&
            (status >= 500 || !error.response || errorCode === 'ECONNABORTED' || errorCode === 'ECONNRESET');

        config.__retryCount = config.__retryCount || 0;
        if (shouldRetry && config.__retryCount < MAX_RETRIES) {
            config.__retryCount += 1;
            await wait(400 * config.__retryCount);
            return api(config);
        }

        return Promise.reject(error);
    }
);

export const vitalService = {
    getAll: async () => {
        const response = await api.get('/vitals');
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/vitals', data);
        return response.data;
    },
    deleteMany: async (ids: string[]) => {
        const response = await api.delete('/vitals', { data: { ids } });
        return response.data;
    },
};

export const symptomService = {
    getAll: async () => {
        const response = await api.get('/symptoms');
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/symptoms', data);
        return response.data;
    },
    deleteMany: async (ids: string[]) => {
        const response = await api.delete('/symptoms', { data: { ids } });
        return response.data;
    },
};

export const glucoseService = {
    getAll: async () => {
        const response = await api.get('/glucose');
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/glucose', data);
        return response.data;
    },
    deleteMany: async (ids: string[]) => {
        const response = await api.delete('/glucose', { data: { ids } });
        return response.data;
    },
};

export const profileService = {
    get: async () => {
        const response = await api.get('/auth/profile');
        return response.data;
    },
    update: async (data: any) => {
        const response = await api.put('/auth/profile', data);
        return response.data;
    },
};

export const notificationService = {
    getVapidPublicKey: async () => {
        const response = await api.get('/notifications/vapid-public-key');
        return response.data.publicKey as string;
    },
    subscribe: async (subscription: PushSubscription) => {
        const response = await api.post('/notifications/subscribe', { subscription });
        return response.data;
    },
    unsubscribe: async (endpoint: string) => {
        const response = await api.post('/notifications/unsubscribe', { endpoint });
        return response.data;
    },
};

export default api;
