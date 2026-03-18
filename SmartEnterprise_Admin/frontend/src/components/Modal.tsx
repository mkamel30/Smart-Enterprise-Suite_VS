import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, subtitle, children, icon, maxWidth = 'max-w-md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-brand-primary/40 backdrop-blur-md animate-in fade-in duration-300">
      {/* Backdrop Click-to-Close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      {/* Modal Container */}
      <div className={`relative bg-white w-full ${maxWidth} max-h-[90vh] overflow-y-auto custom-scroll rounded-[2rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20 flex flex-col items-center p-8 sm:p-12 text-right font-arabic`} dir="rtl">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 sm:top-8 sm:left-8 text-slate-300 hover:text-brand-primary transition-colors p-2 hover:bg-slate-50 rounded-xl"
        >
          <X size={24} />
        </button>

        {/* Header Section */}
        <div className="w-full text-center mb-10">
          {icon && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 shrink-0">
              {icon}
            </div>
          )}
          <h3 className="font-black text-2xl sm:text-3xl text-brand-primary tracking-tight uppercase leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-2 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
