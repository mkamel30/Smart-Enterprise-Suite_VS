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
            // Extract error message from response
            const errorMsg = error.response?.data?.error
                || error.response?.data?.message
                || error.message
                || 'حدث خطأ غير متوقع';

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
