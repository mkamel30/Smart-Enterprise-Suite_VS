import { Smartphone, Monitor, Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const ORDER_TYPES = [
    { value: 'SIM', label: 'شرائح', icon: Smartphone, color: 'purple' },
    { value: 'MACHINE', label: 'ماكينات', icon: Monitor, color: 'green' },
    { value: 'MAINTENANCE', label: 'صيانة (ماكينات)', icon: Monitor, color: 'blue' },
    { value: 'SPARE_PART', label: 'قطع غيار', icon: Package, color: 'orange' }
];

export const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    'PENDING': { label: 'معلق', color: 'yellow', icon: Clock },
    'RECEIVED': { label: 'مستلم', color: 'green', icon: CheckCircle },
    'PARTIAL': { label: 'جزئي', color: 'blue', icon: AlertCircle },
    'REJECTED': { label: 'مرفوض', color: 'red', icon: XCircle }
};
