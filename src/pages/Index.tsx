import React, { useState, useCallback, useRef, useEffect } from 'react';
import { IDEProvider, useIDE } from '@/contexts/IDEContext';
import BlocklyEditor from '@/components/BlocklyEditor';
import CodePanel from '@/components/CodePanel';
import ConsolePanel from '@/components/ConsolePanel';
import SerialMonitor from '@/components/SerialMonitor';
import Toolbar from '@/components/Toolbar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Terminal, Radio, GripVertical } from 'lucide-react';
import * as Blockly from 'blockly';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { 
  syncProjectToCloud, 
  getAllCloudProjects, 
  getCloudProject,
  type CloudProject 
} from '@/lib/cloud-storage';
import { toast } from 'sonner';

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
  
  const { isAuthenticated } = useAuth();
  const [cloudProjectId, setCloudProjectId] = useState<string | undefined>();

  const [splitPosition, setSplitPosition] = useState(60); // percentage
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Get workspace reference for saving
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
    // Reload workspace with project XML
    addConsoleMessage('info', 'Loading project workspace...');
  }, [openProject, addConsoleMessage]);

  // Cloud sync functions
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
      addConsoleMessage('success', 'Project synced to cloud');
    } else {
      addConsoleMessage('error', 'Failed to sync project to cloud');
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

    // Load the most recent cloud project
    const latestProject = cloudProjects[0];
    setCloudProjectId(latestProject.id);
    
    // Create a local project from cloud data
    await createNewProject(
      latestProject.name,
      latestProject.blockly_xml,
      latestProject.generated_code
    );
    
    addConsoleMessage('success', `Loaded cloud project: ${latestProject.name}`);
  }, [isAuthenticated, createNewProject, addConsoleMessage]);

  // Drag to resize panels
  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
    
    // Clamp between 30% and 80%
    setSplitPosition(Math.max(30, Math.min(80, newPosition)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentProject) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentProject, handleSave]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Toolbar 
        onSave={handleSave}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSyncToCloud={handleSyncToCloud}
        onLoadFromCloud={handleLoadFromCloud}
      />
      
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
      >
        {/* Blockly workspace */}
        <motion.div 
          className="bg-panel-bg overflow-hidden"
          style={{ width: `${splitPosition}%` }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <BlocklyEditor 
            initialXml={currentProject?.blocklyXml}
          />
        </motion.div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group transition-colors"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Right panel with tabs */}
        <motion.div 
          className="flex flex-col bg-panel-bg overflow-hidden"
          style={{ width: `${100 - splitPosition}%` }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Tab headers */}
          <div className="bg-panel-header border-b border-panel-border px-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-transparent h-10 p-0">
                <TabsTrigger 
                  value="code" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                >
                  <Code className="w-4 h-4 mr-2" />
                  Code
                </TabsTrigger>
                <TabsTrigger 
                  value="console"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  Console
                </TabsTrigger>
                <TabsTrigger 
                  value="serial"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                >
                  <Radio className="w-4 h-4 mr-2" />
                  Serial
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'code' && <CodePanel />}
            {activeTab === 'console' && <ConsolePanel />}
            {activeTab === 'serial' && <SerialMonitor />}
          </div>
        </motion.div>
      </div>

      {/* Status bar */}
      <div className="h-6 bg-card border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Arduino Web IDE v1.0</span>
          {currentProject && (
            <span>Project: {currentProject.name}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Auto-save: ON</span>
        </div>
      </div>
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
