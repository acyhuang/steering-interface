import { useEffect, useState } from "react";
import { chatApi } from "@/lib/api";

export function ConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await chatApi.checkHealth();
        setStatus(isConnected ? 'connected' : 'disconnected');
      } catch (error) {
        setStatus('disconnected');
      }
    };

    // Check immediately
    checkConnection();

    // Then check every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  const colors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500'
  };

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${colors[status]}`} />
      <span className="text-sm text-gray-600">{status}</span>
    </div>
  );
} 