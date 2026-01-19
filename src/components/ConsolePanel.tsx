import React, { useRef, useEffect } from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { Trash2, AlertCircle, Info, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

const ConsolePanel: React.FC = () => {
  const { consoleMessages, clearConsole } = useIDE();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleMessages]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-primary/70 flex-shrink-0" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'warning':
        return 'text-warning bg-warning/10 border-warning/20';
      case 'success':
        return 'text-success bg-success/10 border-success/20';
      default:
        return 'text-foreground bg-muted/30 border-border';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-card to-muted/20 rounded-b-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-warning" />
          <span className="text-sm font-bold text-foreground">Consola</span>
          {consoleMessages.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold border border-warning/30">
              {consoleMessages.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConsole}
          className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-2">
          {consoleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4 border-2 border-border">
                <Terminal className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">
                La salida aparecerá aquí... 🖥️
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {consoleMessages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 ${getColorClass(msg.type)} font-mono text-xs`}
                >
                  {getIcon(msg.type)}
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground text-[10px] block mb-1 font-sans">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="break-all leading-relaxed">{msg.message}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ConsolePanel;
