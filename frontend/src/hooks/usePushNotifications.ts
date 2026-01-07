import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import axios from 'axios';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { preferences } = useSettings();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    setPermission(Notification.permission);

    if (!supported || !user || !preferences?.mobilePush) {
      return;
    }

    initializePushNotifications();
  }, [user, preferences?.mobilePush]);

  const initializePushNotifications = async () => {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Check existing subscription
      let sub = await registration.pushManager.getSubscription();

      if (!sub && Notification.permission === 'granted') {
        // Subscribe to push notifications
        sub = await subscribeToPush(registration);
      }

      setSubscription(sub);
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const subscribeToPush = async (registration: ServiceWorkerRegistration) => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) {
      console.log('No token or user ID available for push subscription');
      return null;
    }

    try {
      // Get VAPID public key from backend
      const response = await axios.get('http://localhost:5000/api/push/vapid-public-key');
      const publicKey = response.data.publicKey;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
      });

      // Send subscription to backend
      await axios.post(
        'http://localhost:5000/api/push/subscribe',
        {
          subscription: subscription.toJSON(),
          userId: user.id
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      return null;
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      alert('المتصفح لا يدعم إشعارات Push');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        await initializePushNotifications();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  const unsubscribe = async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) {
      console.log('No token or user ID for unsubscribe');
      return;
    }

    try {
      if (subscription) {
        await subscription.unsubscribe();
        setSubscription(null);

        // Notify backend
        await axios.post(
          'http://localhost:5000/api/push/unsubscribe',
          { userId: user.id },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    unsubscribe
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
