import React, { useState, useCallback, useRef, useEffect } from 'react';
import { IDEProvider, useIDE } from '@/contexts/IDEContext';
import BlocklyEditor from '@/components/BlocklyEditor';
import CodePanel from '@/components/CodePanel';
import ConsolePanel from '@/components/ConsolePanel';
import SerialMonitor from '@/components/SerialMonitor';
import Toolbar from '@/components/Toolbar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Code, Terminal, Radio, Home, Settings, LogOut, Cloud, Sparkles, Cpu } from 'lucide-react';
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
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background p-3 md:p-5 box-border overflow-hidden font-sans">
        
        {/* === SIDEBAR CLAYMORPHISM === */}
        <Sidebar className="border-none bg-transparent shadow-none z-50" collapsible="icon">
          <SidebarContent className="ide-panel mx-2 my-2 transition-all duration-300 overflow-hidden">
            
            {/* Header con Logo */}
            <SidebarHeader className="p-5 pb-4">
              <motion.div 
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black shadow-lg glow-primary">
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="group-data-[collapsible=icon]:hidden">
                  <span className="font-black text-primary text-xl tracking-tight block">
                    ArduIDE
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Para pequeños inventores ✨
                  </span>
                </div>
              </motion.div>
            </SidebarHeader>

            {/* Menu Items */}
            <SidebarMenu className="px-3 py-2 gap-1.5">
              {[
                { icon: Home, label: 'Inicio', active: true },
                { icon: Cloud, label: 'Mis Proyectos', active: false },
                { icon: Sparkles, label: 'Tutoriales', active: false },
                { icon: Settings, label: 'Ajustes', active: false },
              ].map((item, index) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton 
                    className={`h-12 rounded-xl font-bold transition-all duration-200 ${
                      item.active 
                        ? 'bg-gradient-to-r from-primary/15 to-secondary/10 text-primary shadow-sm' 
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            {/* Footer con Usuario */}
            <SidebarFooter className="p-4 mt-auto">
              {isAuthenticated ? (
                <motion.div 
                  className="clay-btn p-3 flex items-center gap-3 group-data-[collapsible=icon]:justify-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-bold truncate text-foreground">{user?.email}</p>
                    <button 
                      onClick={() => signOut()} 
                      className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 mt-0.5 font-bold transition-colors"
                    >
                      <LogOut className="w-3 h-3" /> Cerrar sesión
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground font-semibold group-data-[collapsible=icon]:hidden bg-muted/30 rounded-xl">
                  👋 No conectado
                </div>
              )}
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>

        {/* === CONTENIDO PRINCIPAL === */}
        <main className="flex-1 flex flex-col min-w-0 gap-4 h-full relative z-10 pl-2">
          
          {/* Barra Rainbow decorativa */}
          <div className="rainbow-bar rounded-full mx-4" />
          
          {/* TOOLBAR */}
          <div className="w-full relative z-20">
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
            className="toolbar-island mx-2 mb-1 justify-between text-xs font-bold text-muted-foreground"
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

        </main>
      </div>
    </SidebarProvider>
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
