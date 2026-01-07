import { AlertTriangle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './ui/alert-dialog';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    onConfirm,
    onCancel,
    type = 'danger'
}: ConfirmDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <AlertDialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-md" dir="rtl">
                <AlertDialogHeader className="bg-slate-50 p-6 pb-4 border-b shrink-0 text-center sm:text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                        <AlertTriangle size={24} />
                    </div>
                    <AlertDialogTitle className="text-lg font-bold text-slate-900">
                        {title}
                    </AlertDialogTitle>
                </AlertDialogHeader>
                <div className="flex-1 overflow-y-auto p-6 text-center">
                    <AlertDialogDescription className="text-slate-600 font-medium">
                        {message}
                    </AlertDialogDescription>
                </div>
                <AlertDialogFooter className="p-6 border-t bg-slate-50/50 shrink-0 flex-row gap-3 justify-center sm:justify-center">
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={`flex-1 font-bold ${type === 'danger'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                    >
                        {confirmText}
                    </AlertDialogAction>
                    <AlertDialogCancel
                        onClick={onCancel}
                        className="flex-1 font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 mt-0 sm:mt-0"
                    >
                        {cancelText}
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
