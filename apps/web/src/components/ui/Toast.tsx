'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
    success: 'mesa-alert-success',
    error: 'mesa-alert-danger',
    info: 'mesa-alert-warning',
  };
  const iconMap: Record<ToastType, string> = {
    success: '✅',
    error: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className={`
      inline-flex rounded-lg px-3 py-2 shadow-2xl ring-1 ring-black/10
      transition-all duration-300 min-w-[12rem] max-w-[calc(100vw-2rem)]
      ${colors[type]}
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
    `}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-base leading-none" aria-hidden>{iconMap[type]}</span>
        <p className="text-sm font-semibold text-brand-text text-center">{message}</p>
      </div>
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    toastListeners.push(setItems);
    setMounted(true);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== setItems);
    };
  }, []);

  const remove = (id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    toastListeners.forEach(fn => fn(toasts));
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[2147483647] flex flex-col items-end gap-2 pointer-events-none">
      {items.map(item => (
        <div key={item.id} className="pointer-events-auto">
          <Toast message={item.message} type={item.type} onClose={() => remove(item.id)} />
        </div>
      ))}
    </div>,
    document.body
  );
}
