
export const getReportStyles = () => `
    /* Floating Sidebar Styles */
    .report-sidebar {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #e2e8f0;
        border-right: none;
        box-shadow: -4px 0 15px rgba(0,0,0,0.1);
        padding: 12px 8px;
        border-radius: 12px 0 0 12px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: all 0.3s ease;
        opacity: 0.4;
        backdrop-filter: blur(8px);
    }

    .report-sidebar:hover {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
        padding-right: 12px;
        box-shadow: -4px 0 25px rgba(0,0,0,0.15);
    }

    .sidebar-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        color: #64748b;
        transition: all 0.2s;
        min-width: 60px;
        gap: 4px;
    }

    .sidebar-btn:hover {
        background: #f1f5f9;
        color: #0f172a;
        transform: scale(1.05);
    }

    .sidebar-btn.print:hover { color: #2563eb; background: #eff6ff; }
    .sidebar-btn.pdf:hover { color: #dc2626; background: #fef2f2; }
    .sidebar-btn.close:hover { color: #475569; background: #f1f5f9; }

    .sidebar-btn svg {
        width: 24px;
        height: 24px;
        margin-bottom: 2px;
    }

    .sidebar-btn span {
        font-size: 10px;
        font-weight: bold;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    /* Print Media Query - Hide Sidebar */
    @media print {
        .report-sidebar {
            display: none !important;
        }
        body {
            background-color: white;
            margin: 0;
            padding: 0;
        }
    }
`;

export const getReportSidebar = () => `
    <div class="report-sidebar">
        <button onclick="window.print()" class="sidebar-btn print" title="طباعة (Ctrl+P)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>طباعة</span>
        </button>
        
        <button onclick="downloadPDF()" class="sidebar-btn pdf" title="حفظ كملف PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <span>PDF</span>
        </button>

        <div style="height: 1px; background: #e2e8f0; margin: 4px 0;"></div>

        <button onclick="window.close()" class="sidebar-btn close" title="إغلاق النافذة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>إغلاق</span>
        </button>
    </div>
`;

export const getReportScripts = (filename: string, elementId: string = 'report-content') => `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script>
        function downloadPDF() {
            // Select the element and clone it to remove any potential conflicts
            const element = document.getElementById('${elementId}');
            
            // PDF Options
            const opt = {
                margin: [0, 0, 0, 0], // Zero margins for full control
                filename: '${filename}.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    letterRendering: true
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: 'a4', 
                    orientation: 'portrait' 
                }
            };
            
            // Visual Feedback
            const btn = document.querySelector('.sidebar-btn.pdf');
            const originalContent = btn.innerHTML;
            
            btn.innerHTML = \`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span>جاري...</span>
            \`;
            btn.style.pointerEvents = 'none';

            // Generate
            html2pdf().set(opt).from(element).save().then(() => {
                // Restore Button
                btn.innerHTML = originalContent;
                btn.style.pointerEvents = 'auto';
            }).catch(err => {
                console.error('PDF Generation Error:', err);
                alert('حدث خطأ أثناء إنشاء ملف PDF');
                btn.innerHTML = originalContent;
                btn.style.pointerEvents = 'auto';
            });
        }
    </script>
`;
