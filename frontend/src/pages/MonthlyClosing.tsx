import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, FileSpreadsheet, Printer, FileDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import PageHeader from '../components/PageHeader';

// Section Components
import { SalesSummary } from '../components/monthly-closing/SalesSummary';
import { InstallmentsSummary } from '../components/monthly-closing/InstallmentsSummary';
import { SparePartsSummary } from '../components/monthly-closing/SparePartsSummary';
import { InventorySnapshot } from '../components/monthly-closing/InventorySnapshot';
import { OverallSummary } from '../components/monthly-closing/OverallSummary';
import { ChildBranchReport } from '../components/monthly-closing/ChildBranchReport';

// Helpers
const formatMonth = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const getMonthLabel = (month: string) => {
    const [y, m] = month.split('-');
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${months[parseInt(m) - 1]} ${y}`;
};

export default function MonthlyClosing() {
    const { user } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(formatMonth(new Date()));
    const [activeSection, setActiveSection] = useState<'all' | 'sales' | 'installments' | 'parts' | 'inventory'>('all');
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['monthly-closing', selectedMonth, user?.branchId],
        queryFn: () => api.getMonthlyClosing(selectedMonth),
        enabled: !!selectedMonth
    });

    // Month navigation
    const navigateMonth = (dir: number) => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + dir, 1);
        setSelectedMonth(formatMonth(d));
    };

    const sections = [
        { key: 'all', label: 'عرض شامل' },
        { key: 'sales', label: '💰 المبيعات' },
        { key: 'installments', label: '📅 الأقساط' },
        { key: 'parts', label: '🔧 قطع الغيار' },
        { key: 'inventory', label: '📦 المخزون' }
    ];

    // =========== EXPORT TO EXCEL ===========
    const handleExportExcel = async () => {
        if (!data) return;
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        // Summary sheet (first)
        const summaryRows = [
            { 'البند': 'إجمالي إيرادات الشهر', 'القيمة (ج.م)': data.summary?.totalMonthlyRevenue || 0 },
            { 'البند': 'إجمالي المبيعات', 'القيمة (ج.م)': data.summary?.totalSalesValue || 0 },
            { 'البند': 'الأقساط المتأخرة', 'القيمة (ج.م)': data.summary?.totalOverdueAmount || 0 },
            { 'البند': 'قطع غيار بمقابل', 'القيمة (ج.م)': data.summary?.totalPaidParts || 0 },
            { 'البند': 'قطع غيار ضمان (القيمة الفعلية)', 'القيمة (ج.م)': data.summary?.totalFreeParts || 0 },
            { 'البند': 'إجمالي قيمة قطع الغيار', 'القيمة (ج.م)': data.summary?.totalPartsValue || 0 },
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'الملخص');

        // Sales sheet
        const salesRows = [
            ...(data.sales?.cash?.details || []).map((s: any) => ({
                'النوع': 'كاش', 'المسلسل': s.serialNumber, 'العميل': s.customerName,
                'كود العميل': s.customerCode, 'التاريخ': new Date(s.saleDate).toLocaleDateString('ar-EG'),
                'الإجمالي': s.totalPrice, 'المدفوع': s.paidAmount, 'الحالة': s.status
            })),
            ...(data.sales?.installment?.details || []).map((s: any) => ({
                'النوع': 'قسط', 'المسلسل': s.serialNumber, 'العميل': s.customerName,
                'كود العميل': s.customerCode, 'التاريخ': new Date(s.saleDate).toLocaleDateString('ar-EG'),
                'الإجمالي': s.totalPrice, 'المدفوع': s.paidAmount, 'الحالة': s.status
            }))
        ];
        if (salesRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'المبيعات');

        // Installments sheet
        const installRows = [
            ...(data.installments?.collected?.details || []).map((i: any) => ({
                'الحالة': 'محصّل', 'العميل': i.customerName, 'المبلغ': i.amount,
                'تاريخ الدفع': i.paidAt ? new Date(i.paidAt).toLocaleDateString('ar-EG') : '-',
                'رقم الإيصال': i.receiptNumber || '-'
            })),
            ...(data.installments?.overdue?.details || []).map((i: any) => ({
                'الحالة': 'متأخر', 'العميل': i.customerName, 'المبلغ': i.amount,
                'تاريخ الاستحقاق': new Date(i.dueDate).toLocaleDateString('ar-EG'),
                'أيام التأخير': i.daysOverdue
            }))
        ];
        if (installRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(installRows), 'الأقساط');

        // Spare Parts - Paid sheet
        const paidPartsRows = (data.spareParts?.paid?.details || []).map((p: any) => ({
            'القطعة': p.partName, 'الكمية': p.quantity, 'سعر الوحدة': p.unitCost,
            'الإجمالي': p.totalValue, 'العميل': p.customerName,
            'كود العميل': p.customerBkcode, 'الفني': p.technician,
            'التاريخ': new Date(p.closedAt).toLocaleDateString('ar-EG'),
            'رقم الإيصال': p.receiptNumber || '-'
        }));
        if (paidPartsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paidPartsRows), 'قطع غيار بمقابل');

        // Spare Parts - Free sheet
        const freePartsRows = (data.spareParts?.free?.details || []).map((p: any) => ({
            'القطعة': p.partName, 'الكمية': p.quantity, 'قيمة الوحدة': p.unitCost,
            'إجمالي القيمة': p.totalValue, 'العميل': p.customerName,
            'كود العميل': p.customerBkcode, 'الفني': p.technician,
            'التاريخ': new Date(p.closedAt).toLocaleDateString('ar-EG')
        }));
        if (freePartsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(freePartsRows), 'قطع غيار ضمان');

        // Top Consumed Parts sheet
        const topPartsRows = (data.spareParts?.topParts || []).map((t: any, idx: number) => ({
            'الترتيب': idx + 1,
            'القطعة': t.name,
            'إجمالي الكمية': t.totalQuantity,
            'إجمالي القيمة': t.totalCost,
            'مدفوع': t.paidCount,
            'ضمان': t.freeCount
        }));
        if (topPartsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topPartsRows), 'أكثر القطع استهلاكاً');

        XLSX.writeFile(wb, `تقرير_اقفال_${selectedMonth}.xlsx`);
    };

    // =========== EXPORT TO PDF ===========
    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);

        try {
            // Temporarily switch to 'all' to capture everything
            const prevSection = activeSection;
            setActiveSection('all');

            // Wait for re-render
            await new Promise(resolve => setTimeout(resolve, 500));

            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            const element = reportRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f8fafc',
                width: element.scrollWidth,
                height: element.scrollHeight,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', 'a4');
            let heightLeft = imgHeight;
            let position = 0;

            // First page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Additional pages
            while (heightLeft > 0) {
                position = -(imgHeight - heightLeft);
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`تقرير_اقفال_${selectedMonth}.pdf`);

            // Restore previous section
            setActiveSection(prevSection);
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    // Print
    const handlePrint = () => window.print();

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-500 font-black animate-pulse">جاري إعداد تقرير إقفال الشهر...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-red-500 font-bold text-xl">حدث خطأ أثناء تحميل التقرير</p>
                    <p className="text-slate-400">حاول مرة أخرى لاحقاً</p>
                </div>
            </div>
        );
    }

    const actionElements = (
        <div className="flex items-center gap-3">
            {/* Month Picker */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
                <button onClick={() => navigateMonth(-1)} className="text-slate-400 hover:text-indigo-600 transition-colors font-bold text-lg px-1">→</button>
                <div className="flex items-center gap-2 min-w-[140px] justify-center">
                    <CalendarDays size={18} className="text-indigo-500" />
                    <span className="font-black text-slate-700">{getMonthLabel(selectedMonth)}</span>
                </div>
                <button onClick={() => navigateMonth(1)} className="text-slate-400 hover:text-indigo-600 transition-colors font-bold text-lg px-1">←</button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 rounded-xl">
                <FileSpreadsheet size={16} />
                <span className="hidden md:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting} className="gap-2 rounded-xl">
                <FileDown size={16} />
                <span className="hidden md:inline">{isExporting ? 'جاري...' : 'PDF'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 rounded-xl print:hidden">
                <Printer size={16} />
                <span className="hidden md:inline">طباعة</span>
            </Button>
        </div>
    );

    return (
        <div className="page-container space-y-8 animate-fade-in bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title="تقرير إقفال الشهر"
                subtitle={`${data?.branch?.name || 'الفرع'} — ${getMonthLabel(selectedMonth)}`}
                actions={actionElements}
            />

            {/* Section Tabs */}
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto print:hidden">
                {sections.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setActiveSection(s.key as any)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSection === s.key
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Report Content (ref for PDF capture) */}
            <div ref={reportRef} className="space-y-8">
                {/* Overall Summary (always on top when 'all') */}
                {(activeSection === 'all') && <OverallSummary summary={data?.summary} />}

                {/* Sections */}
                {(activeSection === 'all' || activeSection === 'sales') && (
                    <SalesSummary sales={data?.sales} />
                )}
                {(activeSection === 'all' || activeSection === 'installments') && (
                    <InstallmentsSummary installments={data?.installments} />
                )}
                {(activeSection === 'all' || activeSection === 'parts') && (
                    <SparePartsSummary spareParts={data?.spareParts} />
                )}
                {(activeSection === 'all' || activeSection === 'inventory') && (
                    <InventorySnapshot inventory={data?.inventory} />
                )}

                {/* Child Branches */}
                {data?.hasChildBranches && data?.childBranches?.length > 0 && (
                    <ChildBranchReport childBranches={data.childBranches} month={selectedMonth} />
                )}
            </div>
        </div>
    );
}
