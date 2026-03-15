# Frontend API Integration Patterns

## Overview

The Smart Enterprise Suite frontend implements a robust API integration layer built on React Query (TanStack Query) for server state management, a custom ApiClient class for HTTP communication, and Socket.IO for real-time updates.

---

## 1. ApiClient Architecture

### 1.1 Singleton Pattern Implementation

The `ApiClient` is implemented as a singleton pattern, exported as a single instance:

**Location:** `frontend/src/api/client.ts:238`

```typescript
class ApiClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    setToken(token: string | null) {
        this.token = token;
    }
    // ... 100+ API methods
}

// Singleton export
export const api = new ApiClient(API_BASE_URL);
```

**Key Benefits:**
- Single source of truth for API communication
- Centralized token management
- Consistent error handling across the application
- Easy to mock for testing

### 1.2 Token Management

The client supports dynamic token management:

```typescript
// Set token after login
api.setToken(newToken);

// Clear token on logout
api.setToken(null);

// Token is automatically attached to all requests
private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: any = { ...(options?.headers || {}) };
    
    if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }
    // ...
}
```

### 1.3 CSRF Protection

Automatic CSRF token extraction from cookies:

**Location:** `frontend/src/api/client.ts:44-63`

```typescript
// Automatically include CSRF token from cookie if available
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

const csrfToken = getCsrfToken();
if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
}
```

### 1.4 Request/Response Interceptors

The base request method handles all HTTP communication:

```typescript
private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: any = {
        ...(options?.headers || {}),
    };

    // FormData handling - let browser set Content-Type with boundary
    if (options?.body instanceof FormData) {
        delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    // Attach auth token
    if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Include credentials for cookies/sessions
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }

    return response.json();
}
```

### 1.5 Generic HTTP Methods

Convenience methods for standard HTTP operations:

```typescript
// Generic helpers for flexible usage
public async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
}

public async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

public async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

public async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
}
```

### 1.6 Method Overview (100+ API Methods)

The ApiClient provides organized methods by domain:

#### Authentication
- `login(credentials)` - User authentication
- `changePassword(data)` - Password change

#### Customers
- `getCustomers(params)` - List customers with optional branch filter
- `getCustomersLite(search)` - Lightweight customer search
- `getCustomer(id)` - Single customer details
- `createCustomer(data)` - Create new customer
- `updateCustomer(id, data)` - Update customer
- `deleteCustomer(id)` - Delete customer
- `importCustomers(file)` - Excel import
- `getCustomerTemplate()` - Download import template
- `getCustomerMachines(id)` - Get customer's machines

#### Maintenance Requests
- `getRequests(params)` - List requests with filters
- `getRequest(id)` - Single request details
- `createRequest(data)` - Create new request
- `assignTechnician(id, technicianId)` - Assign technician
- `closeRequest(id, data)` - Close/completed request
- `deleteRequest(id)` - Delete request
- `getRequestStats(branchId)` - Request statistics
- `exportRequests(branchId, search)` - Export to Excel

#### Inventory & Warehouse
- `getInventory(params)` - Inventory list
- `getStockMovements(params)` - Movement history
- `updateInventory(id, quantity)` - Update stock quantity
- `importInventory(items, branchId)` - Bulk import
- `transferInventory(data)` - Transfer between branches
- `getWarehouseMachines(status, branchId)` - Machine inventory
- `addWarehouseMachine(data)` - Add new machine
- `updateWarehouseMachine(id, data)` - Update machine
- `deleteWarehouseMachine(id)` - Remove machine
- `exchangeWarehouseMachine(data)` - Machine exchange
- `returnMachineToWarehouse(data)` - Return to warehouse

#### SIM Cards
- `getWarehouseSims(branchId)` - SIM inventory
- `createWarehouseSim(data)` - Add new SIM
- `updateWarehouseSim(id, data)` - Update SIM
- `deleteWarehouseSim(id)` - Remove SIM
- `importWarehouseSims(file, branchId)` - Bulk import
- `assignSimToCustomer(data)` - Assign to customer
- `exchangeSim(data)` - SIM exchange
- `returnSimToWarehouse(data)` - Return to warehouse

