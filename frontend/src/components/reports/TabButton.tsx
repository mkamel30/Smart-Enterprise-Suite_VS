import React from 'react';

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    color?: 'default' | 'purple';
}

export function TabButton({ active, onClick, label, icon, color = 'default' }: TabButtonProps) {
    const base = "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all duration-300 whitespace-nowrap flex-1 justify-center md:flex-none";
    const colors = {
        default: active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        purple: active ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-muted-foreground hover:bg-purple-500/10 hover:text-purple-600',
    };

    return (
        <button onClick={onClick} className={`${base} ${colors[color]}`}>
            {icon}
            {label}
        </button>
    );
}
