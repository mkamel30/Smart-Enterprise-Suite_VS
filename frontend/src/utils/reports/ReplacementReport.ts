interface ReplacementReportProps {
    customer: any;
    incomingMachine: any; // The one returning to warehouse
    outgoingMachine: any; // The one going to client
    notes: string;
    status: string;
}

export function generateReplacementReport(props: ReplacementReportProps): string {
    const { customer, incomingMachine, outgoingMachine, notes, status } = props;
    const dateStr = new Date().toLocaleDateString('ar-EG');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Replacement_${customer.bkcode || 'Client'}_${timestamp}`;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Tahoma, sans-serif; font-size: 10pt; line-height: 1.4; background: #fff; }
        .sheet { margin: 0 auto; width: 210mm; min-height: 297mm; padding: 10mm; position: relative; }
        .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #333; padding: 10px; text-align: center; z-index: 1000; }
        .btn { background: #fff; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 0 5px; font-weight: bold; }
        .btn:hover { background: #f0f0f0; }
        @media print { .toolbar { display: none !important; } .sheet { width: 100%; margin: 0; padding: 0.5cm; } }
        
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a237e; padding-bottom: 8px; margin-bottom: 20px; }
        .logo img { width: 120px; }
        .header-center { text-align: center; flex: 1; }
        .header-center h1 { font-size: 18pt; color: #1a237e; margin-bottom: 5px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
        .info-title { font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; color: #1a237e; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        
        .status-box { padding: 10px; background: #fff3e0; border: 1px solid #ffe0b2; border-radius: 4px; margin-bottom: 20px; }
        .notes-box { padding: 10px; background: #f5f5f5; border: 1px solid #e0e0e0; min-height: 60px; margin-bottom: 20px; }
        
        .declaration { font-size: 9pt; padding: 15px; background: #fafafa; border: 1px solid #ddd; line-height: 1.6; text-align: justify; margin-bottom: 30px; }
        
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .sig-box { width: 45%; text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-top: 40px; width: 80%; margin-left: auto; margin-right: auto; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="window.print()" class="btn">طباعة</button>
    </div>

    <div class="sheet">
        <div class="header">
            <div class="header-info">
                <div>التاريخ: ${dateStr}</div>
            </div>
            <div class="header-center">
                <h1>تقرير استبدال ماكينة</h1>
            </div>
            <div class="logo">
                <img src="/logo.png" alt="شركة سمارت" onerror="this.outerHTML='<b>شركة سمارت</b>'" />
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box">
                <div class="info-title">بيانات العميل</div>
                <div class="info-row"><span>الاسم:</span> <strong>${customer.client_name}</strong></div>
                <div class="info-row"><span>الكود:</span> <strong>${customer.bkcode}</strong></div>
                <div class="info-row"><span>العنوان:</span> <strong>${customer.address || '-'}</strong></div>
            </div>
            <div class="info-box">
                <div class="info-title">بيانات الاستبدال</div>
                <div class="info-row"><span>تاريخ الحركة:</span> <strong>${dateStr}</strong></div>
                <div class="info-row"><span>السبب:</span> <strong>${status === 'DEFECTIVE' ? 'عطل (تالف)' : status === 'STANDBY' ? 'استبدال عادي' : 'صيانة'}</strong></div>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box" style="background: #e8f5e9; border-color: #c8e6c9;">
                <div class="info-title" style="color: #2e7d32;">الماكينة المصروفة (الجديدة)</div>
                <div class="info-row"><span>السيريال:</span> <strong style="font-family:monospace;font-size:1.1em">${outgoingMachine.serialNumber}</strong></div>
                <div class="info-row"><span>الموديل:</span> <strong>${outgoingMachine.model}</strong></div>
                <div class="info-row"><span>المصنع:</span> <strong>${outgoingMachine.manufacturer}</strong></div>
            </div>
            <div class="info-box" style="background: #ffebee; border-color: #ffcdd2;">
                <div class="info-title" style="color: #c62828;">الماكينة المرتجعة (القديمة)</div>
                <div class="info-row"><span>السيريال:</span> <strong style="font-family:monospace;font-size:1.1em">${incomingMachine.serialNumber}</strong></div>
                <div class="info-row"><span>الموديل:</span> <strong>${incomingMachine.model}</strong></div>
                <div class="info-row"><span>المصنع:</span> <strong>${incomingMachine.manufacturer || '-'}</strong></div>
            </div>
        </div>

        <div class="section">
            <div class="info-title">ملاحظات / وصف العطل للماكينة المرتجعة:</div>
            <div class="notes-box">
                ${notes || 'لا توجد ملاحظات'}
            </div>
        </div>

        <div class="declaration">
            <strong>إقرار استلام:</strong>
            <br>
            أقر أنا الموقع أدناه باستلام الماكينة الموضحة بياناتها "الماكينة المصروفة" بحالة جيدة وصالحة للعمل، وتسليم الماكينة الموضحة بياناتها "الماكينة المرتجعة" لشركة سمارت.
            وعليه أوقع.
        </div>

        <div class="signatures">
            <div class="sig-box">
                <div><strong>استلام العميل</strong></div>
                <div>${customer.client_name}</div>
                <div class="sig-line">التوقيع</div>
            </div>
            <div class="sig-box">
                <div><strong>مسئول المخزن / التسليم</strong></div>
                <div>____________________</div>
                <div class="sig-line">التوقيع</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

export function openReplacementReport(props: ReplacementReportProps) {
    const html = generateReplacementReport(props);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
}