#### Transfer Orders
- `getTransferOrders(params)` - List transfer orders
- `createTransferOrder(data)` - Create new order
- `importTransferOrder(formData)` - Excel import
- `receiveTransferOrder(id, data)` - Receive items
- `rejectTransferOrder(id, data)` - Reject transfer
- `cancelTransferOrder(id)` - Cancel order
- `getPendingTransferOrders(branchId)` - Pending orders

#### Sales & Payments
- `createSale(data)` - Create sale record
- `getSales()` - List all sales
- `getInstallments(overdue)` - Installment tracking
- `payInstallment(id)` - Record payment
- `recalculateInstallments(saleId, newCount)` - Recalculate plan
- `getPayments()` - Payment records
- `getPaymentStats()` - Payment statistics
- `createPayment(data)` - Record payment
- `checkReceipt(number)` - Validate receipt number

#### Reports
- `getInventoryReport(params)` - Inventory report
- `getMovementsReport(startDate, endDate, branchId)` - Movement report
- `getPerformanceReport(startDate, endDate, branchId)` - Performance report
- `getExecutiveReport(filters)` - Executive dashboard report
- `getDashboardStats(params)` - Dashboard statistics
- `getExecutiveDashboard(params)` - High-level dashboard
- `getInstallmentStats()` - Installment statistics

#### Admin & Settings
- `getBranches()` - Branch management
- `getActiveBranches()` - Active branches only
- `createBranch(data)` - Create branch
- `updateBranch(id, data)` - Update branch
- `deleteBranch(id)` - Delete branch
- `getUsers(params)` - User management
- `createUser(data)` - Create user
- `updateUser(id, data)` - Update user
- `deleteUser(id)` - Delete user
- `resetUserPassword(id, newPassword)` - Reset password
- `getPermissions()` - Permission structure
- `bulkUpdatePermissions(permissions)` - Update permissions
- `getMachineParameters()` - Machine parameters
- `createMachineParameter(data)` - Add parameter
- `getClientTypes()` - Client type management

#### AI & Backup
- `getAiModels()` - Available AI models
- `askAi(prompt, model)` - AI query
- `createBackup()` - Create database backup
- `listBackups()` - List available backups
- `restoreBackup(filename)` - Restore from backup
- `deleteBackup(filename)` - Delete backup

#### Notifications
- `getNotifications(params)` - User notifications
- `getNotificationCount(params)` - Unread count
- `markNotificationRead(id)` - Mark as read
- `markAllNotificationsRead(params)` - Mark all read

#### External Repair
- `withdrawMachineForRepair(data)` - Send for external repair
- `getExternalRepairMachines(status)` - Track external repairs
- `markMachineReadyForPickup(id)` - Mark as ready
- `deliverMachineToCustomer(id)` - Complete delivery
- `getReadyForPickupCount()` - Ready machines count

---

## 2. React Query Integration

### 2.1 Query Patterns (useQuery)

**Basic Data Fetching:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// Simple query
const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getCustomers()
});

// Query with parameters
const { data: requests } = useQuery({
    queryKey: ['requests', branchId], // Include params in key
    queryFn: () => api.getRequests({ branchId })
});

// Conditional query (enabled)
const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.getActiveBranches(),
    enabled: isAdmin // Only fetch if admin
});
```

**With Stale Time Configuration:**

```typescript
const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.getActiveBranches(),
    enabled: isAdmin,
    staleTime: 1000 * 60 * 60 // 1 hour - data stays fresh
});
```

### 2.2 Mutation Patterns (useMutation)

**Location:** `frontend/src/hooks/useApiMutation.ts`

The custom `useApiMutation` hook provides standardized mutation handling:

```typescript
import { useApiMutation } from '../hooks/useApiMutation';
import { api } from '../api/client';

// Basic mutation with toast notifications
const createCustomerMutation = useApiMutation({
    mutationFn: (data: CustomerFormData) => api.createCustomer(data),
    successMessage: 'تم إنشاء العميل بنجاح', // "Customer created successfully"
    errorMessage: 'فشل إنشاء العميل', // "Failed to create customer"
    invalidateKeys: [['customers']], // Invalidate queries after success
    onSuccess: (data, variables) => {
        // Additional success logic
        closeModal();
    },
    onError: (error, variables) => {
        // Additional error handling
        logError(error);
    }
});

