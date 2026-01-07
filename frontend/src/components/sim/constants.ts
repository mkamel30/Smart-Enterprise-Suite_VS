export const SIM_TYPES = ['Vodafone', 'Orange', 'Etisalat', 'WE', 'أخرى'];

export const TYPE_COLORS: Record<string, string> = {
    'Vodafone': 'bg-red-50 border-red-200 text-red-700',
    'Orange': 'bg-orange-50 border-orange-200 text-orange-700',
    'Etisalat': 'bg-green-50 border-green-200 text-green-700',
    'WE': 'bg-purple-50 border-purple-200 text-purple-700',
    'أخرى': 'bg-slate-50 border-slate-200 text-slate-700',
    'غير محدد': 'bg-gray-50 border-gray-200 text-gray-500'
};

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
    'ACTIVE': { label: 'سليمة', color: 'green' },
    'IN_TRANSIT': { label: 'في الطريق', color: 'blue' },
    'DEFECTIVE': { label: 'تالفة', color: 'red' }
};
