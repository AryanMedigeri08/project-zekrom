/**
 * NotificationContext.jsx — Global notification state provider.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notification) => {
    setNotifications(prev => [
      {
        ...notification,
        id: Date.now() + Math.random(),
        read: false,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 100));
  }, []);

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    notifications,
    isOpen,
    filter,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
    clearAll,
    setFilter,
    toggleNotifications: () => setIsOpen(prev => !prev),
    closeNotifications: () => setIsOpen(false),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export default NotificationContext;
