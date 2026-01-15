import { getReportStyles, getReportSidebar, getReportScripts } from './SharedReportUtils';

interface PrintReportProps {
    request: any;
    usedParts?: any[];
    totalCost?: number;
    monthlyRepairCount?: number;
}

export function generateMaintenanceReport(props: PrintReportProps): string {
    const { request, usedParts = [], totalCost = 0, monthlyRepairCount = 1 } = props;

    const customer = request.customer || {};
    const machine = request.posMachine || {};

    // Format dates and times
    const now = new Date();
    const entryDate = request.createdAt ? new Date(request.createdAt) : now;
    const exitDate = request.closedAt ? new Date(request.closedAt) : now;

    // Check if entry and exit are on the same day
    const isSameDay = entryDate.toDateString() === exitDate.toDateString();

    let entryExitDisplay: string;
    if (isSameDay) {
        // Same day - show only times
        const timeIn = entryDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const timeOut = exitDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        entryExitDisplay = `دخول: ${timeIn} | خروج: ${timeOut}`;
    } else {
        // Different days - show full date and time for each
        const entryDateTimeStr = entryDate.toLocaleString('ar-EG', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const exitDateTimeStr = exitDate.toLocaleString('ar-EG', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        entryExitDisplay = `دخول: ${entryDateTimeStr} | خروج: ${exitDateTimeStr}`;
    }

    const dateStr = now.toLocaleDateString('ar-EG');

    // Parts summary
    const paidParts = usedParts.filter(p => p.isPaid);
    const freeParts = usedParts.filter(p => !p.isPaid);

    const paidPartsText = paidParts.map(p => `${p.name} (${p.quantity})`).join(' | ');
    const freePartsText = freeParts.map(p => `${p.name} (${p.quantity})`).join(' | ');

    // Dynamic service type
    let serviceType = '';
    if (usedParts.length === 0) {
        serviceType = 'صيانة بدون تغيير قطع غيار';
    } else if (paidParts.length > 0 && freeParts.length > 0) {
        serviceType = `صيانة مجانية ومدفوعة - المبلغ المدفوع: ${totalCost} جنيه`;
    } else if (paidParts.length > 0) {
        serviceType = `صيانة مدفوعة - المبلغ المدفوع: ${totalCost} جنيه`;
    } else {
        serviceType = 'صيانة مجانية';
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    // Use customer bkcode for filename
    const customerCode = customer.bkcode || 'Client';
    const filename = `Report_${customerCode}_${request.id?.slice(-5)}_${timestamp}`;



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
        body {
            font-family: Arial, Tahoma, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            background: #fff;
        }
        .sheet {
            margin: 0 auto;
            width: 210mm;
            min-height: 297mm;
            padding: 10mm;
            position: relative;
        }

        /* Print Override */
        @media print {
            .sheet { width: 100%; margin: 0; padding: 0.5cm; }
            @page { margin: 0; }
        }

        /* Report styles */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1a237e;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        .logo img { width: 120px; height: auto; }
        .header-center { text-align: center; flex: 1; }
        .header-center h1 { font-size: 16pt; color: #1a237e; margin-bottom: 3px; }
        .header-info { font-size: 9pt; }
        .info-table { width: 100%; margin-bottom: 10px; border-collapse: collapse; font-size: 9pt; }
        .info-table td { padding: 5px 8px; border: 1px solid #ccc; }
        .info-table .label { font-weight: bold; background: #f5f5f5; width: 110px; }
        .section { margin-bottom: 10px; }
        .section-title { font-weight: bold; font-size: 10pt; margin-bottom: 4px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 2px; }
        .section-content { padding: 8px; border: 1px solid #e0e0e0; background: #fff; min-height: 30px; font-size: 9pt; border-radius: 2px; }
        .parts-free { color: #2196F3; font-weight: bold; margin-top: 5px; }
        .parts-paid { color: #c62828; font-weight: bold; margin-top: 5px; }
        .service-type {
            font-weight: bold; padding: 10px; background: #e8f5e9;
            border: 1px solid #4caf50; margin-bottom: 10px; font-size: 10pt;
            border-radius: 4px;
            text-align: center;
        }
        .receipt { color: #1565c0; margin-right: 10px; }
        .declaration {
            font-size: 8pt; padding: 10px; border: 1px solid #ddd;
            margin-bottom: 10px; background: #fafafa; line-height: 1.6;
            text-align: justify;
            border-radius: 2px;
        }
        .signature-section { display: flex; justify-content: space-between; margin-top: 15px; }
        .signature-box { width: 48%; padding: 10px; border: 1px solid #ddd; font-size: 9pt; border-radius: 2px; }
        .signature-box h4 { font-size: 9pt; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; }
        .footer { margin-top: 15px; padding-top: 10px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 8pt; color: #666; }
    </style>
</head>
<body>
    ${getReportSidebar()}

<div class="sheet" id = "report-content" >
    <div class="header" >
        <div class="header-info" >
            <div><strong>رقم الطلب: </strong> ${request.id?.slice(-5) || '00000'}</div >
                <div>${entryExitDisplay} </div>
                    </div>
                    < div class="header-center" >
                        <h1>تقرير صيانة </h1>
                            < div > التاريخ: ${dateStr} </div>
                                </div>
                                < div class="logo" >
                                    <img src="/logo.png" alt = "شركة سمارت" onerror = "this.outerHTML='<div style=\\'font-size:16pt;font-weight:bold;color:#1a237e\\'>شركة سمارت</div>'" />
                                        </div>
                                        </div>

                                        < table class="info-table" >
                                            <tr>
                                            <td class="label" > صاحب النشاط: </td>
                                                < td > ${customer.client_name || '-'} </td>
                                                    < td class="label" > الرقم القومي: </td>
                                                        < td > ${customer.national_id || '-'} </td>
                                                            </tr>
                                                            < tr >
                                                            <td class="label" > التليفون: </td>
                                                                < td > ${customer.telephone_1 || customer.phone || '-'} </td>
                                                                    < td class="label" > العنوان: </td>
                                                                        < td > ${customer.address || '-'} </td>
                                                                            </tr>
                                                                            < tr >
                                                                            <td class="label" > كود النشاط: </td>
                                                                                < td > ${customer.bkcode || '-'} </td>
                                                                                    < td class="label" > مسلسل الماكينة: </td>
                                                                                        < td > ${machine.serialNumber || '-'} </td>
                                                                                            </tr>
                                                                                            </table>

                                                                                            < div class="section" >
                                                                                                <div class="section-title" > توصيف العطل: </div>
                                                                                                    < div class="section-content" > ${request.complaint || '-'} </div>
                                                                                                        </div>

                                                                                                        < div class="section" >
                                                                                                            <div class="section-title" > الإجراء: </div>
                                                                                                                < div class="section-content" >
                                                                                                                    ${request.actionTaken || '-'}
                ${freePartsText ? `<div class="parts-free">تغيير (مجاني): ${freePartsText}</div>` : ''}
                ${paidPartsText ? `<div class="parts-paid">تغيير (بمقابل): ${paidPartsText}</div>` : ''}
</div>
    </div>

    < div class="service-type" >
        ${serviceType}
            ${request.receiptNumber ? `<span class="receipt"> | رقم إيصال السداد: ${request.receiptNumber}</span>` : ''}
</div>

    < div class="section" >
        <div class="section-content" style = "min-height:auto;border:none;background:none;padding:0;" >
            تم الكشف على الماكينة والتأكد من صلاحيتها للعمل وعدم وجود أعطال أخرى.
            </div>
                </div>

                < div class="declaration" >
                    <strong>إقرار وتعهد: </strong> أنا / _________________ رقم قومي / _________________ صفة / _________________
            بأن جميع البيانات المذكورة بالتقرير أعلاه صحيحة وأتعهد بسداد كافة تكاليف الإصلاح إن وجد في حالة أن العطل ناتج عن سوء استخدام.
            تم استلام الماكينة من العميل وإعادة تسليمها بعد إجراء الصيانة بتاريخ تحرير هذا التقرير.< br > <br>
    <strong>المقر بما فيه: </strong> الاسم / _________________ التوقيع / _________________
        </div>

        < div class="signature-section" >
            <div class="signature-box" >
                <h4>مسئول الصيانة </h4>
                    < div > الاسم / ${request.technician || '_______________'} </div>
                        < div style = "margin-top:20px;border-bottom:1px solid #000;width:80%" > </div>
                            < div style = "margin-top:5px" > التوقيع </div>
                                </div>
                                < div class="signature-box" >
                                    <h4>مراجعة تحويل الماكينة </h4>
                                        < div style = "margin-bottom:10px" >☐ مراجعة تحويل الماكينة </div>
                                            < div style = "margin-top:15px" > رقم الإيصال ................................</div>
                                                </div>
                                                </div>

                                                < div class="footer" >
                                                    <div>عدد مرات الإصلاح خلال الشهر: <strong>${monthlyRepairCount} </strong></div >
                                                        <div>${dateStr} </div>
                                                            </div>
                                                            </div>

                                                            ${getReportScripts(filename)}
</body>
    </html>
        `;
}

export function openMaintenanceReport(request: any, usedParts?: any[], totalCost?: number, monthlyRepairCount?: number) {
    const html = generateMaintenanceReport({ request, usedParts, totalCost, monthlyRepairCount });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
}
