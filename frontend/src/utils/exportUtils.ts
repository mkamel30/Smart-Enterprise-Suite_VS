const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Download Excel file from export endpoint
 * @param endpoint - The export endpoint path (e.g., '/sales/export')
 * @param filename - The filename for the downloaded file
 */
export async function downloadExcel(endpoint: string, filename: string): Promise<void> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
        },
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل في تصدير البيانات');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Export functions for each page
export const exportSales = () => downloadExcel('/sales/export', 'سجل_المبيعات.xlsx');
export const exportPayments = () => downloadExcel('/payments/export', 'سجل_المدفوعات.xlsx');
export const exportTransferOrders = () => downloadExcel('/transfer-orders/export-data', 'أذونات_الصرف.xlsx');
export const exportSpareParts = () => downloadExcel('/spare-parts/export', 'قطع_الغيار.xlsx');
export const exportPendingPayments = () => downloadExcel('/pending-payments/export', 'المستحقات_المعلقة.xlsx');
export const exportTracking = () => downloadExcel('/maintenance/tracking/export', 'متابعة_الماكينات.xlsx');
