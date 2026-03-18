
const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5005/api`;

let token: string | null = localStorage.getItem('portal_token');

export const setApiToken = (newToken: string | null) => {
    token = newToken;
    if (newToken) {
        localStorage.setItem('portal_token', newToken);
    } else {
        localStorage.removeItem('portal_token');
    }
};

export const getApiToken = () => token;

const getCsrfToken = () => {
    const name = "XSRF-TOKEN=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
};

const getHeaders = (options?: RequestInit) => {
    const headers: any = {
        ...(options?.headers || {}),
    };

    if (options?.body instanceof FormData) {
        delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const csrfToken = getCsrfToken();
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    return headers;
};

export const request = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const headers = getHeaders(options);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || errorData.error || `API Error: ${response.status}`;
        throw new Error(errorMessage);
    }

    return response.json();
};

export const downloadFile = async (endpoint: string, filename: string) => {
    const headers = getHeaders();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
        credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to download file: ' + response.statusText);

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

export const apiRequest = request;
