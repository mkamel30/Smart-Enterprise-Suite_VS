import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Only connect if user is authenticated and we have a token
        if (!user || !token) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        // Create socket connection with authentication
        const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
            timeout: 20000
        });

        newSocket.on('connect', () => {
            console.log('⚡ Socket connected with ID:', newSocket.id);
            setIsConnected(true);
        });

        // --- Global Real-time Listeners ---
        newSocket.on('request-created', (data: any) => {
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">طلب صيانة جديد! 🛠️</span>
                    <span className="text-xs opacity-80">{data.customerName} - {data.serialNumber}</span>
                </div>,
                { duration: 5000, icon: '🔧' }
            );
        });

        newSocket.on('request-closed', (data: any) => {
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">تم إغلاق طلب! ✅</span>
                    <span className="text-xs opacity-80">{data.customerName} - {data.totalCost} ج.م</span>
                </div>,
                { duration: 5000, icon: '🎉' }
            );
        });

        newSocket.on('stock-alert', (data: any) => {
            toast.error(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">تنبيه مخزون! 📦</span>
                    <span className="text-xs opacity-80">{data.message}</span>
                </div>,
                { duration: 8000, icon: '⚠️' }
            );
        });

        newSocket.on('admin-alert', (data: any) => {
            if (user?.role === 'SUPER_ADMIN') {
                toast(data.message, {
                    icon: '🚀',
                    style: { background: '#1e293b', color: '#fff', fontSize: '12px' }
                });
            }
        });

        newSocket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            newSocket.disconnect();
        };
    }, [user, token]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
