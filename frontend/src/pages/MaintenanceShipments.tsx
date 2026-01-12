"use client";
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
// Using lucide-react instead of heroicons
import { Truck, Calendar, Archive, CheckCircle, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { translateStatus } from '../lib/translations';

interface Shipment {
    id: string;
    orderNumber: string;
    fromBranch: { name: string; code: string };
    status: string;
    createdAt: string;
    _count: { items: number };
    progress: number;
}

const MaintenanceShipments: React.FC = () => {
    const navigate = useNavigate();

    const [filterStatus, setFilterStatus] = React.useState<string>('');

    const { data: shipments, isLoading, refetch } = useQuery({
        queryKey: ['maintenance-shipments', filterStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);
            const res = await api.get(`/maintenance/shipments?${params.toString()}`);
            return res as Shipment[];
        }
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'ACCEPTED':
            case 'RECEIVED': return 'bg-blue-100 text-blue-800';
            case 'COMPLETED': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: string) => {
        return translateStatus(status);
    };

    return (
        <div className="p-6 space-y-6" dir="rtl">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">إدارة شحنات الصيانة الواردة</h1>
                <div className="flex gap-2">
                    <select
                        className="pl-8 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">نشط (الحالي)</option>
                        <option value="ALL">كل الشحنات</option>
                        <option value="PENDING">في الطريق</option>
                        <option value="ACCEPTED">تم الاستلام</option>
                        <option value="COMPLETED">مكتملة</option>
                    </select>
                    <Button onClick={() => refetch()} variant="outline" size="sm">
                        تحديث
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12">تحميل الشحنات...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {shipments?.map((shipment) => (
                        <div
                            key={shipment.id}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                            onClick={() => navigate(`/maintenance/shipments/${shipment.id}`)}
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Truck className="w-5 h-5 text-gray-500" />
                                        <h3 className="font-bold text-lg text-gray-900">{shipment.orderNumber}</h3>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                        <span>من:</span>
                                        <span className="font-medium text-gray-900">{shipment.fromBranch?.name}</span>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                                    {getStatusLabel(shipment.status)}
                                </span>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-4">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{format(new Date(shipment.createdAt), 'yyyy-MM-dd', { locale: ar })}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Archive className="w-4 h-4" />
                                        <span>{shipment._count.items} ماكينة</span>
                                    </div>
                                </div>

                                {/* Progress Mockup */}
                                {shipment.status !== 'PENDING' && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>نسبة الإنجاز</span>
                                            <span>{shipment.progress}%</span>
                                        </div>
                                        <Progress value={shipment.progress} className="h-2" />
                                    </div>
                                )}

                                <Button className="w-full justify-center mt-2 group" variant="default">
                                    <span>عرض الشحنة والبدء</span>
                                </Button>
                            </div>
                        </div>
                    ))}

                    {shipments?.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">لا توجد شحنات واردة حالياً</h3>
                            <p className="text-gray-500 mt-1">الشحنات المرسلة من الفروع ستظهر هنا</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MaintenanceShipments;