// Usage
const handleSubmit = (formData) => {
    createCustomerMutation.mutate(formData);
};
```

### 2.3 Cache Configuration

**Query Client Setup (in main.tsx):**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes default
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});
```

**Cache Invalidation Patterns:**

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ['customers'] });

// Invalidate multiple related queries
queryClient.invalidateQueries({ 
    queryKey: ['customers', branchId] 
});

// Invalidate all queries starting with prefix
queryClient.invalidateQueries({ 
    queryKey: ['customers'],
    exact: false // Partial match
});
```

### 2.4 Refetch Strategies

**Manual Refetch:**

```typescript
const { data, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getCustomers()
});

// Manual trigger
const handleRefresh = () => {
    refetch();
};
```

**Automatic Refetch on Mount:**

```typescript
const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
    refetchOnMount: 'always' // Always fetch on component mount
});
```

**Polling (Real-time Updates):**

```typescript
const { data } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.getNotificationCount(),
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: true // Continue in background
});
```

### 2.5 Optimistic Updates

```typescript
const queryClient = useQueryClient();

const updateMutation = useMutation({
    mutationFn: updateCustomer,
    onMutate: async (newData) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['customers', newData.id] });
        
        // Snapshot previous value
        const previousData = queryClient.getQueryData(['customers', newData.id]);
        
        // Optimistically update
        queryClient.setQueryData(['customers', newData.id], newData);
        
        // Return context for rollback
        return { previousData };
    },
    onError: (err, newData, context) => {
        // Rollback on error
        queryClient.setQueryData(
            ['customers', newData.id], 
            context?.previousData
        );
    },
    onSettled: (newData) => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: ['customers', newData?.id] });
    }
});
```

---

## 3. Custom Hooks

### 3.1 useApiMutation with Toast Notifications

**Location:** `frontend/src/hooks/useApiMutation.ts:14-70`

```typescript
interface ApiMutationOptions<TData, TVariables> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    successMessage?: string;
    successDetail?: string | ((data: TData) => string);
    errorMessage?: string;
    invalidateKeys?: string[][];
    onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
    onError?: (error: any, variables: TVariables, context: unknown) => void;
}

export function useApiMutation<TData = any, TVariables = any>(
    options: ApiMutationOptions<TData, TVariables>
) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: options.mutationFn,
        onSuccess: (data, variables, context) => {
            // Show success toast
            if (options.successMessage) {
                const detail = typeof options.successDetail === 'function'
                    ? options.successDetail(data)
                    : options.successDetail;
                toast.success(detail ? `${options.successMessage}: ${detail}` : options.successMessage);
            }

            // Invalidate queries
            if (options.invalidateKeys) {
                options.invalidateKeys.forEach(key => {
                    queryClient.invalidateQueries({ queryKey: key });
                });
            }

            options.onSuccess?.(data, variables, context);
        },
        onError: (error: any, variables, context) => {
            // Error handling with detailed messages
            const responseData = error.response?.data;
            const errorObj = responseData?.error;
            
            let errorMsg = 'حدث خطأ غير متوقع'; // "An unexpected error occurred"
            
            if (errorObj) {
                if (errorObj.details && typeof errorObj.details === 'object') {
                    const detailMsgs = Object.entries(errorObj.details)
                        .map(([field, msg]) => `${msg}`)
                        .join(' | ');
                    errorMsg = detailMsgs || errorObj.message;
                } else {
                    errorMsg = errorObj.message || errorObj;
                }
            }
            
            toast.error(`${options.errorMessage || 'فشلت العملية'}: ${errorMsg}`);
            options.onError?.(error, variables, context);
        }
    });
}
```

### 3.2 useAuthQuery with Authentication

**Location:** `frontend/src/hooks/useAuthQuery.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper around useQuery that automatically checks if the user is authenticated
 * before enabling the query. This prevents 500 errors from API calls before login.
 */
export function useAuthQuery<TQueryFnData = unknown, TError = unknown, TData = TQueryFnData>(
    options: UseQueryOptions<TQueryFnData, TError, TData>
) {
    const { user } = useAuth();

    return useQuery({
        ...options,
        // Combine authentication check with any custom enabled logic
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true),
    });
}

