import React, { type ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    filter?: ReactNode;
    showDot?: boolean;
    className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    actions,
    filter,
    showDot = true,
    className = ""
}) => {
    return (
        <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 ${className}`}>
            <div className="space-y-1">
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3 text-primary">
                    {showDot && (
                        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                    )}
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-muted-foreground font-bold">{subtitle}</p>
                )}
            </div>

            <div className="flex gap-4 flex-wrap items-center w-full lg:w-auto">
                {filter && (
                    <div className="flex-1 lg:flex-none">
                        {filter}
                    </div>
                )}
                {actions && (
                    <div className="flex gap-3 flex-wrap items-center flex-1 lg:flex-none">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PageHeader;
