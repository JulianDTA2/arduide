import React from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { ScrollArea } from '@/components/ui/scroll-area';

const CodePanel: React.FC = () => {
  const { generatedCode, setGeneratedCode } = useIDE();

  // Permite escribir en el editor
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeneratedCode(e.target.value);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white font-mono text-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3e3e3e] bg-[#2d2d2d]">
        <span className="text-xs text-gray-400">main.cpp</span>
        <span className="text-xs text-emerald-500 font-bold">• EDITABLE</span>
      </div>
      
      <ScrollArea className="flex-1 w-full h-full">
        <textarea
          value={generatedCode}
          onChange={handleChange}
          className="w-full h-full min-h-[500px] bg-transparent p-4 resize-none focus:outline-none font-mono text-sm leading-6 text-gray-300"
          spellCheck={false}
          placeholder="// Escribe tu código aquí..."
          style={{ fontFamily: '"Fira Code", monospace' }}
        />
      </ScrollArea>
    </div>
  );
};

export default CodePanel;