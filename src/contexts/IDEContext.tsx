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

// Definiciones de tipos para mensajes
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
  // --- 1. GESTIÓN DE PROYECTOS (Necesario para Toolbar) ---
  currentProject: Project | null;
  projects: Project[];
  versions: ProjectVersion[];
  isLoading: boolean;
  
  // --- 2. GESTIÓN DE CÓDIGO (Editable) ---
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
  
  // --- 5. ACCIONES (Load, Save, etc.) ---
  loadProjects: () => Promise<void>;
  createNewProject: (name: string, blocklyXml: string, code: string) => Promise<Project>;
  openProject: (id: string) => Promise<void>;
  saveProject: (blocklyXml: string, code: string) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  loadVersions: () => Promise<void>;
  
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
  // --- ESTADOS ---
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // CÓDIGO POR DEFECTO: Pin 13 (LED integrado) para verificar funcionalidad
  const [generatedCode, setGeneratedCode] = useState(`void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`);

  const [selectedBoard, setSelectedBoard] = useState<ArduinoBoard>(ARDUINO_BOARDS[1]); // Nano Default
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [serialBaudRate, setSerialBaudRate] = useState(9600);
  const [activeTab, setActiveTab] = useState<'code' | 'console' | 'serial'>('code');

  // --- FUNCIONES DE CONSOLA/SERIAL ---
  const addConsoleMessage = useCallback((type: ConsoleMessage['type'], message: string) => {
    setConsoleMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date()
    }]);
  }, []);

  const clearConsole = useCallback(() => setConsoleMessages([]), []);

  const addSerialMessage = useCallback((type: SerialMessage['type'], content: string) => {
    setSerialMessages(prev => [...prev.slice(-99), { // Guardar últimos 100
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date()
    }]);
  }, []);

  const clearSerialMessages = useCallback(() => setSerialMessages([]), []);

  // --- FUNCIONES DE PROYECTOS ---
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects.reverse());
    } catch (error) {
      addConsoleMessage('error', `Failed to load projects: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [addConsoleMessage]);

  const createNewProject = useCallback(async (name: string, blocklyXml: string, code: string): Promise<Project> => {
    const project = await createProject(name, blocklyXml, code, selectedBoard.fqbn);
    setCurrentProject(project);
    setGeneratedCode(code); // Actualizar editor
    await loadProjects();
    addConsoleMessage('success', `Created new project: ${name}`);
    return project;
  }, [selectedBoard.fqbn, loadProjects, addConsoleMessage]);

  const openProject = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const project = await getProject(id);
      if (project) {
        setCurrentProject(project);
        setGeneratedCode(project.generatedCode); // Cargar código al editor
        const board = ARDUINO_BOARDS.find(b => b.fqbn === project.board);
        if (board) setSelectedBoard(board);
        addConsoleMessage('info', `Opened project: ${project.name}`);
      }
    } catch (error) {
      addConsoleMessage('error', `Failed to open project: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [addConsoleMessage]);

  const saveProject = useCallback(async (blocklyXml: string, code: string) => {
    // FIX IMPORTANTE: Usar el código del editor (generatedCode) si existe, 
    // para no perder los cambios manuales al guardar.
    const codeToSave = generatedCode || code;

    if (!currentProject) {
      await createNewProject('Untitled Project', blocklyXml, codeToSave);
      return;
    }
    
    try {
      const updated = await updateProject(currentProject.id, {
        blocklyXml,
        generatedCode: codeToSave,
        board: selectedBoard.fqbn
      });
      if (updated) {
        setCurrentProject(updated);
        addConsoleMessage('success', 'Project saved');
      }
    } catch (error) {
      addConsoleMessage('error', `Failed to save project: ${error}`);
    }
  }, [currentProject, generatedCode, selectedBoard.fqbn, createNewProject, addConsoleMessage]);

  const deleteCurrentProject = useCallback(async () => {
    if (!currentProject) return;
    try {
      await deleteProject(currentProject.id);
      setCurrentProject(null);
      setGeneratedCode('');
      await loadProjects();
      addConsoleMessage('info', 'Project deleted');
    } catch (error) {
      addConsoleMessage('error', `Failed to delete project: ${error}`);
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
      addConsoleMessage('error', `Failed to load versions: ${error}`);
    }
  }, [currentProject, addConsoleMessage]);

  // Objeto de valor para el Provider
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
    activeTab,
    setActiveTab
  };

  return (
    <IDEContext.Provider value={value}>
      {children}
    </IDEContext.Provider>
  );
};