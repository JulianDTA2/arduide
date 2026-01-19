import React from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { useAuth } from '@/hooks/useAuth';
import { 
  Cpu, 
  Usb, 
  Upload, 
  Hammer,
  Save,
  FolderOpen,
  FilePlus,
  AlertCircle,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ARDUINO_BOARDS, isWebSerialSupported, requestSerialPort, uploadToArduino, parseHexFile } from '@/lib/webserial';
import { compileArduinoCode } from '@/lib/cloud-storage';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthDialog } from './AuthDialog';

interface ToolbarProps {
  onSave: () => void;
  onNewProject: (name: string) => void;
  onOpenProject: (id: string) => void;
  onSyncToCloud?: () => void;
  onLoadFromCloud?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onSave, 
  onNewProject, 
  onOpenProject,
  onSyncToCloud,
  onLoadFromCloud 
}) => {
  const { 
    selectedBoard, 
    setSelectedBoard,
    isConnected,
    setIsConnected,
    isUploading,
    setIsUploading,
    uploadProgress,
    setUploadProgress,
    currentProject,
    projects,
    loadProjects,
    addConsoleMessage,
    generatedCode,
    setActiveTab
  } = useIDE();

  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();

  const [newProjectName, setNewProjectName] = React.useState('');
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [showNoSerialDialog, setShowNoSerialDialog] = React.useState(false);
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [compiledHex, setCompiledHex] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // --- CORRECCIÓN CRÍTICA ---
  // Este efecto borra la compilación guardada cada vez que cambias una letra en el código.
  // Esto obliga al botón Upload a recompilar con tus cambios nuevos.
  React.useEffect(() => {
    if (compiledHex) {
      setCompiledHex(null);
    }
  }, [generatedCode]);
  // ---------------------------

  const handleConnect = async () => {
    if (!isWebSerialSupported()) {
      setShowNoSerialDialog(true);
      return;
    }

    try {
      const port = await requestSerialPort();
      if (port) {
        setIsConnected(true);
        addConsoleMessage('success', 'Board connected');
        toast.success('Board connected');
      }
    } catch (error) {
      addConsoleMessage('error', `Connection failed: ${error}`);
      toast.error('Failed to connect to board');
    }
  };

  const handleBuild = async () => {
    addConsoleMessage('info', '━━━ Starting compilation ━━━');
    addConsoleMessage('info', `Board: ${selectedBoard.name} (${selectedBoard.fqbn})`);
    setIsUploading(true);
    setUploadProgress(10);
    setActiveTab('console');

    try {
      setUploadProgress(30);
      const result = await compileArduinoCode(generatedCode, selectedBoard.fqbn);
      setUploadProgress(90);
      
      if (result.success) {
        if (result.hex) {
          setCompiledHex(result.hex);
          addConsoleMessage('success', '✓ Compilation successful! HEX file ready.');
        }
        if (result.output) {
          result.output.split('\n').forEach(line => {
            if (line.trim()) {
              addConsoleMessage('info', line);
            }
          });
        }
        toast.success('Build completed - ready to upload!');
      } else {
        setCompiledHex(null);
        addConsoleMessage('error', '✗ Compilation failed');
        if (result.error) {
          addConsoleMessage('error', result.error);
        }
        if (result.output) {
          result.output.split('\n').forEach(line => {
            if (line.trim()) {
              addConsoleMessage('warning', line);
            }
          });
        }
        toast.error('Build failed - check console for details');
      }
      setUploadProgress(100);
    } catch (error) {
      addConsoleMessage('error', `Build error: ${error}`);
      toast.error('Build failed');
      setCompiledHex(null);
    } finally {
      setTimeout(() => setIsUploading(false), 500);
    }
  };

  const handleUpload = async () => {
    // 1. Cerrar conexión serial si existe (para evitar conflicto de puerto)
    if (isConnected) {
      addConsoleMessage('info', 'Closing serial connection before upload...');
      setIsConnected(false);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    let hexToUpload = compiledHex;

    // 2. Si no hay HEX o el código cambió (gracias al useEffect), compilamos de nuevo
    if (!hexToUpload) {
      addConsoleMessage('info', 'Source changed or no binary. Building first...');
      addConsoleMessage('info', '━━━ Starting compilation ━━━');
      addConsoleMessage('info', `Board: ${selectedBoard.name} (${selectedBoard.fqbn})`);
      setIsUploading(true);
      setUploadProgress(10);
      setActiveTab('console');

      try {
        setUploadProgress(30);
        // Compilamos el generatedCode ACTUAL
        const result = await compileArduinoCode(generatedCode, selectedBoard.fqbn);
        setUploadProgress(90);
        
        if (result.success && result.hex) {
          hexToUpload = result.hex;
          setCompiledHex(result.hex);
          addConsoleMessage('success', '✓ Compilation successful! HEX file ready.');
          if (result.output) {
            result.output.split('\n').forEach(line => {
              if (line.trim()) addConsoleMessage('info', line);
            });
          }
        } else {
          setCompiledHex(null);
          addConsoleMessage('error', '✗ Compilation failed');
          if (result.error) addConsoleMessage('error', result.error);
          if (result.output) {
            result.output.split('\n').forEach(line => {
              if (line.trim()) addConsoleMessage('warning', line);
            });
          }
          toast.error('Build failed - check console for details');
          setIsUploading(false);
          return;
        }
      } catch (error) {
        addConsoleMessage('error', `Build error: ${error}`);
        toast.error('Build failed');
        setIsUploading(false);
        return;
      }
    }

    addConsoleMessage('info', '━━━ Starting upload to board ━━━');
    addConsoleMessage('info', `Target: ${selectedBoard.name}`);
    if (!isUploading) setIsUploading(true);
    setActiveTab('console');

    try {
      const port = await requestSerialPort();
      if (!port) {
        addConsoleMessage('warning', 'Upload cancelled - no port selected');
        setIsUploading(false);
        return;
      }

      const hexData = parseHexFile(hexToUpload);
      addConsoleMessage('info', `Firmware size: ${hexData.length} bytes`);

      await uploadToArduino(
        port,
        hexData,
        selectedBoard,
        (progress) => {
          setUploadProgress(progress.progress);
          addConsoleMessage(
            progress.stage === 'error' ? 'error' : 'info',
            progress.message
          );
        },
        (debugMsg) => {
          // Mostrar bytes del bootloader en la consola IDE
          addConsoleMessage('info', debugMsg);
        }
      );

      addConsoleMessage('success', '✓ Upload completed successfully!');
      toast.success('Upload complete! Your Arduino is running the new code.');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addConsoleMessage('error', `✗ Upload failed: ${errorMsg}`);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleNewProject = () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    onNewProject(newProjectName);
    setNewProjectName('');
    setShowNewDialog(false);
  };

  const handleCloudSync = async () => {
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }
    
    setIsSyncing(true);
    try {
      if (onSyncToCloud) {
        await onSyncToCloud();
        toast.success('Project synced to cloud');
      }
    } catch (error) {
      toast.error('Failed to sync project');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadFromCloud = async () => {
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }
    
    if (onLoadFromCloud) {
      onLoadFromCloud();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
  };

  return (
    <>
      <div className="toolbar-island flex-wrap gap-2">
        {/* Left Section */}
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <button className="clay-btn gap-2 text-xs">
                <FilePlus className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            </DialogTrigger>
            <DialogContent className="ide-panel border-none">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-primary">✨ Nuevo Proyecto</DialogTitle>
                <DialogDescription>
                  Crea un nuevo proyecto Arduino. Tu trabajo se guardará automáticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="projectName" className="font-bold">Nombre del Proyecto</Label>
                <Input
                  id="projectName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Mi Proyecto Arduino 🤖"
                  className="neu-input mt-2"
                  onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowNewDialog(false)} className="clay-btn">
                  Cancelar
                </Button>
                <Button onClick={handleNewProject} className="clay-btn clay-btn-primary">
                  Crear 🚀
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="clay-btn gap-2 text-xs">
                <FolderOpen className="w-4 h-4 text-secondary" />
                <span className="hidden sm:inline">Abrir</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 ide-panel border-none p-2">
              {projects.length === 0 ? (
                <DropdownMenuItem disabled className="rounded-xl">Sin proyectos guardados</DropdownMenuItem>
              ) : (
                projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    className="rounded-xl font-medium"
                  >
                    <div className="flex flex-col">
                      <span>📁 {project.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLoadFromCloud} className="rounded-xl font-medium">
                <Cloud className="w-4 h-4 mr-2 text-primary" />
                Cargar de la Nube
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={onSave} className="clay-btn gap-2 text-xs">
            <Save className="w-4 h-4 text-success" />
            <span className="hidden sm:inline">Guardar</span>
          </button>

          <button 
            onClick={handleCloudSync} 
            className="clay-btn gap-2 text-xs"
            disabled={isSyncing}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Cloud className="w-4 h-4 text-primary" />
            )}
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-border hidden md:block" />

        {/* Right Section */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {!authLoading && !isAuthenticated && (
            <button 
              onClick={() => setShowAuthDialog(true)}
              className="clay-btn gap-2 text-xs"
            >
              <CloudOff className="w-4 h-4" />
              <span className="hidden sm:inline">Iniciar Sesión</span>
            </button>
          )}

          <Select
            value={selectedBoard.fqbn}
            onValueChange={(value) => {
              const board = ARDUINO_BOARDS.find(b => b.fqbn === value);
              if (board) setSelectedBoard(board);
            }}
          >
            <SelectTrigger className="neu-input w-[160px] h-10 text-xs font-bold">
              <SelectValue placeholder="Seleccionar placa" />
            </SelectTrigger>
            <SelectContent className="ide-panel border-none">
              {ARDUINO_BOARDS.map((board) => (
                <SelectItem key={board.fqbn} value={board.fqbn} className="font-medium rounded-lg">
                  {board.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={handleConnect}
            className={`clay-btn gap-2 text-xs ${isConnected ? 'clay-btn-success' : ''}`}
          >
            <Usb className="w-4 h-4" />
            <span className={`status-dot ${isConnected ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
            <span className="hidden sm:inline">{isConnected ? 'Conectado' : 'Conectar'}</span>
          </button>

          <button
            onClick={handleBuild}
            disabled={isUploading}
            className="clay-btn clay-btn-warning gap-2 text-xs"
          >
            <Hammer className="w-4 h-4" />
            <span className="hidden sm:inline">Compilar</span>
          </button>

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="clay-btn clay-btn-primary gap-2 text-xs"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Subir</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 bg-secondary/50 border-b border-border">
              <div className="flex items-center gap-3">
                <Progress value={uploadProgress} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground w-12">
                  {uploadProgress}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showNoSerialDialog} onOpenChange={setShowNoSerialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              WebSerial Not Supported
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your browser doesn't support WebSerial API, which is required to connect to Arduino boards.
              <br /><br />
              <strong>To use this feature:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Use Google Chrome (version 89+)</li>
                <li>Use Microsoft Edge (version 89+)</li>
                <li>Use Opera (version 75+)</li>
              </ul>
              <br />
              Safari, Firefox, and mobile browsers are not supported.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowNoSerialDialog(false)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
};

export default Toolbar;