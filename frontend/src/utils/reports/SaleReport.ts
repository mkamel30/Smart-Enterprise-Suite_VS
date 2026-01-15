import { getReportStyles, getReportSidebar, getReportScripts } from './SharedReportUtils';

interface SaleReportProps {
    sale: any;
    installments: any[];
}

export function generateSaleReport(props: SaleReportProps): string {
    const { sale, installments } = props;
    const customer = sale.customer;
    const dateStr = new Date(sale.saleDate).toLocaleDateString('ar-EG');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Sale_${customer.bkcode || 'Client'}_${timestamp}`;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <style>
        ${getReportStyles()}
        
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Tahoma, sans-serif; font-size: 10pt; line-height: 1.4; background: #fff; }
        .sheet { margin: 0 auto; width: 210mm; min-height: 297mm; padding: 10mm; position: relative; }
        
        @media print { .sheet { width: 100%; margin: 0; padding: 0.5cm; } }
        
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a237e; padding-bottom: 8px; margin-bottom: 20px; }
        .logo img { width: 120px; }
        .header-center { text-align: center; flex: 1; }
        .header-center h1 { font-size: 18pt; color: #1a237e; margin-bottom: 5px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
        .info-title { font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; color: #1a237e; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        
        .table-container { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: center; }
        th { background: #f5f5f5; color: #1a237e; }
        
        .totals-box { width: 40%; margin-right: auto; border: 1px solid #ddd; padding: 10px; background: #f9f9f9; }
        
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .sig-box { width: 45%; text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-top: 40px; width: 80%; margin-left: auto; margin-right: auto; }
    </style>
</head>
<body>
    ${getReportSidebar()}

    <div class="sheet" id="report-content">
        <div class="header">
            <div class="header-info">
                <div>التاريخ: ${dateStr}</div>
            </div>
            <div class="header-center">
                <h1>عقد بيع / استلام ماكينة</h1>
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
                <div class="info-title">بيانات الماكينة</div>
                <div class="info-row"><span>السيريال:</span> <strong style="font-family:monospace;font-size:1.1em">${sale.serialNumber}</strong></div>
                <div class="info-row"><span>الموديل:</span> <strong>${sale.model || '-'}</strong></div>
                <div class="info-row"><span>الشركة المصنعة:</span> <strong>${sale.manufacturer || '-'}</strong></div>
                <div class="info-row"><span>نوع البيع:</span> <strong>${sale.type === 'CASH' ? 'كاش' : 'تقسيط'}</strong></div>
            </div>
        </div>

        <div class="table-container">
            <div class="info-title">تفاصيل الدفع</div>
            <table>
                <thead>
                    <tr>
                        <th>إجمالي السعر</th>
                        <th>المدفوع (مقدم / كامل)</th>
                        <th>الباقي</th>
                        <th>طريقة الدفع</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${sale.totalPrice}</td>
                        <td>${sale.paidAmount}</td>
                        <td>${sale.totalPrice - sale.paidAmount}</td>
                        <td>${sale.paymentMethod || '-'}</td>
                        <td>${sale.notes || '-'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${installments && installments.length > 0 ? `
        <div style="display: flex; gap: 20px; margin-bottom: 15px;">
            <div style="flex: 1; background: #e8f5e9; border: 1px solid #a5d6a7; padding: 10px; border-radius: 4px; text-align: center;">
                <div style="font-size: 9pt; color: #2e7d32;">المقدم المدفوع</div>
                <div style="font-size: 14pt; font-weight: bold; color: #1b5e20;">${sale.paidAmount.toLocaleString()} ج.م</div>
            </div>
            <div style="flex: 1; background: #fff3e0; border: 1px solid #ffcc80; padding: 10px; border-radius: 4px; text-align: center;">
                <div style="font-size: 9pt; color: #e65100;">المتبقي (أقساط)</div>
                <div style="font-size: 14pt; font-weight: bold; color: #bf360c;">${(sale.totalPrice - sale.paidAmount).toLocaleString()} ج.م</div>
            </div>
            <div style="flex: 1; background: #e3f2fd; border: 1px solid #90caf9; padding: 10px; border-radius: 4px; text-align: center;">
                <div style="font-size: 9pt; color: #1565c0;">عدد الأقساط</div>
                <div style="font-size: 14pt; font-weight: bold; color: #0d47a1;">${installments.length} قسط</div>
            </div>
        </div>
        <div class="table-container">
            <div class="info-title">جدول الأقساط</div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>تاريخ الاستحقاق</th>
                        <th>المبلغ</th>
                        <th>الوصف</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${installments.map((inst: any, idx: number) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${new Date(inst.dueDate).toLocaleDateString('ar-EG')}</td>
                        <td>${inst.amount.toLocaleString()}</td>
                        <td>${inst.description}</td>
                        <td>${inst.isPaid ? 'تم الدفع' : 'مستحق'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="declaration" style="font-size: 9pt; padding: 15px; background: #fafafa; border: 1px solid #ddd; line-height: 1.6; text-align: justify; margin-bottom: 30px;">
            <strong>إقرار استلام:</strong>
            <br>
            أقر أنا الموقع أدناه باستلام الماكينة الموضحة بياناتها أعلاه بحالة جيدة وصالحة للعمل، وأوافق على شروط الضمان والدفع الموضحة.
            ${sale.type === 'INSTALLMENT' ? '<br>كما أتعهد بدفع الأقساط في مواعيدها المحددة أعلاه.' : ''}
            وعليه أوقع.
        </div>

        <div class="signatures">
            <div class="sig-box">
                <div><strong>استلام العميل</strong></div>
                <div>${customer.client_name}</div>
                <div class="sig-line">التوقيع</div>
            </div>
            <div class="sig-box">
                <div><strong>مسئول المبيعات</strong></div>
                <div>____________________</div>
                <div class="sig-line">التوقيع</div>
            </div>
        </div>
    </div>
    ${getReportScripts(filename)}
</body>
</html>
    `;
}

export function openSaleReport(props: SaleReportProps) {
    const html = generateSaleReport(props);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
}
