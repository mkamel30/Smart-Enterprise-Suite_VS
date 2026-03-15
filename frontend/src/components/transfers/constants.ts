import { Smartphone, Monitor, Package, Clock, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react';

export const ORDER_TYPES = [
    { value: 'SIM', label: 'شرائح', icon: Smartphone, color: 'purple' },
    { value: 'MACHINE', label: 'ماكينات', icon: Monitor, color: 'indigo' },
    { value: 'MAINTENANCE', label: 'صيانة (ماكينات)', icon: Settings, color: 'indigo' },
    { value: 'SPARE_PART', label: 'قطع غيار', icon: Package, color: 'purple' }
];

export const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    'PENDING': { label: 'معلق', color: 'amber', icon: Clock },
    'RECEIVED': { label: 'مستلم', color: 'emerald', icon: CheckCircle },
    'COMPLETED': { label: 'مستلم', color: 'emerald', icon: CheckCircle },
    'PARTIAL': { label: 'جزئي', color: 'blue', icon: AlertCircle },
    'REJECTED': { label: 'مرفوض', color: 'red', icon: XCircle },
    'CANCELLED': { label: 'ملغي', color: 'slate', icon: XCircle }
};
