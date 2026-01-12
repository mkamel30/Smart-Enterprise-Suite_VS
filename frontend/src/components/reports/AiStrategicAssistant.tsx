import React, { useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import { api } from '../../api/client';

export function AiStrategicAssistant() {
    return (
        <div className="bg-card rounded-[3rem] border border-border shadow-2xl p-10 min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px] -mr-48 -mt-48" />

            <div className="text-center relative z-10">
                <div className="w-24 h-24 bg-purple-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-600/40 rotate-12 transition-transform hover:rotate-0 cursor-pointer">
                    <Sparkles size={48} />
                </div>
                <h2 className="text-3xl font-black text-foreground mb-4">المستشار الاستراتيجي الذكي</h2>
                <div className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600/10 text-purple-600 rounded-full text-sm font-black mb-8">
                    <Loader2 size={16} className="animate-spin" />
                    قريباً جداً
                </div>
                <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium text-lg">
                    نقوم حالياً بتطوير وتدريب المستشار الذكي ليتمكن من تقديم تحليلات دقيقة وشاملة حول أداء المؤسسة. ترقبوا الإطلاق قريباً!
                </p>
            </div>
        </div>
    );
}
