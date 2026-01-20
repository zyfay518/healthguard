import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Interceptor to add auth token
api.interceptors.request.use(async (config) => {
    const session = supabase.auth.session();
    console.log('Session:', session); // Debug log
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        console.log('Added auth header'); // Debug log
    } else {
        console.warn('No session or access_token found');
    }
    return config;
});
// Response interceptor to debug errors
api.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error Details:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers
        });
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
