'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: 'border-emerald-500/45 bg-emerald-500/12',
    error: 'border-red-500/45 bg-red-500/12',
    info: 'border-brand-gold/45 bg-brand-gold/10',
  };

  return (
    <div className={`
      fixed bottom-24 left-1/2 -translate-x-1/2 z-50
      bg-brand-card border rounded-lg px-5 py-3 shadow-xl
      transition-all duration-300 max-w-xs w-full
      ${colors[type]}
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
    `}>
      <p className="text-sm font-medium text-brand-text">{message}</p>
    </div>
  );
}

// Toast 容器（全局使用）
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

let toastListeners: ((toasts: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];

export function showToast(message: string, type: ToastType = 'info') {
  const item: ToastItem = { id: Date.now().toString(), message, type };
  toasts = [...toasts, item];
  toastListeners.forEach(fn => fn(toasts));
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== setItems);
    };
  }, []);

  const remove = (id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    toastListeners.forEach(fn => fn(toasts));
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none">
      {items.map(item => (
        <div key={item.id} className="pointer-events-auto">
          <Toast message={item.message} type={item.type} onClose={() => remove(item.id)} />
        </div>
      ))}
    </div>
  );
}
