import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

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

            // Custom onSuccess
            options.onSuccess?.(data, variables, context);
        },
        onError: (error: any, variables, context) => {
            // Extract detailed error information from the backend response structure
            const responseData = error.response?.data;
            const errorObj = responseData?.error;

            let errorMsg = 'حدث خطأ غير متوقع';

            if (errorObj) {
                if (errorObj.details && typeof errorObj.details === 'object' && !Array.isArray(errorObj.details)) {
                    // Extract validation field errors: "Field: Error, Field2: Error2"
                    const detailMsgs = Object.entries(errorObj.details)
                        .map(([field, msg]) => `${msg}`) // Just show the message for cleaner UI
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

            // Show error toast
            toast.error(`${options.errorMessage || 'فشلت العملية'}: ${errorMsg}`);

            // Custom onError
            options.onError?.(error, variables, context);
        }
    });
}

// Simplified version for common patterns
export function useSimpleMutation<TData = any, TVariables = any>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    successMessage: string,
    invalidateKeys?: string[][]
) {
    return useApiMutation<TData, TVariables>({
        mutationFn,
        successMessage,
        invalidateKeys
    });
}