// Usage example:
const { data } = useAuthQuery({
    queryKey: ['sensitive-data'],
    queryFn: () => api.getSensitiveData(),
    // Query won't execute until user is logged in
});
```

### 3.3 useCustomerData for Complex State

**Location:** `frontend/src/hooks/useCustomerData.ts`

This hook demonstrates complex state management with data normalization:

```typescript
export function useCustomerData(isAdmin: boolean, initialBranchId?: string) {
    const queryClient = useQueryClient();
    const [filterBranchId, setFilterBranchId] = useState(initialBranchId || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomerCode, setSelectedCustomerCode] = useState<string | null>(null);

    // Auto-apply machine parameters on page load
    useEffect(() => {
        const applyParameters = async () => {
            try {
                await api.applyMachineParameters();
                queryClient.invalidateQueries({ queryKey: ['customers'] });
            } catch (error) {
                console.error('Failed to apply machine parameters:', error);
            }
        };
        applyParameters();
    }, [queryClient]);

    // Fetch branches if admin
    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getActiveBranches(),
        enabled: isAdmin,
        staleTime: 1000 * 60 * 60
    });

    // Fetch customers with normalization
    const { data: rawCustomers } = useQuery({
        queryKey: ['customers', filterBranchId],
        queryFn: () => api.getCustomers({ branchId: filterBranchId })
    });

    // Normalize responses to handle different API shapes
    const customers: Customer[] = useMemo(
        () => normalizeCustomersResponse(rawCustomers),
        [rawCustomers]
    );

    // Complex derived state
    const stats = useMemo(() => {
        let machineCount = 0;
        let simCount = 0;
        customers.forEach((c) => {
            machineCount += c.posMachines?.length || 0;
            simCount += c.simCards?.length || 0;
        });
        return {
            customers: customers.length,
            machines: machineCount,
            simCards: simCount
        };
    }, [customers]);

    // Search with multi-field matching
    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        // Complex search logic across customers, machines, and SIMs
        // ...
    }, [searchQuery, customers]);

    return {
        filterBranchId, setFilterBranchId,
        searchQuery, setSearchQuery,
        selectedCustomerCode, setSelectedCustomerCode,
        selectedCustomer,
        branches,
        customers,  // Always Customer[], never undefined
        isLoading,
        error,
        searchResults,
        machinesWithOpenRequests,
        stats
    };
}
```

---

## 4. State Synchronization

### 4.1 Cache Invalidation Patterns

**After Mutations:**

```typescript
const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.deleteCustomer(id),
    successMessage: 'تم حذف العميل بنجاح',
    invalidateKeys: [
        ['customers'],           // Main list
        ['customers', id],       // Individual record
        ['stats']                // Related stats
    ]
});
```

**Selective Invalidation:**

```typescript
// Invalidate only active queries
queryClient.invalidateQueries({
    queryKey: ['customers'],
    type: 'active' // Only active (mounted) queries
});

// Invalidate all customer queries
queryClient.invalidateQueries({
    predicate: (query) => 
        query.queryKey[0] === 'customers'
});
```

### 4.2 Real-time Updates via WebSocket

**Location:** `frontend/src/context/SocketContext.tsx`

```typescript
import { io, Socket } from 'socket.io-client';

