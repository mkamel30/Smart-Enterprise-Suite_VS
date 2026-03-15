import React from 'react';
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
import { CheckCircle2, AlertCircle, X, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface SmartConfirmProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'primary' | 'danger' | 'warning' | 'success';
}

export default function SmartConfirm({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "نعم، تأكيد",
    cancelText = "إلغاء",
    variant = 'primary'
}: SmartConfirmProps) {
    const variantConfig = {
        primary: {
            icon: <HelpCircle className="text-primary" size={32} />,
            bg: "bg-primary/10",
            button: "bg-primary hover:bg-primary/90 shadow-primary/20",
            border: "border-primary/20"
        },
        danger: {
            icon: <AlertCircle className="text-rose-500" size={32} />,
            bg: "bg-rose-50",
            button: "bg-rose-600 hover:bg-rose-700 shadow-rose-200",
            border: "border-rose-100"
        },
        warning: {
            icon: <AlertCircle className="text-amber-500" size={32} />,
            bg: "bg-amber-50",
            button: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",
            border: "border-amber-100"
        },
        success: {
            icon: <CheckCircle2 className="text-emerald-500" size={32} />,
            bg: "bg-emerald-50",
            button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
            border: "border-emerald-100"
        }
    };

    const config = variantConfig[variant];

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
                <div className={cn("p-8 flex flex-col items-center text-center space-y-4", config.bg)}>
                    <div className="p-4 bg-white rounded-[1.5rem] shadow-xl shadow-black/5 animate-in zoom-in-95 duration-500">
                        {config.icon}
                    </div>
                    <div className="space-y-2">
                        <AlertDialogTitle className="text-xl font-black text-slate-900">
                            {title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-bold leading-relaxed px-4">
                            {description}
                        </AlertDialogDescription>
                    </div>
                </div>

                <AlertDialogFooter className="p-6 bg-white flex gap-3 sm:flex-row-reverse sm:justify-center sm:space-x-0">
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        className={cn(
                            "flex-[2] h-12 rounded-xl font-black text-white shadow-lg transition-all active:scale-95",
                            config.button
                        )}
                    >
                        {confirmText}
                    </AlertDialogAction>
                    <AlertDialogCancel
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-95 m-0"
                    >
                        {cancelText}
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
