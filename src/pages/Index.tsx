import React, { useState, useCallback, useRef, useEffect } from 'react';
import { IDEProvider, useIDE } from '@/contexts/IDEContext';
import BlocklyEditor from '@/components/BlocklyEditor';
import CodePanel from '@/components/CodePanel';
import ConsolePanel from '@/components/ConsolePanel';
import SerialMonitor from '@/components/SerialMonitor';
import Toolbar from '@/components/Toolbar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Code, Terminal, Radio, Blocks } from 'lucide-react';
import * as Blockly from 'blockly';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

const IDEContent: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab,
    saveProject,
    generatedCode,
    currentProject,
    openProject,
    createNewProject,
    addConsoleMessage,
    selectedBoard,
    importProject
  } = useIDE();
  
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'blocks' | 'code'>('blocks');
  const [blocklyKey, setBlocklyKey] = useState(0);

  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  
  useEffect(() => {
    const checkWorkspace = () => {
      const container = document.querySelector('.blockly-container');
      if (container) {
        const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
        if (workspace) {
          workspaceRef.current = workspace;
        }
      }
    };
    
    const timer = setTimeout(checkWorkspace, 500);
    return () => clearTimeout(timer);
  }, [blocklyKey]);

  const getWorkspaceXml = useCallback((): string => {
    if (workspaceRef.current) {
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      return Blockly.Xml.domToText(xml);
    }
    return '';
  }, []);

  const handleSave = useCallback(async () => {
    const xml = getWorkspaceXml();
    if (xml) {
      await saveProject(xml, generatedCode);
    }
  }, [getWorkspaceXml, saveProject, generatedCode]);

  const handleNewProject = useCallback(async (name: string) => {
    const xml = getWorkspaceXml() || '';
    await createNewProject(name, xml, generatedCode);
  }, [getWorkspaceXml, createNewProject, generatedCode]);

  const handleOpenProject = useCallback(async (id: string) => {
    await openProject(id);
    // Force re-render BlocklyEditor with new XML
    setBlocklyKey(prev => prev + 1);
    addConsoleMessage('info', 'Proyecto cargado correctamente');
  }, [openProject, addConsoleMessage]);

  const handleImportProject = useCallback(async (blocklyXml: string, name: string, board: string) => {
    await importProject(blocklyXml, name, board);
    // Force re-render BlocklyEditor with imported XML
    setBlocklyKey(prev => prev + 1);
  }, [importProject]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentProject) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentProject, handleSave]);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col">
        {/* TOOLBAR */}
        <div className="w-full relative z-20 mb-2 px-2">
          <Toolbar 
            onSave={handleSave}
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
            onImportProject={handleImportProject}
          />
        </div>

        {/* Mobile View Toggle */}
        <div className="px-2 mb-2">
          <div className="flex gap-1 p-1 bg-card rounded-xl">
            <button
              onClick={() => setMobileView('blocks')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                mobileView === 'blocks' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Blocks className="w-4 h-4" />
              Bloques
            </button>
            <button
              onClick={() => setMobileView('code')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                mobileView === 'code' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Code className="w-4 h-4" />
              Código
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 px-2 pb-2 overflow-hidden">
          <AnimatePresence mode="wait">
            {mobileView === 'blocks' ? (
              <motion.div
                key="blocks"
                className="h-full ide-panel overflow-hidden"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <BlocklyEditor key={blocklyKey} initialXml={currentProject?.blocklyXml} />
              </motion.div>
            ) : (
              <motion.div
                key="code"
                className="h-full flex flex-col ide-panel overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
                  <div className="px-2 pt-2 bg-gradient-to-b from-muted/30 to-transparent">
                    <TabsList className="bg-transparent h-auto p-0 w-full justify-start gap-1">
                      {[
                        { value: 'code', icon: Code, label: 'Código' },
                        { value: 'console', icon: Terminal, label: 'Consola' },
                        { value: 'serial', icon: Radio, label: 'Monitor' },
                      ].map((tab) => (
                        <TabsTrigger 
                          key={tab.value}
                          value={tab.value}
                          className="tab-candy gap-1.5 px-3 py-2 text-xs"
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  <div className="flex-1 overflow-hidden relative bg-card rounded-b-2xl">
                    <AnimatePresence mode="wait">
                      {activeTab === 'code' && (
                        <motion.div key="code-panel" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <CodePanel />
                        </motion.div>
                      )}
                      {activeTab === 'console' && (
                        <motion.div key="console-panel" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <ConsolePanel />
                        </motion.div>
                      )}
                      {activeTab === 'serial' && (
                        <motion.div key="serial-panel" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <SerialMonitor />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col">
      
      {/* TOOLBAR */}
      <div className="w-full relative z-20 mb-4">
        <Toolbar 
          onSave={handleSave}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onImportProject={handleImportProject}
        />
      </div>

      {/* WORK AREA */}
      <motion.div 
        className="flex-1 workspace-inset overflow-hidden relative"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          
          {/* BLOCKLY PANEL */}
          <ResizablePanel defaultSize={60} minSize={35} className="p-3">
            <div className="h-full w-full ide-panel overflow-hidden relative group">
              <BlocklyEditor key={blocklyKey} initialXml={currentProject?.blocklyXml} />
            </div>
          </ResizablePanel>

          {/* Handle */}
          <ResizableHandle 
            withHandle 
            className="bg-transparent w-5 group hover:bg-primary/10 transition-colors rounded-full mx-1" 
          />

          {/* CODE & CONSOLE PANEL */}
          <ResizablePanel defaultSize={40} minSize={28} className="p-3 pl-0">
            <div className="h-full w-full flex flex-col ide-panel overflow-hidden">
              
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
                
                {/* Tab Header */}
                <div className="px-3 pt-3 bg-gradient-to-b from-muted/30 to-transparent">
                  <TabsList className="bg-transparent h-auto p-0 w-full justify-start gap-1 flex-wrap">
                    {[
                      { value: 'code', icon: Code, label: 'Código', color: 'primary' },
                      { value: 'console', icon: Terminal, label: 'Consola', color: 'warning' },
                      { value: 'serial', icon: Radio, label: 'Monitor', color: 'success' },
                    ].map((tab) => (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value}
                        className={`tab-candy gap-2 data-[state=active]:text-${tab.color}`}
                      >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden relative bg-card rounded-b-2xl">
                  <AnimatePresence mode="wait">
                    {activeTab === 'code' && (
                      <motion.div 
                        key="code"
                        className="h-full w-full"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CodePanel />
                      </motion.div>
                    )}
                    {activeTab === 'console' && (
                      <motion.div 
                        key="console"
                        className="h-full w-full"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ConsolePanel />
                      </motion.div>
                    )}
                    {activeTab === 'serial' && (
                      <motion.div 
                        key="serial"
                        className="h-full w-full"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <SerialMonitor />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Tabs>

            </div>
          </ResizablePanel>

        </ResizablePanelGroup>
      </motion.div>

      {/* STATUS BAR */}
      <motion.div 
        className="toolbar-island mx-2 mt-3 justify-between text-xs font-bold text-muted-foreground"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="status-dot status-dot-connected" />
            ArduIDE v1.0
          </span>
          {currentProject && (
            <span className="badge-candy">
              📁 {currentProject.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            Auto-guardado activo ✓
          </span>
        </div>
      </motion.div>

    </div>
  );
};

const Index: React.FC = () => {
  return (
    <IDEProvider>
      <IDEContent />
    </IDEProvider>
  );
};

export default Index;