export const SocketProvider = ({ children }: SocketProviderProps) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const newSocket = io('http://localhost:5000', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
            timeout: 20000
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            
            // Join user's branch room for branch-wide updates
            if (user.branchId) {
                newSocket.emit('join-branch', user.branchId);
            }
            
            // Join user's personal room for direct notifications
            if (user.id) {
                newSocket.emit('join-user', user.id);
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
```

**Listening for Real-time Events:**

```typescript
import { useSocket } from '../context/SocketContext';
import { useQueryClient } from '@tanstack/react-query';

function NotificationsComponent() {
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) return;

        // Listen for new notifications
        socket.on('new-notification', (notification) => {
            // Update cache immediately
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] });
            
            // Show toast
            toast.info(notification.message);
        });

        // Listen for data changes
        socket.on('customer-updated', (customerId) => {
            queryClient.invalidateQueries({ 
                queryKey: ['customers', customerId] 
            });
        });

        return () => {
            socket.off('new-notification');
            socket.off('customer-updated');
        };
    }, [socket, queryClient]);
}
```

### 4.3 Optimistic UI Updates

```typescript
const updateMutation = useApiMutation({
    mutationFn: updateCustomer,
    onMutate: async (newCustomer) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ 
            queryKey: ['customers', newCustomer.id] 
        });

        // Snapshot the previous value
        const previousCustomer = queryClient.getQueryData(
            ['customers', newCustomer.id]
        );

        // Optimistically update to the new value
        queryClient.setQueryData(
            ['customers', newCustomer.id], 
            newCustomer
        );

        // Return a context object with the snapshotted value
        return { previousCustomer };
    },
    onError: (err, newCustomer, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        queryClient.setQueryData(
            ['customers', newCustomer.id], 
            context?.previousCustomer
        );
        
        toast.error('فشل التحديث، تم استعادة البيانات السابقة');
    },
    onSettled: (newCustomer) => {
        // Always refetch after error or success to sync with server
        queryClient.invalidateQueries({ 
            queryKey: ['customers', newCustomer?.id] 
        });
    }
});
```

### 4.4 Error Rollback Handling

The `useApiMutation` hook includes automatic error handling with detailed message extraction:

```typescript
onError: (error: any, variables, context) => {
    // Extract detailed error information from the backend response structure
    const responseData = error.response?.data;
    const errorObj = responseData?.error;

    let errorMsg = 'حدث خطأ غير متوقع'; // Default error message

    if (errorObj) {
        if (errorObj.details && typeof errorObj.details === 'object' && !Array.isArray(errorObj.details)) {
            // Extract validation field errors
            const detailMsgs = Object.entries(errorObj.details)
                .map(([field, msg]) => `${msg}`)
                .join(' | ');
            errorMsg = detailMsgs || errorObj.message;
        } else {
            errorMsg = errorObj.message || errorObj;
        }
    } else if (responseData?.message) {
        errorMsg = responseData.message;
    } else if (error.message) {
        errorMsg = error.message;
    }

    // Show error toast with details
    toast.error(`${options.errorMessage || 'فشلت العملية'}: ${errorMsg}`);

    // Custom onError callback
    options.onError?.(error, variables, context);
}
```

---

## 5. Authentication Flow

### 5.1 Login Process

**Login Handler:**

```typescript
// In Login component
const handleLogin = async (credentials: LoginCredentials) => {
    try {
        const response = await api.login(credentials);
        
        // Store auth data via context
        login(response.token, response.user);
        
        // Navigate to dashboard
        navigate('/dashboard');
    } catch (error) {
        toast.error('فشل تسجيل الدخول: ' + error.message);
    }
};
```

### 5.2 Token Storage (localStorage)

**Location:** `frontend/src/context/AuthContext.tsx:64-78`

```typescript
const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    api.setToken(newToken);
};

const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    api.setToken(null);
};
```

### 5.3 Automatic Token Attachment

The ApiClient automatically attaches the token to all requests:

```typescript
private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: any = { ...(options?.headers || {}) };
    
    if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    // ... rest of request
}
```

### 5.4 Token Validation on App Load

**Location:** `frontend/src/context/AuthContext.tsx:30-62`

```typescript
useEffect(() => {
    // Load from localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
        // Verify token is still valid by making a quick API call
        api.setToken(storedToken);
        
        // Try to verify the token
        fetch('http://localhost:5000/api/notifications/count', {
            headers: { 'Authorization': `Bearer ${storedToken}` }
        })
        .then(res => {
            if (res.ok) {
                // Token is valid, restore session
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } else {
                // Token is invalid, clear storage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                api.setToken(null);
            }
        })
        .catch(() => {
            // Network error or token invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            api.setToken(null);
        });
    }
}, []);
```

### 5.5 Logout and Cleanup

```typescript
const logout = () => {
    // Clear React state
    setToken(null);
    setUser(null);
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear API client token
    api.setToken(null);
    
    // Disconnect WebSocket
    socket?.disconnect();
    
    // Clear React Query cache
    queryClient.clear();
};
```

---

## 6. Error Handling

### 6.1 Global Error Handling

**In useApiMutation Hook:**

```typescript
onError: (error: any, variables, context) => {
    const responseData = error.response?.data;
    const errorObj = responseData?.error;
    
    let errorMsg = 'حدث خطأ غير متوقع'; // "An unexpected error occurred"
    
    if (errorObj) {
        // Handle validation errors with field details
        if (errorObj.details && typeof errorObj.details === 'object') {
            const detailMsgs = Object.entries(errorObj.details)
                .map(([field, msg]) => `${msg}`)
                .join(' | ');
            errorMsg = detailMsgs || errorObj.message;
        } else {
            errorMsg = errorObj.message || errorObj;
        }
    }
    
    toast.error(`${options.errorMessage}: ${errorMsg}`);
}
```

### 6.2 Toast Notifications

Using `react-hot-toast` for user feedback:

```typescript
import toast from 'react-hot-toast';

