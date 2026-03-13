import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export const useSocket = (onEvent) => {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!socket) {
      socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
    }

    const events = ['whatsapp:qr', 'whatsapp:ready', 'whatsapp:disconnected',
      'lead:new', 'lead:updated', 'message:new', 'notification:new'];

    events.forEach(event => {
      socket.on(event, (data) => handlerRef.current?.(event, data));
    });

    return () => {
      events.forEach(event => socket.off(event));
    };
  }, []);

  return socket;
};
