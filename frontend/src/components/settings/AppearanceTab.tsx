import React, { useState } from 'react';
import { Palette, Check, Volume2, Sparkles, Smartphone, Type } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import toast from 'react-hot-toast';

const FONTS = [
    { name: 'Cairo', value: "'Cairo', sans-serif" },
    { name: 'Tajawal', value: "'Tajawal', sans-serif" },
    { name: 'Almarai', value: "'Almarai', sans-serif" },
    { name: 'Readex Pro', value: "'Readex Pro', sans-serif" },
    { name: 'Lateef', value: "'Lateef', serif" },
    { name: 'IBM Plex Sans Arabic (Default)', value: "'IBM Plex Sans Arabic', sans-serif" },
];

export function AppearanceTab() {
    const { user, token, login } = useAuth();
    const { preferences, updatePreferences } = useSettings();
    const { permission, requestPermission, isSupported } = usePushNotifications();
    const [selectedFont, setSelectedFont] = useState(user?.fontFamily || localStorage.getItem('arabic-font') || "'IBM Plex Sans Arabic', sans-serif");

    const handleFontChange = async (fontValue: string) => {
        setSelectedFont(fontValue);
        localStorage.setItem('arabic-font', fontValue);
        document.documentElement.style.setProperty('--font-arabic', fontValue);

        try {
            await updatePreferences({ fontFamily: fontValue });
            // Update local user context if possible
            if (user && token) login(token, { ...user, fontFamily: fontValue });
            toast.success('تم تحديث الخط بنجاح');
        } catch (e) {
            console.error("Failed to save font preference", e);
            toast.error('فشل حفظ إعدادات الخط');
        }
    };

    const handleFontSizeChange = async (size: 'small' | 'medium' | 'large') => {
        try {
            await updatePreferences({ fontSize: size });
            toast.success('تم تحديث حجم الخط');
        } catch (e) {
            console.error("Failed to save font size", e);
            toast.error('فشل حفظ حجم الخط');
        }
    };

    const handleToggle = async (key: 'highlightEffect' | 'notificationSound' | 'mobilePush', value: boolean) => {
        try {
            // Special handling for mobilePush
            if (key === 'mobilePush' && value) {
                if (!isSupported) {
                    toast.error('المتصفح لا يدعم إشعارات الموبايل');
                    return;
                }
                if (permission !== 'granted') {
                    const granted = await requestPermission();
                    if (!granted) {
                        toast.error('يجب السماح بالإشعارات أولاً');
                        return;
                    }
                }
            }

            await updatePreferences({ [key]: value });
            const labels = {
                highlightEffect: 'تأثير التمييز',
                notificationSound: 'صوت الإشعارات',
                mobilePush: 'إشعارات الموبايل'
            };
            toast.success(`تم ${value ? 'تفعيل' : 'إلغاء'} ${labels[key]}`);
        } catch (e) {
            console.error(`Failed to save ${key}`, e);
            toast.error('فشل حفظ الإعدادات');
        }
    };

    return (
        <div className="space-y-6">
            {/* Notification Preferences */}
            <div className="bg-card rounded-4xl border border-border shadow-md p-10 animate-fade-in">
                <h2 className="text-2xl font-black mb-8 text-foreground border-b border-border pb-6 flex items-center gap-4">
                    <Sparkles size={28} className="text-primary" />
                    إعدادات الإشعارات
                </h2>

                <div className="space-y-6 max-w-2xl">
                    {/* Highlight Effect */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Sparkles size={24} className="text-primary" />
                            </div>
                            <div>
                                <h3 className="font-black text-foreground">تأثير التمييز</h3>
                                <p className="text-sm text-muted-foreground">إضافة animation للسجل عند فتحه من الإشعار</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences?.highlightEffect ?? true}
                                onChange={(e) => handleToggle('highlightEffect', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    {/* Notification Sound */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Volume2 size={24} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-foreground">صوت الإشعارات</h3>
                                <p className="text-sm text-muted-foreground">تشغيل صوت عند وصول إشعار جديد</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences?.notificationSound ?? true}
                                onChange={(e) => handleToggle('notificationSound', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    {/* Mobile Push */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <Smartphone size={24} className="text-green-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-foreground">إشعارات الموبايل</h3>
                                <p className="text-sm text-muted-foreground">استقبال إشعارات push على الموبايل</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preferences?.mobilePush ?? false}
                                onChange={(e) => handleToggle('mobilePush', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Font Size */}
            <div className="bg-card rounded-4xl border border-border shadow-md p-10 animate-fade-in">
                <h2 className="text-2xl font-black mb-8 text-foreground border-b border-border pb-6 flex items-center gap-4">
                    <Type size={28} className="text-primary" />
                    حجم الخط
                </h2>

                <div className="max-w-2xl">
                    <div className="grid grid-cols-3 gap-4">
                        {(['small', 'medium', 'large'] as const).map((size) => (
                            <button
                                key={size}
                                onClick={() => handleFontSizeChange(size)}
                                className={`p-6 border rounded-2xl transition-all text-center ${preferences?.fontSize === size
                                    ? 'border-primary bg-primary/5 ring-4 ring-primary/5'
                                    : 'border-border bg-card hover:border-primary/20 hover:bg-muted/30'
                                    }`}
                            >
                                {preferences?.fontSize === size && (
                                    <div className="flex justify-center mb-2">
                                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                            <Check size={12} className="text-white" strokeWidth={4} />
                                        </div>
                                    </div>
                                )}
                                <div className={`font-black text-foreground ${size === 'small' ? 'text-sm' : size === 'large' ? 'text-2xl' : 'text-lg'
                                    }`}>
                                    {size === 'small' ? 'صغير' : size === 'medium' ? 'متوسط' : 'كبير'}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large'}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Font Family */}
            <div className="bg-card rounded-4xl border border-border shadow-md p-10 animate-fade-in relative overflow-hidden">
                <h2 className="text-2xl font-black mb-10 text-foreground border-b border-border pb-6 flex items-center gap-4 relative z-10">
                    <Palette size={28} className="text-primary" />
                    تخصيص الخطوط العامة
                </h2>

                <div className="max-w-2xl relative z-10">
                    <div className="space-y-6">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mr-2">الخط العربي المفضل</label>
                        <div className="grid grid-cols-1 gap-4 max-h-150 overflow-y-auto pr-3 custom-scroll">
                            {FONTS.map((font) => (
                                <button
                                    key={font.value}
                                    onClick={() => handleFontChange(font.value)}
                                    className={`w-full text-right p-4 border rounded-2xl transition-all relative group ${selectedFont === font.value
                                        ? 'border-primary bg-primary/5 ring-4 ring-primary/5'
                                        : 'border-border bg-card hover:border-primary/20 hover:bg-muted/30'
                                        }`}
                                    style={{ fontFamily: font.value }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{font.name}</span>
                                        {selectedFont === font.value && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                                <Check size={12} className="text-white" strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xl font-black text-foreground leading-relaxed">
                                        Smart Enterprise Suite - الحل الذكي للإدارة
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-1">عينة نصية توضح جماليات الخط المختار</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
