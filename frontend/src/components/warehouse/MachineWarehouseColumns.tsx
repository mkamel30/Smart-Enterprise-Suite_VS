import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
    ShoppingCart,
    RotateCcw,
    UserCheck,
    CheckCircle,
    AlertTriangle
} from "lucide-react";

interface ActionHandlers {
    onSell: (machine: any) => void;
    onExchange: (machine: any) => void;
    onReturnToCustomer: (machine: any) => void;
    onRepair: (machine: any) => void;
    onAddParameter: (machine: any) => void;
}

export const getMachineColumns = (
    activeTab: string,
    handlers: ActionHandlers,
    isAffairs: boolean,
    isCenterManager: boolean,
    pendingSerials: string[]
): ColumnDef<any>[] => {
    const isMaintenanceStatus = (status: string) =>
        ['AT_CENTER', 'RECEIVED_AT_CENTER', 'EXTERNAL_REPAIR', 'UNDER_MAINTENANCE', 'ASSIGNED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'IN_TRANSIT'].includes(status);

    const columns: ColumnDef<any>[] = [];

    // Selection Column for Admin Affairs
    // Selection Column for Admin Affairs or for Branch Users in repair-related tabs
    if (isAffairs || (!isCenterManager && (activeTab === 'CLIENT_REPAIR' || activeTab === 'DEFECTIVE'))) {
        columns.push({
            id: "select",
            header: ({ table }: { table: any }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => {
                        table.getRowModel().rows.forEach((row: any) => {
                            const m = row.original;
                            const isPending = pendingSerials.includes(m.serialNumber);
                            const isMaintenance = isMaintenanceStatus(m.status);
                            if (!isPending && !isMaintenance) {
                                row.toggleSelected(!!value);
                            }
                        });
                    }}
                    aria-label="Select all"
                    className="border-slate-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary ml-2 h-5 w-5"
                />
            ),
            cell: ({ row }: { row: any }) => {
                const m = row.original;
                const isPending = pendingSerials.includes(m.serialNumber);
                const isMaintenance = isMaintenanceStatus(m.status);

                return (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        disabled={isPending || isMaintenance}
                        className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary ml-2 h-5 w-5"
                    />
                );
            },
            enableSorting: false,
            enableHiding: false,
        });
    }

    columns.push(
        {
            accessorKey: "serialNumber",
            header: "السيريال (S/N)",
            cell: ({ row }: { row: any }) => {
                const serial = row.getValue("serialNumber") as string;
                const isPending = pendingSerials.includes(serial);
                const isMaintenance = isMaintenanceStatus(row.original.status);
                return (
                    <div className="flex items-center gap-2 text-right font-mono">
                        <span className="font-bold text-blue-600 text-base">{serial}</span>
                        {isPending && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">قيد التحويل</Badge>}
                        {isMaintenance && <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 text-[10px]">في الصيانة</Badge>}
                    </div>
                );
            }
        },
        {
            accessorKey: "model",
            header: "الموديل",
            cell: ({ row }: { row: any }) => {
                const model = row.getValue("model") as string;
                const machine = row.original;
                if (!model || model === '-') {
                    return (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1 p-0 h-auto"
                            onClick={() => handlers.onAddParameter(machine)}
                        >
                            <AlertTriangle size={14} />
                            غير معروف
                        </Button>
                    );
                }
                return <span className="font-medium text-slate-700">{model}</span>;
            }
        },
        {
            accessorKey: "manufacturer",
            header: "المصنع",
        },
        {
            accessorKey: "importDate",
            header: "تاريخ الإضافة",
            cell: ({ row }: { row: any }) => {
                const date = row.getValue("importDate") as string;
                return <span className="font-mono text-slate-500 whitespace-nowrap">{new Date(date).toLocaleDateString('en-CA')}</span>;
            }
        },
        {
            accessorKey: "notes",
            header: "ملاحظات",
            cell: ({ row }: { row: any }) => {
                const notes = row.getValue("notes") as string;
                return <div className="max-w-[150px] truncate text-slate-400 text-[10px]" title={notes}>{notes || '-'}</div>;
            }
        },
        {
            accessorKey: "complaint",
            header: "الشكوى",
            cell: ({ row }: { row: any }) => {
                const complaint = row.getValue("complaint") as string;
                return (
                    <div className="max-w-[200px]" title={complaint}>
                        {complaint ? (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 line-clamp-2">{complaint}</span>
                        ) : (
                            <span className="text-slate-300 text-xs">-</span>
                        )}
                    </div>
                );
            }
        }
    );

    if (!isAffairs && !isCenterManager) {
        columns.push({
            id: "actions",
            header: "",
            cell: ({ row }: { row: any }) => {
                const m = row.original;
                const isPending = pendingSerials.includes(m.serialNumber);
                if (isPending) return null;

                // Check for frozen statuses
                if (m.status === 'AT_CENTER' || m.status === 'EXTERNAL_REPAIR') {
                    return (
                        <div className="flex items-center justify-end">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap">
                                في الصيانة الخارجية
                            </Badge>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center justify-end gap-1">
                        {activeTab === 'NEW' && (
                            <Button variant="ghost" size="icon" onClick={() => handlers.onSell(m)} title="بيع" className="h-8 w-8">
                                <ShoppingCart size={16} className="text-slate-400 hover:text-emerald-600" />
                            </Button>
                        )}
                        {(activeTab === 'CLIENT_REPAIR' || (activeTab === 'REPAIRED' && m.customerId)) && (
                            <Button variant="ghost" size="icon" onClick={() => handlers.onReturnToCustomer(m)} title="إرجاع للعميل" className="h-8 w-8">
                                <UserCheck size={16} className="text-slate-400 hover:text-emerald-600" />
                            </Button>
                        )}
                        {((activeTab === 'STANDBY' || activeTab === 'REPAIRED') && !m.customerId) && (
                            <Button variant="ghost" size="icon" onClick={() => handlers.onExchange(m)} title="استبدال" className="h-8 w-8">
                                <RotateCcw size={16} className="text-slate-400 hover:text-blue-600" />
                            </Button>
                        )}
                        {activeTab === 'DEFECTIVE' && (
                            <Button variant="ghost" size="icon" onClick={() => handlers.onRepair(m)} title="إصلاح" className="h-8 w-8">
                                <CheckCircle size={16} className="text-slate-400 hover:text-blue-600" />
                            </Button>
                        )}
                    </div>
                );
            }
        });
    }

    return columns;
};
