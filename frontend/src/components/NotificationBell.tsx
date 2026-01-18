import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Bell, Check, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useSettings } from '../context/SettingsContext';
import toast from 'react-hot-toast';

export default function NotificationBell() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const { preferences } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio('/notification.mp3?v=2');
        audioRef.current.volume = 0.5;
        // Preload audio
        audioRef.current.load();
    }, []);

    const { data: count } = useQuery({
        queryKey: ['notification-count'],
        queryFn: () => api.getNotificationCount(),
        refetchInterval: 30000 // Refresh every 30 seconds
    });

    const { data: notifications } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.getNotifications({ unreadOnly: true }),
        enabled: isOpen
    });

    const markReadMutation = useMutation({
        mutationFn: (id: string) => api.markNotificationRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: () => api.markAllNotificationsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    // Listen to real-time notifications via WebSocket
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notification: any) => {


            // Play sound if enabled
            if (preferences?.notificationSound && audioRef.current) {
                audioRef.current.play().catch(err => console.log('Sound play failed:', err));
            }

            // Show toast notification
            toast.success(notification.title, {
                duration: 4000,
                icon: '🔔'
            });

            // Refresh notification count and list
            queryClient.invalidateQueries({ queryKey: ['notification-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        };

        socket.on('notification', handleNewNotification);

        return () => {
            socket.off('notification', handleNewNotification);
        };
    }, [socket, queryClient, preferences]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = (notification: any) => {
        markReadMutation.mutate(notification.id);

        // Navigate if link exists
        if (notification.link) {
            navigate(notification.link);
        }

        setIsOpen(false);
    };

    const unreadCount = count?.count || 0;

    return (
        <div className="relative" ref={dropdownRef} dir="rtl">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-muted-foreground hover:bg-muted hover:text-primary rounded-full transition-all border-0 hover:ring-1 hover:ring-border aspect-square w-10 h-10 flex items-center justify-center bg-transparent"
            >
                <Bell size={20} className={unreadCount > 0 ? "animate-tada" : ""} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black shadow-lg shadow-rose-500/30">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 left-auto mt-3 w-80 bg-card rounded-2xl shadow-2xl border border-border z-[999] animate-slide-up overflow-hidden">
                    <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
                        <h3 className="font-black text-sm">الإشعارات</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllReadMutation.mutate()}
                                className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
                            >
                                <Check size={14} strokeWidth={3} />
                                تعليم الكل كمقروء
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-auto custom-scroll">
                        {!notifications || notifications.length === 0 ? (
                            <div className="p-10 text-center text-muted-foreground/60">
                                <Bell size={40} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">لا توجد إشعارات جديدة</p>
                            </div>
                        ) : (
                            notifications.map((notification: any) => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className="w-full p-4 border-b border-border/40 hover:bg-muted/50 text-right transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 flex-shrink-0">
                                            <div className="p-2 rounded-lg bg-background group-hover:bg-card border border-border/50 transition-colors">
                                                {notification.type === 'TRANSFER_ORDER' ? (
                                                    <FileText size={16} className="text-blue-500" />
                                                ) : (
                                                    <Bell size={16} className="text-amber-500" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black text-sm text-foreground truncate">{notification.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{notification.message}</div>
                                            <div className="text-[10px] text-muted-foreground/50 mt-2 font-mono flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                                                {new Date(notification.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {notifications && notifications.length > 0 && (
                        <div className="p-3 bg-muted/20 border-t border-border/50">
                            <button
                                onClick={() => {
                                    navigate('/notifications');
                                    setIsOpen(false);
                                }}
                                className="w-full text-center text-xs font-black text-primary hover:bg-primary/5 py-2.5 rounded-xl transition-all border border-primary/10 hover:border-primary/20"
                            >
                                عرض كل الإشعارات
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
