export const STATUS_TRANSLATIONS: Record<string, string> = {
    // Maintenance Request Statuses
    'Open': 'مفتوح',
    'Pending': 'معلق',
    'In Progress': 'قيد العمل',
    'Closed': 'مغلق',
    'Cancelled': 'ملغي',

    // Generic Backend Statuses (Capitalized)
    'PENDING': 'قيد الانتظار',
    'APPROVED': 'تمت الموافقة',
    'REJECTED': 'مرفوض',
    'SENT': 'تم الإرسال',
    'RECEIVED': 'تم الاستلام',
    'COMPLETED': 'مكتمل',
    'ACCEPTED': 'مقبول',
    'CANCELLED': 'ملغي',
    'PAID': 'مسدد',
    'PARTIAL': 'جزئي',

    // Machine/SIM Statuses
    'IN_STOCK': 'في المخزن',
    'IN_USE': 'قيد الاستخدام',
    'DEFECTIVE': 'تالف/به عطل',
    'MAINTENANCE': 'في الصيانة',
    'RETURNED': 'تم الإرجاع',
    'CLIENT_REPAIR': 'سحب إصلاح عميل',
    'SCRAPPED': 'تخريد',
    'REPAIRED': 'تم الإصلاح',
    'IN_TRANSIT': 'في الطريق',
    'AT_CENTER': 'في المركز',
    'EXTERNAL_REPAIR': 'صيانة خارجية',
    'READY_FOR_RETURN': 'جاهز للإرجاع',
    'ASSIGNED': 'تم التعيين',
    'UNDER_INSPECTION': 'تحت الفحص',
    'AWAITING_APPROVAL': 'بانتظار الموافقة',
    'PENDING_APPROVAL': 'بانتظار الموافقة',

    // Asset Statuses
    'Operational': 'يعمل',
    'Under Maintenance': 'تحت الصيانة',
    'Decommissioned': 'خارج الخدمة',

    // Approval Specific
    'SENT_TO_CENTER': 'مرسل للمركز',
    'BRANCH_APPROVED': 'موافقة الفرع',
    'WAITING_APPROVAL': 'في انتظار الموافقة',
    'APPROVED_BY_BRANCH': 'تمت موافقة الفرع',
};

export function translateStatus(status: string | undefined | null): string {
    if (!status) return 'غير محدد';
    return STATUS_TRANSLATIONS[status] || status;
}
