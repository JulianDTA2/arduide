import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { 
  Trash2, 
  Send, 
  Plug, 
  Unplug,
  ArrowDown,
  Radio,
  Zap
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
import { motion, AnimatePresence } from 'framer-motion';

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

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [serialMessages, autoScroll]);

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

  const handleConnect = async () => {
    if (!isWebSerialSupported()) {
      toast.error('WebSerial no está soportado. Usa Chrome o Edge.');
      addConsoleMessage('error', 'WebSerial not supported');
      return;
    }

    try {
      const port = await requestSerialPort();
      if (!port) return;

      const connection = await openSerialConnection(port, serialBaudRate);
      connectionRef.current = connection;
      setIsMonitorConnected(true);
      setIsConnected(true);
      addConsoleMessage('success', `Monitor serie conectado a ${serialBaudRate} baudios`);
      toast.success('¡Monitor serie conectado! 🎉');
      
      startReadLoop();
    } catch (error) {
      addConsoleMessage('error', `Falló la conexión: ${error}`);
      toast.error('No se pudo conectar al puerto serie');
    }
  };

  const handleDisconnect = useCallback(async () => {
    readLoopRef.current = false;
    
    if (connectionRef.current) {
      await closeSerialConnection(connectionRef.current);
      connectionRef.current = null;
    }
    
    setIsMonitorConnected(false);
    setIsConnected(false);
    
    addConsoleMessage('info', 'Monitor serie desconectado');
    toast.info('Monitor serie desconectado');
  }, [setIsConnected, addConsoleMessage]);

  const handleSend = async () => {
    if (!inputValue.trim() || !connectionRef.current) return;

    try {
      await writeToSerial(connectionRef.current, inputValue + '\n');
      addSerialMessage('sent', inputValue);
      setInputValue('');
    } catch (error) {
      addConsoleMessage('error', `Error al enviar: ${error}`);
      toast.error('Error al enviar datos');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    return () => {
      readLoopRef.current = false;
      if (connectionRef.current) {
        closeSerialConnection(connectionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!ideConnected && isMonitorConnected) {
      console.log("Forzando desconexión del monitor serie...");
      handleDisconnect();
    }
  }, [ideConnected, isMonitorConnected, handleDisconnect]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-card to-muted/20 rounded-b-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${isMonitorConnected ? 'text-success' : 'text-muted-foreground'}`} />
          <span className="text-sm font-bold text-foreground">Monitor Serie</span>
          {isMonitorConnected && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="status-dot status-dot-connected ml-1"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Baud Rate Selector */}
          <Select
            value={serialBaudRate.toString()}
            onValueChange={(v) => setSerialBaudRate(Number(v))}
            disabled={isMonitorConnected}
          >
            <SelectTrigger className="w-24 h-9 text-xs rounded-xl border-2 border-border bg-input font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-2">
              {BAUD_RATES.map((rate) => (
                <SelectItem key={rate} value={rate.toString()} className="font-medium">
                  {rate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Connect/Disconnect Button */}
          {isMonitorConnected ? (
            <Button
              onClick={handleDisconnect}
              className="clay-btn h-9 px-4 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
            >
              <Unplug className="w-4 h-4 mr-1.5" />
              Desconectar
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              className="clay-btn clay-btn-success h-9 px-4"
            >
              <Plug className="w-4 h-4 mr-1.5" />
              Conectar
            </Button>
          )}
          
          {/* Auto-scroll toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`h-9 w-9 p-0 rounded-xl transition-colors ${
              autoScroll ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
            title={autoScroll ? 'Auto-scroll activado' : 'Auto-scroll desactivado'}
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          
          {/* Clear button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSerialMessages}
            className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Messages Area */}
      <ScrollArea className="flex-1 bg-muted/20" ref={scrollRef}>
        <div className="p-4 font-mono text-sm space-y-1">
          {serialMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <motion.div 
                className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${
                  isMonitorConnected 
                    ? 'bg-success/10 border-2 border-success/30' 
                    : 'bg-muted/50 border-2 border-muted'
                }`}
                animate={isMonitorConnected ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className={`w-10 h-10 ${isMonitorConnected ? 'text-success' : 'text-muted-foreground/50'}`} />
              </motion.div>
              <p className="text-muted-foreground font-medium">
                {isMonitorConnected 
                  ? '⏳ Esperando datos...' 
                  : '🔌 Conecta para ver la salida serie'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {serialMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: msg.type === 'sent' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`py-1.5 px-3 rounded-lg ${
                    msg.type === 'sent' 
                      ? 'bg-primary/10 text-primary border-l-3 border-primary ml-8' 
                      : 'bg-card text-foreground border-l-3 border-success mr-8'
                  }`}
                >
                  {msg.type === 'sent' && (
                    <span className="text-primary/60 mr-2">{'→'}</span>
                  )}
                  {msg.type === 'received' && (
                    <span className="text-success/60 mr-2">{'←'}</span>
                  )}
                  {msg.content}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
      
      {/* Input Area */}
      <div className="flex items-center gap-3 p-3 border-t border-border bg-card">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Escribe un mensaje... 💬"
          disabled={!isMonitorConnected}
          className="neu-input flex-1 h-10 text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={!isMonitorConnected || !inputValue.trim()}
          className="clay-btn clay-btn-primary h-10 px-5"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SerialMonitor;
