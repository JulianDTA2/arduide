import React from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Edit3 } from 'lucide-react';

const CodePanel: React.FC = () => {
  const { generatedCode, setGeneratedCode } = useIDE();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeneratedCode(e.target.value);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-card to-muted/20 rounded-b-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">main.cpp</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/15 border-2 border-success/30">
          <Edit3 className="w-3 h-3 text-success" />
          <span className="text-[10px] text-success font-bold uppercase tracking-wide">Editable</span>
        </div>
      </div>
      
      {/* Editor */}
      <ScrollArea className="flex-1 w-full h-full">
        <textarea
          value={generatedCode}
          onChange={handleChange}
          className="w-full h-full min-h-[500px] bg-transparent p-5 resize-none focus:outline-none font-mono text-sm leading-7 text-foreground placeholder:text-muted-foreground"
          spellCheck={false}
          placeholder="// ¡Escribe tu código Arduino aquí! 🚀"
          style={{ 
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            caretColor: 'hsl(var(--primary))'
          }}
        />
      </ScrollArea>
      
      {/* Footer hint */}
      <div className="px-4 py-2.5 bg-muted/20 border-t border-border text-[11px] text-muted-foreground font-semibold">
        💡 Tip: Los bloques generan código automáticamente
      </div>
    </div>
  );
};

export default CodePanel;
