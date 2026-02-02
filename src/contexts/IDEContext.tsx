import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { 
  Project, 
  createProject, 
  getProject, 
  getAllProjects, 
  updateProject, 
  deleteProject,
  getProjectVersions,
  ProjectVersion
} from '@/lib/storage';
import { ArduinoBoard, ARDUINO_BOARDS } from '@/lib/webserial';

export interface ConsoleMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

export interface SerialMessage {
  id: string;
  type: 'sent' | 'received';
  content: string;
  timestamp: Date;
}

interface IDEContextType {
  // --- 1. GESTIÓN DE PROYECTOS ---
  currentProject: Project | null;
  projects: Project[];
  versions: ProjectVersion[];
  isLoading: boolean;
  
  // --- 2. GESTIÓN DE CÓDIGO ---
  generatedCode: string;
  setGeneratedCode: (code: string) => void;
  
  // --- 3. HARDWARE Y CONEXIÓN ---
  selectedBoard: ArduinoBoard;
  setSelectedBoard: (board: ArduinoBoard) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  isUploading: boolean;
  setIsUploading: (uploading: boolean) => void;
  uploadProgress: number;
  setUploadProgress: (progress: number) => void;
  
  // --- 4. CONSOLA Y SERIAL ---
  consoleMessages: ConsoleMessage[];
  addConsoleMessage: (type: ConsoleMessage['type'], message: string) => void;
  clearConsole: () => void;
  serialMessages: SerialMessage[];
  addSerialMessage: (type: SerialMessage['type'], content: string) => void;
  clearSerialMessages: () => void;
  serialBaudRate: number;
  setSerialBaudRate: (rate: number) => void;
  
  // --- 5. ACCIONES ---
  loadProjects: () => Promise<void>;
  createNewProject: (name: string, blocklyXml: string, code: string) => Promise<Project>;
  openProject: (id: string) => Promise<void>;
  saveProject: (blocklyXml: string, code: string) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  loadVersions: () => Promise<void>;
  renameProject: (newName: string) => Promise<void>;
  importProject: (blocklyXml: string, name: string, board: string) => Promise<void>;
  
  // --- 6. PESTAÑAS ---
  activeTab: 'code' | 'console' | 'serial';
  setActiveTab: (tab: 'code' | 'console' | 'serial') => void;
}

const IDEContext = createContext<IDEContextType | null>(null);

export const useIDE = () => {
  const context = useContext(IDEContext);
  if (!context) {
    throw new Error('useIDE must be used within an IDEProvider');
  }
  return context;
};

interface IDEProviderProps {
  children: ReactNode;
}

