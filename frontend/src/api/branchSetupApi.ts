const PORTAL_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5005';

interface ValidateResponse {
    success: boolean;
    user: {
        id: string;
        uid: string | null;
        username: string;
        email: string | null;
        displayName: string | null;
        role: string;
        password: string;
        branchId: string | null;
    };
    branch: {
        id: string;
        code: string;
        name: string;
        type: string;
    };
}

export async function validateBranchSetup(
    portalUrl: string,
    branchCode: string,
    username: string,
    password: string
): Promise<ValidateResponse> {
    const url = `${portalUrl}/api/branch-setup/validate`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, branchCode }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'فشل التحقق');
    }

    return response.json();
}

export async function checkLocalUsersExist(): Promise<boolean> {
    try {
        const response = await fetch(`http://${window.location.hostname}:5002/api/users?limit=1`);
        if (!response.ok) return false;
        const data = await response.json();
        return Array.isArray(data.data) ? data.data.length > 0 : false;
    } catch {
        return false;
    }
}
