import { Package, Wrench, Clock, CheckCircle, XCircle } from 'lucide-react';
import React from 'react';

export interface MaintenanceDetail {
    id: string;
    serialNumber: string;
    model: string;
    manufacturer: string;
    status: 'NEW' | 'UNDER_INSPECTION' | 'REPAIRING' | 'WAITING_APPROVAL' | 'REPAIRED' | 'TOTAL_LOSS';
    branchId: string;
    originBranchId: string;
    originBranch?: {
        name: string;
        code: string;
    };
    problem: string;
    technicianId: string | null;
    technicianName: string | null;
    assignedAt: string | null;
    inspectedAt: string | null;
    repairedAt: string | null;
    totalLossAt: string | null;
    notes: string | null;
    customerName: string | null;
    customerBkCode: string | null;
    needsApproval: boolean;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    laborCost: number;
    partsCost: number;
    totalCost: number;
    isPaid: boolean;
    centerBranchId: string;
    assignedParts: {
        id: string;
        partId: string;
        name: string;
        quantity: number;
        price: number;
    }[];
    logs: {
        id: string;
        action: string;
        status: string;
        performedBy: string;
        performedAt: string;
        details: string | null;
    }[];
    daysAtCenter: number;
}

export const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    NEW: { label: 'جديد', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <Package size={16} /> },
    UNDER_INSPECTION: { label: 'تحت الفحص', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Wrench size={16} /> },
    REPAIRING: { label: 'جاري الإصلاح', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={16} /> },
    WAITING_APPROVAL: { label: 'بانتظار الموافقة', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Clock size={16} /> },
    REPAIRED: { label: 'تم الإصلاح', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={16} /> },
    TOTAL_LOSS: { label: 'خسارة كلية', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={16} /> },
};

export const approvalStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDING: { label: 'بانتظار موافقة الفرع الأوم', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={16} /> },
    APPROVED: { label: 'تمت الموافقة', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={16} /> },
    REJECTED: { label: 'مرفوض من الفرع', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={16} /> },
};