// Success toast
toast.success('تم الحفظ بنجاح'); // "Saved successfully"

// Error toast with details
toast.error(`فشلت العملية: ${errorMessage}`); // "Operation failed: ..."

// Info toast for updates
toast.info('جاري التحميل...'); // "Loading..."
```

**Integration with useApiMutation:**

```typescript
const mutation = useApiMutation({
    mutationFn: api.createCustomer,
    successMessage: 'تم إنشاء العميل بنجاح',
    errorMessage: 'فشل إنشاء العميل',
    // Toast shown automatically on success/error
});
```

### 6.3 Retry Logic

**Query-level Retry:**

```typescript
const { data } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getCustomers(),
    retry: 3, // Retry 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Exponential backoff: 1s, 2s, 4s, max 30s
});
```

**Mutation Retry (Manual):**

```typescript
const mutation = useMutation({
    mutationFn: api.updateCustomer,
    retry: 2, // Retry failed mutations
});
```

### 6.4 Fallback Values

**Data Normalization Pattern:**

```typescript
function normalizeCustomersResponse(raw: unknown): Customer[] {
    if (Array.isArray(raw)) {
        return raw;
    }
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data;
        if (Array.isArray(obj.customers)) return obj.customers;
        if (Array.isArray(obj.items)) return obj.items;
    }
    // Log unexpected shapes for debugging
    if (raw !== undefined && raw !== null) {
        console.warn('Unexpected customers response shape:', raw);
    }
    return []; // Always return array, never undefined
}

// Usage in hook
const customers: Customer[] = useMemo(
    () => normalizeCustomersResponse(rawCustomers),
    [rawCustomers]
);
```

**Default Values in Components:**

```typescript
const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getCustomers()
});
// customers is always an array, even during loading or error
```

---

## Code Examples

### Example 1: Typical Data Fetching

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function CustomerList() {
    const { user } = useAuth();
    
    // Fetch customers with branch filter
    const { 
        data: customers = [], 
        isLoading, 
        error,
        refetch 
    } = useQuery({
        queryKey: ['customers', user?.branchId],
        queryFn: () => api.getCustomers({ branchId: user?.branchId }),
        enabled: !!user, // Only fetch when authenticated
        staleTime: 1000 * 60 * 5 // 5 minutes
    });

    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage error={error} onRetry={refetch} />;

    return (
        <ul>
            {customers.map(customer => (
                <CustomerCard key={customer.id} customer={customer} />
            ))}
        </ul>
    );
}
```

### Example 2: Form Submission

```typescript
import { useApiMutation } from '../hooks/useApiMutation';
import { api } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

function CustomerForm({ onSuccess }: { onSuccess: () => void }) {
    const queryClient = useQueryClient();
    
    const createMutation = useApiMutation({
        mutationFn: (data: CustomerFormData) => api.createCustomer(data),
        successMessage: 'تم إنشاء العميل بنجاح',
        errorMessage: 'فشل إنشاء العميل',
        invalidateKeys: [['customers']],
        onSuccess: () => {
            onSuccess();
            // Additional logic
        }
    });

    const handleSubmit = (formData: CustomerFormData) => {
        createMutation.mutate(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Form fields */}
            <button 
                type="submit" 
                disabled={createMutation.isPending}
            >
                {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </button>
        </form>
    );
}
```

### Example 3: Bulk Operations

