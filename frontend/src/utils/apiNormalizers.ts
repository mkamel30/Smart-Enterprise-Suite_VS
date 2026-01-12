/**
 * API Response Normalizers
 * 
 * Safely extracts typed arrays from any API response shape.
 * Handles: plain arrays, { data: [] }, { items: [] }, { <resource>: [] }, or undefined/null.
 * 
 * Usage:
 *   const customers = normalizeArrayResponse<Customer>(apiResponse);
 */

/**
 * Generic array normalizer that handles various API response shapes
 */
export function normalizeArrayResponse<T>(raw: unknown): T[] {
    // Already an array
    if (Array.isArray(raw)) {
        return raw as T[];
    }

    // Object with common wrapper properties
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;

        // Check common wrapper patterns
        if (Array.isArray(obj.data)) return obj.data as T[];
        if (Array.isArray(obj.items)) return obj.items as T[];
        if (Array.isArray(obj.results)) return obj.results as T[];
        if (Array.isArray(obj.list)) return obj.list as T[];

        // Resource-specific wrappers (customers, requests, etc.)
        const firstKey = Object.keys(obj)[0];
        if (firstKey && Array.isArray(obj[firstKey])) {
            return obj[firstKey] as T[];
        }
    }

    // Log unexpected shapes for debugging (does not crash UI)
    if (raw !== undefined && raw !== null) {
        console.warn('[normalizeArrayResponse] Unexpected response shape:', raw);
    }

    return [];
}

/**
 * Type-safe normalizer with explicit logging for specific resources
 */
export function normalizeWithLogging<T>(raw: unknown, resourceName: string): T[] {
    const result = normalizeArrayResponse<T>(raw);

    if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        if (!Array.isArray(obj.data) && !Array.isArray(obj.items)) {
            console.warn(`[${resourceName}] API returned non-array, normalized to:`, result.length, 'items');
        }
    }

    return result;
}

/**
 * Safely checks if value is iterable array before operations
 */
export function safeArray<T>(value: T[] | undefined | null): T[] {
    return Array.isArray(value) ? value : [];
}

/**
 * Extracts pagination info from paginated responses
 */
export function extractPagination(raw: unknown): { total: number; pages: number; limit: number; offset: number } | null {
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (obj.pagination && typeof obj.pagination === 'object') {
            const pagination = obj.pagination as Record<string, unknown>;
            return {
                total: typeof pagination.total === 'number' ? pagination.total : 0,
                pages: typeof pagination.pages === 'number' ? pagination.pages : 1,
                limit: typeof pagination.limit === 'number' ? pagination.limit : 50,
                offset: typeof pagination.offset === 'number' ? pagination.offset : 0
            };
        }
    }
    return null;
}
