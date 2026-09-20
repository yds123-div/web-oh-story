import { useEffect, useState } from 'react';
import './Toast.css';

interface ToastProps {
  message: string;
  onClose?: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="toast">
      {message}
    </div>
  );
}

// Toast hook for easy usage
let toastListeners: Array<(message: string) => void> = [];

export function showToast(message: string) {
  toastListeners.forEach(listener => listener(message));
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    toastListeners.push(setMessage);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setMessage);
    };
  }, []);

  const closeToast = () => setMessage(null);

  return {
    toast: message,
    closeToast,
  };
}