```typescript
import { useApiMutation } from '../hooks/useApiMutation';
import { api } from '../api/client';

function BulkImportCustomers() {
    const importMutation = useApiMutation({
        mutationFn: (file: File) => api.importCustomers(file),
        successMessage: 'تم استيراد العملاء بنجاح',
        errorMessage: 'فشل استيراد العملاء',
        invalidateKeys: [['customers'], ['stats']],
        successDetail: (data) => `تم استيراد ${data.count} عميل`
    });

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        importMutation.mutate(file);
    };

    return (
        <div>
            <input 
                type="file" 
                accept=".xlsx,.xls,.csv" 
                onChange={handleFileUpload}
                disabled={importMutation.isPending}
            />
            {importMutation.isPending && <ProgressBar />}
        </div>
    );
}
```

### Example 4: File Uploads

```typescript
// In ApiClient - handles file uploads specially
async importCustomers(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const headers: any = {};
    if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }
    // Note: No Content-Type header for FormData - browser sets it with boundary

    const response = await fetch(`${this.baseUrl}/customers/import`, {
        method: 'POST',
        body: formData,
        headers
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Import failed');
    }

    return response.json();
}

// Usage in component
const uploadMutation = useApiMutation({
    mutationFn: (file: File) => api.importCustomers(file),
    successMessage: 'تم رفع الملف بنجاح',
    errorMessage: 'فشل رفع الملف',
    invalidateKeys: [['customers']]
});
```

### Example 5: Complex Error Handling

```typescript
import { useApiMutation } from '../hooks/useApiMutation';

function UpdateCustomerForm() {
    const updateMutation = useApiMutation({
        mutationFn: ({ id, data }: { id: string; data: CustomerData }) => 
            api.updateCustomer(id, data),
        successMessage: 'تم تحديث العميل بنجاح',
        errorMessage: 'فشل تحديث العميل',
        onError: (error, variables) => {
            // Handle specific error types
            if (error.response?.status === 409) {
                // Conflict - duplicate data
                toast.error('عميل بنفس البيانات موجود بالفعل');
            } else if (error.response?.status === 403) {
                // Forbidden - no permission
                toast.error('ليس لديك صلاحية لتعديل هذا العميل');
            }
            // Other errors handled by default handler
        }
    });

    const handleSubmit = (data: CustomerData) => {
        updateMutation.mutate({ id: customerId, data });
    };

    return (
        <form onSubmit={handleSubmit}>
            {updateMutation.isError && (
                <ErrorBanner 
                    message={updateMutation.error?.message} 
                    onDismiss={() => updateMutation.reset()}
                />
            )}
            {/* Form fields */}
        </form>
    );
}
```

### Example 6: Real-time Updates with WebSocket

```typescript
import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

function DashboardPage() {
    const { socket, isConnected } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) return;

        // Listen for various real-time events
        socket.on('new-request', (data) => {
            toast.info(`طلب صيانة جديد: ${data.customerName}`);
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        });

        socket.on('request-assigned', (data) => {
            if (data.technicianId === user?.id) {
                toast.info(`تم تعيين طلب جديد إليك`);
            }
            queryClient.invalidateQueries({ queryKey: ['requests'] });
        });

        socket.on('stock-low', (data) => {
            toast.warning(`تنبيه: المخزون منخفض - ${data.partName}`);
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        });

        return () => {
            socket.off('new-request');
            socket.off('request-assigned');
            socket.off('stock-low');
        };
    }, [socket, queryClient, user?.id]);

    return (
        <div>
            <ConnectionStatus isConnected={isConnected} />
            {/* Dashboard content */}
        </div>
    );
}
```

---

## Best Practices

1. **Always use query keys properly** - Include all variables that affect the query result
2. **Use `useApiMutation` for all mutations** - Consistent error handling and toast notifications
3. **Normalize API responses** - Handle different response shapes gracefully
4. **Enable queries conditionally** - Use `enabled` option to prevent unnecessary requests
5. **Set appropriate stale times** - Balance freshness with server load
6. **Invalidate related queries** - Keep data synchronized after mutations
7. **Handle errors gracefully** - Always provide fallback UI and retry options
8. **Use WebSocket for real-time** - Reduce polling, improve performance
9. **Clean up on logout** - Clear tokens, cache, and connections
10. **Type API responses** - Use TypeScript types for better developer experience

---

## Related Documentation

- [ApiClient Reference](./api-client-reference.md)
- [Authentication Flow](./authentication-flow.md)
- [React Query Best Practices](./react-query-patterns.md)
- [WebSocket Integration](./websocket-integration.md)
