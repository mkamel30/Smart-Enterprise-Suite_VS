import React from 'react';
import { Package, Building2, User, Wrench } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { MaintenanceDetail } from './MaintenanceTypes';

interface MachineInfoCardProps {
    machine: MaintenanceDetail;
    technicians: any[];
    onAssignTechnician: (technicianId: string) => void;
}

const MachineInfoCard: React.FC<MachineInfoCardProps> = ({ machine, technicians, onAssignTechnician }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Package size={16} />
                        <span className="text-sm">الموديل</span>
                    </div>
                    <p className="font-bold">{machine.model}</p>
                    <p className="text-xs text-muted-foreground">{machine.manufacturer}</p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Building2 size={16} />
                        <span className="text-sm">الفرع الأصلي</span>
                    </div>
                    <p className="font-bold">{machine.originBranch?.name || 'غير معروف'}</p>
                    <p className="text-xs text-muted-foreground">{machine.originBranch?.code}</p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <User size={16} />
                        <span className="text-sm">العميل</span>
                    </div>
                    <p className="font-bold">{machine.customerName || 'غير معروف'}</p>
                    <p className="text-xs text-muted-foreground">{machine.customerBkCode}</p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Wrench size={16} />
                        <span className="text-sm">الفني المسؤول</span>
                    </div>
                    <p className="font-bold">{machine.technicianName || 'غير معين'}</p>
                    {machine.status === 'NEW' && (
                        <Select onValueChange={onAssignTechnician}>
                            <SelectTrigger className="mt-2 h-8 text-xs">
                                <SelectValue placeholder="تعيين فني..." />
                            </SelectTrigger>
                            <SelectContent>
                                {technicians?.map((tech: any) => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        {tech.displayName || tech.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default MachineInfoCard;
