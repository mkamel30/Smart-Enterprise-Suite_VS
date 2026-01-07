import React, { useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import { api } from '../../api/client';

export function AiStrategicAssistant() {
    const [prompt, setPrompt] = useState('');
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setIsLoading(true);
        try {
            const data = await api.askAi(prompt);
            setAnswer(data.answer);
        } catch (err: any) {
            setAnswer("عذراً، حدث خطأ في التواصل مع المستشار الذكي.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-card rounded-[3rem] border border-border shadow-2xl p-10 min-h-[600px] flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px] -mr-48 -mt-48" />

            <div className="text-center mb-12 relative z-10">
                <div className="w-24 h-24 bg-purple-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-600/40 rotate-12 transition-transform hover:rotate-0 cursor-pointer">
                    <Sparkles size={48} />
                </div>
                <h2 className="text-3xl font-black text-foreground mb-4">المستشار الاستراتيجي الذكي</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                    يمكنك طرح استعلامات معقدة باللغة العربية حول أداء المؤسسة، الفروع، أو اتجاهات المبيعات وسأقوم بتحليلها فوراً.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto mb-8 space-y-6 custom-scroll pr-4">
                {answer && (
                    <div className="bg-purple-600/5 border border-purple-500/20 rounded-[2.5rem] p-8 relative animate-scale-in">
                        <div className="prose prose-purple max-w-none text-right whitespace-pre-wrap leading-relaxed text-foreground text-lg font-medium">
                            {answer}
                        </div>
                    </div>
                )}
                {isLoading && (
                    <div className="flex justify-center p-10">
                        <Loader2 className="animate-spin text-purple-600" size={40} />
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="relative z-10">
                <div className="relative group">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="مثال: لخص لي أداء فرع طنطا خلال الشهر الماضي مقارنة بباقي الفروع"
                        className="w-full pl-20 pr-8 py-6 bg-muted/50 border-2 border-border rounded-[2rem] focus:ring-4 focus:ring-purple-500/10 focus:border-purple-600 outline-none text-lg transition-all shadow-inner font-bold"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !prompt.trim()}
                        className="absolute left-3 top-3 bottom-3 px-6 bg-purple-600 text-white rounded-[1.5rem] hover:bg-purple-700 disabled:opacity-50 transition-all flex items-center justify-center shadow-lg shadow-purple-600/20 active:scale-95"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} className="rotate-180" />}
                    </button>
                </div>
            </form>
        </div>
    );
}
