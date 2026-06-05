import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 15000,
});

const RETRYABLE_METHODS = new Set(['get', 'head', 'options', 'put']);
const MAX_RETRIES = 2;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export default api;
