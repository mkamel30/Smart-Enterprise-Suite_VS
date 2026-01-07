interface MaintenanceReceiptProps {
    request: any; // The created request object
    customerName: string;
    serialNumber: string;
    model: string;
    receiptDate?: string;
}

export function generateMaintenanceReceipt(props: MaintenanceReceiptProps): string {
    const { request, customerName, serialNumber, model, receiptDate } = props;
    const dateStr = receiptDate || new Date().toLocaleDateString('ar-EG');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Receipt_${request?.customerId || 'Client'}_${timestamp}`;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <style>
        @page { size: A5 landscape; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Tahoma, sans-serif; font-size: 11pt; line-height: 1.5; background: #fff; padding: 20px; }
        .sheet { margin: 0 auto; width: 100%; max-width: 210mm; min-height: 148mm; border: 2px solid #333; padding: 15px; position: relative; }
        .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #333; padding: 10px; text-align: center; z-index: 1000; }
        .btn { background: #fff; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 0 5px; font-weight: bold; }
        .btn:hover { background: #f0f0f0; }
        @media print { .toolbar { display: none !important; } .sheet { border: none; padding: 0; } }

        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .logo img { width: 80px; }
        .header-center { text-align: center; flex: 1; }
        .header-center h1 { font-size: 18pt; margin-bottom: 5px; }
        .header-center h2 { font-size: 14pt; font-weight: normal; }

        .content { display: display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
        .content > .col { flex: 1; min-width: 200px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; display: inline-block; width: 100px; }
        .value { border-bottom: 1px dotted #000; padding: 0 10px; min-width: 150px; display: inline-block; }

        .notes-box { border: 1px solid #ccc; padding: 10px; height: 80px; margin-bottom: 20px; }

        .footer { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; }
        .sig-line { border-top: 1px solid #000; width: 150px; margin: 40px auto 0; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="window.print()" class="btn">طباعة</button>
    </div>

    <div class="sheet">
        <div class="header">
            <div class="date">التاريخ: ${dateStr}</div>
            <div class="header-center">
                <h1>إيصال استلام ماكينة للصيانة</h1>
                <h2>Maintenance Receipt</h2>
            </div>
            <div class="logo">
                 <img src="/logo.png" alt="شركة سمارت" onerror="this.outerHTML='<b>شركة سمارت</b>'" />
            </div>
        </div>

        <div class="content">
            <div class="col">
                <div class="field">
                    <span class="label">اسم العميل:</span>
                    <span class="value">${customerName}</span>
                </div>
                <div class="field">
                    <span class="label">موديل الماكينة:</span>
                    <span class="value">${model || '-'}</span>
                </div>
                <div class="field">
                    <span class="label">السيريال:</span>
                    <span class="value" style="font-family: monospace; font-size: 1.1em;">${serialNumber}</span>
                </div>
            </div>
            <div class="col">
                <div class="field">
                    <span class="label">رقم الطلب:</span>
                    <span class="value">#${request?.id?.slice(-6) || 'Pending'}</span>
                </div>
                 <div class="field">
                    <span class="label">المرفقات:</span>
                    <span class="value">...................................</span>
                </div>
            </div>
        </div>

        <div class="field" style="width: 100%;">
            <span class="label" style="width: auto; margin-left: 10px;">وصف العطل (شكوى العميل):</span>
            <div class="notes-box">
                ${request?.complaint || ''}
            </div>
        </div>

        <div class="footer">
            <div>
                <strong>توقيع المستلم (الشركة)</strong>
                <div class="sig-line"></div>
            </div>
            <div>
                <strong>توقيع العميل</strong>
                <div class="sig-line"></div>
            </div>
        </div>
        
        <div style="margin-top: 20px; font-size: 9pt; text-align: center; color: #666;">
            * هذا الإيصال يثبت استلام الماكينة للصيانة فقط ولا يعتبر تسليماً نهائياً للماكينة بحالة جيدة.
        </div>
    </div>
</body>
</html>
    `;
}

export function openMaintenanceReceipt(props: MaintenanceReceiptProps) {
    const html = generateMaintenanceReceipt(props);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
}
