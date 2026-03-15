import { Package, Smartphone, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface InventoryProps {
    inventory: {
        machines: number;
        sims: number;
        outgoingTransfers: number;
        incomingTransfers: number;
    } | undefined;
}

export function InventorySnapshot({ inventory }: InventoryProps) {
    if (!inventory) return null;

    const items = [
        {
            label: 'أجهزة بالمخزن',
            value: inventory.machines,
            icon: <Package size={22} />,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
        },
        {
            label: 'شرائح بالمخزن',
            value: inventory.sims,
            icon: <Smartphone size={22} />,
            color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
        },
        {
            label: 'تحويلات صادرة',
            value: inventory.outgoingTransfers,
            icon: <ArrowUpRight size={22} />,
            color: 'bg-red-50 text-red-600 border-red-100'
        },
        {
            label: 'تحويلات واردة',
            value: inventory.incomingTransfers,
            icon: <ArrowDownRight size={22} />,
            color: 'bg-blue-50 text-blue-600 border-blue-100'
        }
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <Package size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800">حالة المخزون</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                    <div
                        key={item.label}
                        className={`border rounded-2xl p-5 text-center ${item.color}`}
                    >
                        <div className="flex justify-center mb-3">{item.icon}</div>
                        <p className="text-3xl font-black">{item.value}</p>
                        <p className="text-sm font-bold mt-1">{item.label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