export const IDEProvider: React.FC<IDEProviderProps> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [generatedCode, setGeneratedCode] = useState(`
    void setup() {
      pinMode(13, OUTPUT);
    }

    void loop() {
      digitalWrite(13, HIGH);
      delay(1000);
      digitalWrite(13, LOW);
      delay(1000);
    }`);

  const [selectedBoard, setSelectedBoard] = useState<ArduinoBoard>(ARDUINO_BOARDS[1]);
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [serialBaudRate, setSerialBaudRate] = useState(9600);
  const [activeTab, setActiveTab] = useState<'code' | 'console' | 'serial'>('code');

  const addConsoleMessage = useCallback((type: ConsoleMessage['type'], message: string) => {
    setConsoleMessages(prev => [
      {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date()
      },
      ...prev
    ]);
  }, []);

  const clearConsole = useCallback(() => setConsoleMessages([]), []);

  const addSerialMessage = useCallback((type: SerialMessage['type'], content: string) => {
    setSerialMessages(prev => [...prev.slice(-99), {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date()
    }]);
  }, []);

  const clearSerialMessages = useCallback(() => setSerialMessages([]), []);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects.reverse());
    } catch (error) {
      addConsoleMessage('error', `Error al cargar proyectos: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [addConsoleMessage]);

  const createNewProject = useCallback(async (name: string, blocklyXml: string, code: string): Promise<Project> => {
    const project = await createProject(name, blocklyXml, code, selectedBoard.fqbn);
    setCurrentProject(project);
    setGeneratedCode(code);
    await loadProjects();
    addConsoleMessage('success', `Proyecto creado: ${name}`);
    return project;
  }, [selectedBoard.fqbn, loadProjects, addConsoleMessage]);

  const openProject = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const project = await getProject(id);
      if (project) {
        setCurrentProject(project);
        setGeneratedCode(project.generatedCode);
        const board = ARDUINO_BOARDS.find(b => b.fqbn === project.board);
        if (board) setSelectedBoard(board);
        addConsoleMessage('info', `Proyecto abierto: ${project.name}`);
      }
    } catch (error) {
      addConsoleMessage('error', `Error al abrir proyecto: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [addConsoleMessage]);

  const saveProject = useCallback(async (blocklyXml: string, code: string) => {
    if (!currentProject) {
      await createNewProject('Proyecto sin título', blocklyXml, code);
      return;
    }
    
    try {
      const updated = await updateProject(currentProject.id, {
        blocklyXml,
        generatedCode: code, // Usar el parámetro 'code' pasado directamente
        board: selectedBoard.fqbn
      });
    } catch (error) {
      addConsoleMessage('error', `Error al guardar: ${error}`);
    }
  }, [currentProject, selectedBoard.fqbn, createNewProject]);

  const deleteCurrentProject = useCallback(async () => {
    if (!currentProject) return;
    try {
      await deleteProject(currentProject.id);
      setCurrentProject(null);
      setGeneratedCode('');
      await loadProjects();
      addConsoleMessage('info', 'Proyecto eliminado');
    } catch (error) {
      addConsoleMessage('error', `Error al eliminar: ${error}`);
    }
  }, [currentProject, loadProjects, addConsoleMessage]);

  const loadVersions = useCallback(async () => {
    if (!currentProject) {
      setVersions([]);
      return;
    }
    try {
      const projectVersions = await getProjectVersions(currentProject.id);
      setVersions(projectVersions);
    } catch (error) {
      addConsoleMessage('error', `Error al cargar versiones: ${error}`);
    }
  }, [currentProject, addConsoleMessage]);

  // Rename current project
  const renameProject = useCallback(async (newName: string) => {
    if (!currentProject) return;
    
    try {
      const updated = await updateProject(currentProject.id, { name: newName });
      if (updated) {
        setCurrentProject(updated);
        await loadProjects();
        addConsoleMessage('info', `Proyecto renombrado a: ${newName}`);
      }
    } catch (error) {
      addConsoleMessage('error', `Error al renombrar: ${error}`);
    }
  }, [currentProject, loadProjects, addConsoleMessage]);

  // Import project from file
  const importProject = useCallback(async (blocklyXml: string, name: string, board: string) => {
    const boardObj = ARDUINO_BOARDS.find(b => b.fqbn === board) || ARDUINO_BOARDS[0];
    setSelectedBoard(boardObj);
    
    // Create new project with imported data
    const project = await createProject(name, blocklyXml, '', board);
    setCurrentProject(project);
    await loadProjects();
    
    // Trigger workspace load - the BlocklyEditor will handle this via initialXml prop
    addConsoleMessage('success', `Proyecto importado: ${name}`);
  }, [loadProjects, addConsoleMessage]);

  const value: IDEContextType = {
    currentProject,
    projects,
    versions,
    isLoading,
    generatedCode,
    setGeneratedCode,
    selectedBoard,
    setSelectedBoard,
    isConnected,
    setIsConnected,
    isUploading,
    setIsUploading,
    uploadProgress,
    setUploadProgress,
    consoleMessages,
    addConsoleMessage,
    clearConsole,
    serialMessages,
    addSerialMessage,
    clearSerialMessages,
    serialBaudRate,
    setSerialBaudRate,
    loadProjects,
    createNewProject,
    openProject,
    saveProject,
    deleteCurrentProject,
    loadVersions,
    renameProject,
    importProject,
    activeTab,
    setActiveTab
  };

  return (
    <IDEContext.Provider value={value}>
      {children}
    </IDEContext.Provider>
  );
};
