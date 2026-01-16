import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { 
  Trash2, 
  Send, 
  Plug, 
  Unplug,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  isWebSerialSupported, 
  requestSerialPort, 
  openSerialConnection,
  closeSerialConnection,
  writeToSerial,
  SerialConnection
} from '@/lib/webserial';
import { toast } from 'sonner';

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

const SerialMonitor: React.FC = () => {
  const { 
    serialMessages, 
    addSerialMessage, 
    clearSerialMessages,
    serialBaudRate,
    setSerialBaudRate,
    addConsoleMessage,
    isConnected: ideConnected,
    setIsConnected
  } = useIDE();
  
  const [inputValue, setInputValue] = useState('');
  const [isMonitorConnected, setIsMonitorConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const connectionRef = useRef<SerialConnection | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readLoopRef = useRef<boolean>(false);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [serialMessages, autoScroll]);

  // Read loop function
  const startReadLoop = useCallback(async () => {
    if (!connectionRef.current?.reader) return;
    
    readLoopRef.current = true;
    const decoder = new TextDecoder();
    
    while (readLoopRef.current && connectionRef.current?.reader) {
      try {
        const { value, done } = await connectionRef.current.reader.read();
        if (done) break;
        if (value) {
          const text = decoder.decode(value);
          addSerialMessage('received', text);
        }
      } catch (error) {
        if (readLoopRef.current) {
          console.error('Read error:', error);
        }
        break;
      }
    }
  }, [addSerialMessage]);

  // Connect function
  const handleConnect = async () => {
    if (!isWebSerialSupported()) {
      toast.error('WebSerial is not supported in this browser. Use Chrome or Edge.');
      addConsoleMessage('error', 'WebSerial not supported');
      return;
    }

    try {
      const port = await requestSerialPort();
      if (!port) return; // User cancelled

      const connection = await openSerialConnection(port, serialBaudRate);
      connectionRef.current = connection;
      setIsMonitorConnected(true);
      setIsConnected(true);
      addConsoleMessage('success', `Serial monitor connected at ${serialBaudRate} baud`);
      toast.success('Serial monitor connected');
      
      // Start reading
      startReadLoop();
    } catch (error) {
      addConsoleMessage('error', `Failed to connect: ${error}`);
      toast.error('Failed to connect to serial port');
    }
  };

  // Disconnect function - Wrapped in useCallback for dependency safety
  const handleDisconnect = useCallback(async () => {
    readLoopRef.current = false;
    
    if (connectionRef.current) {
      await closeSerialConnection(connectionRef.current);
      connectionRef.current = null;
    }
    
    setIsMonitorConnected(false);
    // Solo actualizamos el estado global si somos nosotros los que desconectamos manualmente
    // Pero en el caso de limpieza automática, esto es redundante pero seguro.
    setIsConnected(false); 
    
    addConsoleMessage('info', 'Serial monitor disconnected');
    toast.info('Serial monitor disconnected');
  }, [setIsConnected, addConsoleMessage]);

  // Send function
  const handleSend = async () => {
    if (!inputValue.trim() || !connectionRef.current) return;

    try {
      await writeToSerial(connectionRef.current, inputValue + '\n');
      addSerialMessage('sent', inputValue);
      setInputValue('');
    } catch (error) {
      addConsoleMessage('error', `Failed to send: ${error}`);
      toast.error('Failed to send data');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      readLoopRef.current = false;
      if (connectionRef.current) {
        closeSerialConnection(connectionRef.current);
      }
    };
  }, []);

  // --- NUEVO: Efecto crítico para liberar el puerto cuando el Toolbar lo pide ---
  useEffect(() => {
    // Si el estado global dice "Desconectado" pero el monitor sigue conectado físicamente,
    // significa que Toolbar forzó la desconexión para subir código.
    // Debemos soltar el puerto inmediatamente.
    if (!ideConnected && isMonitorConnected) {
      console.log("Forzando desconexión del monitor serie por solicitud externa...");
      handleDisconnect();
    }
  }, [ideConnected, isMonitorConnected, handleDisconnect]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border bg-panel-header gap-2">
        <span className="text-sm font-medium text-foreground">Serial Monitor</span>
        <div className="flex items-center gap-2">
          <Select
            value={serialBaudRate.toString()}
            onValueChange={(v) => setSerialBaudRate(Number(v))}
            disabled={isMonitorConnected}
          >
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BAUD_RATES.map((rate) => (
                <SelectItem key={rate} value={rate.toString()}>
                  {rate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {isMonitorConnected ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              className="h-7 px-2"
            >
              <Unplug className="w-3.5 h-3.5 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleConnect}
              className="h-7 px-2"
            >
              <Plug className="w-3.5 h-3.5 mr-1" />
              Connect
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`h-7 px-2 ${autoScroll ? 'text-primary' : 'text-muted-foreground'}`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSerialMessages}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 bg-panel-bg" ref={scrollRef}>
        <div className="p-3 font-mono text-xs space-y-0.5">
          {serialMessages.length === 0 ? (
            <div className="text-muted-foreground italic">
              {isMonitorConnected 
                ? 'Waiting for data...' 
                : 'Connect to see serial output...'}
            </div>
          ) : (
            serialMessages.map((msg) => (
              <div
                key={msg.id}
                className={`py-0.5 ${
                  msg.type === 'sent' 
                    ? 'text-arduino-teal-light' 
                    : 'text-foreground'
                }`}
              >
                {msg.type === 'sent' && <span className="text-muted-foreground">{'> '}</span>}
                {msg.content}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="flex items-center gap-2 p-2 border-t border-panel-border bg-panel-header">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type message..."
          disabled={!isMonitorConnected}
          className="h-8 text-xs bg-background"
        />
        <Button
          onClick={handleSend}
          disabled={!isMonitorConnected || !inputValue.trim()}
          size="sm"
          className="h-8 px-3"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default SerialMonitor;