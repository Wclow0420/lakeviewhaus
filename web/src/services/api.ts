const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

/**
 * Standard fetch wrapper to handle base URL and JSON parsing.
 */
export const api = {
    get: async (endpoint: string) => {
        const response = await fetch(`${API_URL}${endpoint}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Error ${response.status}`);
        }
        return response.json();
    },

    post: async (endpoint: string, data: any) => {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Error ${response.status}`);
        }
        return response.json();
    }
};

export default api;
