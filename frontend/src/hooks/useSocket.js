import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const BASE = import.meta.env.VITE_API_URL || 'https://whatsapp-crm-production-4099.up.railway.app'

let socket = null

export function useSocket(handlers = {}) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!socket) {
      socket = io(BASE, { transports: ['websocket', 'polling'] })
    }

    const entries = Object.entries(handlersRef.current)
    entries.forEach(([event, fn]) => socket.on(event, fn))

    return () => {
      entries.forEach(([event, fn]) => socket.off(event, fn))
    }
  }, [])

  return socket
}
