import React, { useState, useCallback, useRef, useEffect } from 'react';
import { IDEProvider, useIDE } from '@/contexts/IDEContext';
import BlocklyEditor from '@/components/BlocklyEditor';
import CodePanel from '@/components/CodePanel';
import ConsolePanel from '@/components/ConsolePanel';
import SerialMonitor from '@/components/SerialMonitor';
import Toolbar from '@/components/Toolbar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Code, Terminal, Radio, Cloud, Sparkles } from 'lucide-react';
import * as Blockly from 'blockly';
import { useAuth } from '@/hooks/useAuth';
import { 
  syncProjectToCloud, 
  getAllCloudProjects, 
  type CloudProject 
} from '@/lib/cloud-storage';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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
    selectedBoard
  } = useIDE();
  
  const { isAuthenticated, signOut, user } = useAuth();
  const [cloudProjectId, setCloudProjectId] = useState<string | undefined>();

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
  }, []);

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
    addConsoleMessage('info', 'Project loaded successfully');
  }, [openProject, addConsoleMessage]);

  const handleSyncToCloud = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to sync to cloud');
      return;
    }

    const xml = getWorkspaceXml();
    const project = await syncProjectToCloud(
      {
        name: currentProject?.name || 'Untitled Project',
        blocklyXml: xml,
        generatedCode,
        board: selectedBoard.fqbn,
      },
      cloudProjectId
    );

    if (project) {
      setCloudProjectId(project.id);
      addConsoleMessage('success', 'Project synced to cloud!');
    } else {
      addConsoleMessage('error', 'Failed to sync project');
    }
  }, [isAuthenticated, currentProject, generatedCode, selectedBoard, cloudProjectId, getWorkspaceXml, addConsoleMessage]);

  const handleLoadFromCloud = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to load from cloud');
      return;
    }

    const cloudProjects = await getAllCloudProjects();
    if (cloudProjects.length === 0) {
      toast.info('No cloud projects found');
      return;
    }

    const latestProject = cloudProjects[0];
    setCloudProjectId(latestProject.id);
    
    await createNewProject(
      latestProject.name,
      latestProject.blockly_xml,
      latestProject.generated_code
    );
    
    addConsoleMessage('success', `Loaded cloud project: ${latestProject.name}`);
  }, [isAuthenticated, createNewProject, addConsoleMessage]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentProject) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentProject, handleSave]);

  return (
    <div className="flex flex-col h-screen w-full bg-background p-3 md:p-5 box-border overflow-hidden font-sans">
      
      {/* Barra Rainbow decorativa */}
      <div className="rainbow-bar rounded-full mx-4 mb-3" />
      
      {/* TOOLBAR */}
      <div className="w-full relative z-20 mb-4">
        <Toolbar 
          onSave={handleSave}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onSyncToCloud={handleSyncToCloud}
          onLoadFromCloud={handleLoadFromCloud}
        />
      </div>

      {/* ÁREA DE TRABAJO - NEUMORPHISM INSET */}
      <motion.div 
        className="flex-1 workspace-inset overflow-hidden relative"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          
          {/* === PANEL BLOCKLY === */}
          <ResizablePanel defaultSize={60} minSize={35} className="p-3">
            <div className="h-full w-full ide-panel overflow-hidden relative group">
              {/* Barra de color superior */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-secondary to-accent z-10 opacity-80" />
              
              <BlocklyEditor initialXml={currentProject?.blocklyXml} />
              
              {/* Label flotante */}
              <motion.div 
                className="floating-label bottom-4 right-4 text-primary flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Editor de Bloques
              </motion.div>
            </div>
          </ResizablePanel>

          {/* Handle con estilo */}
          <ResizableHandle 
            withHandle 
            className="bg-transparent w-5 group hover:bg-primary/10 transition-colors rounded-full mx-1" 
          />

          {/* === PANEL CÓDIGO & CONSOLA === */}
          <ResizablePanel defaultSize={40} minSize={28} className="p-3 pl-0">
            <div className="h-full w-full flex flex-col ide-panel overflow-hidden">
              
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
                
                {/* Header de Pestañas */}
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

                {/* Contenido de Pestañas */}
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
            Arduino Web IDE v1.0
          </span>
          {currentProject && (
            <span className="badge-candy">
              📁 {currentProject.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-success">
            <Cloud className="w-3.5 h-3.5" />
            Auto-guardado ✓
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
