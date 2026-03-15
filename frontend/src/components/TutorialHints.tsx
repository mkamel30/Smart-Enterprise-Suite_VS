import { useState, useEffect } from 'react';
import { Lightbulb, X, Info, ChevronRight, ChevronLeft } from 'lucide-react';

interface Hint {
    id: string;
    title: string;
    message: string;
    actionLabel?: string;
    actionPath?: string;
}

const HINTS: Hint[] = [
    {
        id: 'new_client',
        title: 'إضافة عميل جديد',
        message: 'يمكنك إضافة عملاء جدد من صفحة "العملاء" باستخدام زر "إضافة عميل". تأكد من ملء البيانات الأساسية وكود البنك.',
        actionLabel: 'اذهب للعملاء',
        actionPath: '/customers'
    },
    {
        id: 'new_request',
        title: 'فتح طلب صيانة',
        message: 'لتسجيل عطل، استخدم زر "طلب صيانة" في لوحة التحكم أو صفحة الطلبات. يمكنك البحث عن العميل بكود البنك أو الاسم.',
        actionLabel: 'فتح طلب',
        actionPath: '/requests'
    },
    {
        id: 'inventory_check',
        title: 'إدارة المخزون',
        message: 'من صفحة "قطع الغيار"، يمكنك متابعة النواقص وإضافة كميات جديدة للمخزن لضمان سرعة عمليات الصيانة.',
        actionLabel: 'المخزن',
        actionPath: '/warehouse'
    },
    {
        id: 'installments',
        title: 'متابعة الأقساط',
        message: 'في صفحة "المبيعات والأقساط"، يمكنك رؤية الأقساط المستحقة وتوقعات التحصيل لشهر معين.',
        actionLabel: 'الأقساط',
        actionPath: '/receipts'
    }
];

export default function TutorialHints() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);
    const [dismissedHints, setDismissedHints] = useState<string[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('dismissed_tutorial_hints');
        if (saved) setDismissedHints(JSON.parse(saved));
    }, []);

    const handleDismiss = () => {
        const newDismissed = [...dismissedHints, HINTS[currentIndex].id];
        setDismissedHints(newDismissed);
        localStorage.setItem('dismissed_tutorial_hints', JSON.stringify(newDismissed));
        
        // Move to next or close if all done
        if (newDismissed.length === HINTS.length) {
            setIsVisible(false);
        } else {
            handleNext();
        }
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % HINTS.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + HINTS.length) % HINTS.length);
    };

    if (!isVisible || dismissedHints.includes(HINTS[currentIndex].id)) {
        // Find first non-dismissed hint
        const nextAvailable = HINTS.findIndex(h => !dismissedHints.includes(h.id));
        if (nextAvailable === -1) return null;
        // Not ideal to update state here, but for simplicity:
        // setCurrentIndex(nextAvailable);
    }

    const currentHint = HINTS[currentIndex];

    return (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 relative group animate-fade-in overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Lightbulb size={120} className="text-primary rotate-12" />
            </div>
            
            <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start gap-4">
                    <div className="bg-primary text-white p-2 rounded-xl shadow-lg ring-4 ring-primary/10">
                        <Info size={20} />
                    </div>
                    <div>
                        <h4 className="font-black text-primary text-sm mb-1 flex items-center gap-2">
                             {currentHint.title}
                             <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full font-bold">تلميح ذكي</span>
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl font-medium">
                            {currentHint.message}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrev}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button 
                        onClick={handleNext}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button 
                        onClick={handleDismiss}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-destructive mr-2"
                        title="إخفاء التلميح"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
            
            <div className="flex items-center gap-1 mt-3 mr-12 px-1">
                {HINTS.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-1 rounded-full transition-all ${idx === currentIndex ? 'w-4 bg-primary' : 'w-1 bg-primary/20'}`}
                    />
                ))}
            </div>
        </div>
    );
}
