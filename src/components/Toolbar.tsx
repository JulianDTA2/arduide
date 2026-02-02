import React from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { 
  Usb, 
  Upload, 
  Hammer,
  Save,
  FolderOpen,
  FilePlus,
  AlertCircle,
  Download,
  HardDrive,
  FileCode
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
import { exportToFile, importFromFile, exportAsIno } from '@/lib/file-operations';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './Header';

interface ToolbarProps {
  onSave: () => void;
  onNewProject: (name: string) => void;
  onOpenProject: (id: string) => void;
  onImportProject: (blocklyXml: string, name: string, board: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onSave, 
  onNewProject, 
  onOpenProject,
  onImportProject
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

  const [newProjectName, setNewProjectName] = React.useState('');
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [showNoSerialDialog, setShowNoSerialDialog] = React.useState(false);
  const [compiledHex, setCompiledHex] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  React.useEffect(() => {
    if (compiledHex) {
      setCompiledHex(null);
    }
  }, [generatedCode]);

  const handleConnect = async () => {
    if (!isWebSerialSupported()) {
      setShowNoSerialDialog(true);
      return;
    }

    try {
      const port = await requestSerialPort();
      if (port) {
        setIsConnected(true);
        addConsoleMessage('success', 'Placa conectada');
        toast.success('Placa conectada');
      }
    } catch (error) {
      addConsoleMessage('error', `Error de conexión: ${error}`);
      toast.error('Error al conectar con la placa');
    }
  };

  const handleBuild = async () => {
    addConsoleMessage('info', '━━━ Iniciando compilación ━━━');
    addConsoleMessage('info', `Placa: ${selectedBoard.name} (${selectedBoard.fqbn})`);
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
          addConsoleMessage('success', '✓ ¡Compilación exitosa! Archivo HEX listo.');
        }
        if (result.output) {
          result.output.split('\n').forEach(line => {
            if (line.trim()) {
              addConsoleMessage('info', line);
            }
          });
        }
        toast.success('¡Compilación completada!');
      } else {
        setCompiledHex(null);
        addConsoleMessage('error', '✗ Error de compilación');
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
        toast.error('Error de compilación - revisa la consola');
      }
      setUploadProgress(100);
    } catch (error) {
      addConsoleMessage('error', `Error: ${error}`);
      toast.error('Error de compilación');
      setCompiledHex(null);
    } finally {
      setTimeout(() => setIsUploading(false), 500);
    }
  };

  const handleUpload = async () => {
    if (isConnected) {
      addConsoleMessage('info', 'Cerrando conexión serial...');
      setIsConnected(false);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    let hexToUpload = compiledHex;

    if (!hexToUpload) {
      addConsoleMessage('info', 'Compilando primero...');
      addConsoleMessage('info', '━━━ Iniciando compilación ━━━');
      addConsoleMessage('info', `Placa: ${selectedBoard.name} (${selectedBoard.fqbn})`);
      setIsUploading(true);
      setUploadProgress(10);
      setActiveTab('console');

      try {
        setUploadProgress(30);
        const result = await compileArduinoCode(generatedCode, selectedBoard.fqbn);
        setUploadProgress(90);
        
        if (result.success && result.hex) {
          hexToUpload = result.hex;
          setCompiledHex(result.hex);
          addConsoleMessage('success', '✓ ¡Compilación exitosa!');
          if (result.output) {
            result.output.split('\n').forEach(line => {
              if (line.trim()) addConsoleMessage('info', line);
            });
          }
        } else {
          setCompiledHex(null);
          addConsoleMessage('error', '✗ Error de compilación');
          if (result.error) addConsoleMessage('error', result.error);
          if (result.output) {
            result.output.split('\n').forEach(line => {
              if (line.trim()) addConsoleMessage('warning', line);
            });
          }
          toast.error('Error de compilación');
          setIsUploading(false);
          return;
        }
      } catch (error) {
        addConsoleMessage('error', `Error: ${error}`);
        toast.error('Error de compilación');
        setIsUploading(false);
        return;
      }
    }

    addConsoleMessage('info', '━━━ Subiendo a la placa ━━━');
    addConsoleMessage('info', `Destino: ${selectedBoard.name}`);
    if (!isUploading) setIsUploading(true);
    setActiveTab('console');

    try {
      const port = await requestSerialPort();
      if (!port) {
        addConsoleMessage('warning', 'Subida cancelada - sin puerto seleccionado');
        setIsUploading(false);
        return;
      }

      const hexData = parseHexFile(hexToUpload);
      addConsoleMessage('info', `Tamaño del firmware: ${hexData.length} bytes`);

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
          addConsoleMessage('info', debugMsg);
        }
      );

      addConsoleMessage('success', '✓ ¡Subida completada!');
      toast.success('¡Programa subido correctamente!');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addConsoleMessage('error', `✗ Error de subida: ${errorMsg}`);
      toast.error('Error al subir');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleNewProject = () => {
    if (!newProjectName.trim()) {
      toast.error('Ingresa un nombre para el proyecto');
      return;
    }
    onNewProject(newProjectName);
    setNewProjectName('');
    setShowNewDialog(false);
  };

  // Export project to PC
  const handleExportToPC = async () => {
    const projectName = currentProject?.name || 'MiProyecto';
    
    // Get current Blockly XML from workspace
    const workspace = (window as any).Blockly?.getMainWorkspace();
    let blocklyXml = '';
    if (workspace) {
      const xml = (window as any).Blockly.Xml.workspaceToDom(workspace);
      blocklyXml = (window as any).Blockly.Xml.domToText(xml);
    }

    const success = await exportToFile(
      projectName,
      blocklyXml || currentProject?.blocklyXml || '',
      generatedCode,
      selectedBoard.fqbn
    );

    if (success) {
      toast.success('Proyecto exportado a PC');
      addConsoleMessage('success', `Proyecto "${projectName}" guardado en PC`);
    }
  };

  // Export as .ino file
  const handleExportAsIno = async () => {
    const projectName = currentProject?.name || 'MiProyecto';
    const success = await exportAsIno(generatedCode, projectName);
    
    if (success) {
      toast.success('Archivo .ino exportado');
      addConsoleMessage('success', `Código exportado como ${projectName}.ino`);
    }
  };

  // Import project from PC
  const handleImportFromPC = async () => {
    const file = await importFromFile();
    
    if (file) {
      onImportProject(file.blocklyXml, file.name, file.board);
      toast.success(`Proyecto "${file.name}" cargado`);
      addConsoleMessage('success', `Proyecto "${file.name}" importado desde PC`);
    }
  };

  return (
    <>
      <div className="toolbar-island flex-wrap gap-2">
        {/* Header with Logo and Project Name */}
        <Header />

        {/* Separator */}
        <div className="h-8 w-px bg-border hidden md:block" />

        {/* Left Section - File Operations */}
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
                <DialogTitle className="text-xl font-black text-primary">Nuevo Proyecto</DialogTitle>
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
                  placeholder="Mi Proyecto Arduino"
                  className="neu-input mt-2"
                  onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowNewDialog(false)} className="clay-btn">
                  Cancelar
                </Button>
                <Button onClick={handleNewProject} className="clay-btn clay-btn-primary">
                  Crear
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
              <DropdownMenuItem onClick={handleImportFromPC} className="rounded-xl font-medium">
                <HardDrive className="w-4 h-4 mr-2 text-primary" />
                Abrir desde PC (.arduide)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {projects.length === 0 ? (
                <DropdownMenuItem disabled className="rounded-xl">Sin proyectos recientes</DropdownMenuItem>
              ) : (
                <>
                  <div className="px-2 py-1 text-xs text-muted-foreground font-bold">Proyectos recientes:</div>
                  {projects.slice(0, 5).map((project) => (
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
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={onSave} className="clay-btn gap-2 text-xs">
            <Save className="w-4 h-4 text-success" />
            <span className="hidden sm:inline">Guardar</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="clay-btn gap-2 text-xs">
                <Download className="w-4 h-4 text-warning" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 ide-panel border-none p-2">
              <DropdownMenuItem onClick={handleExportToPC} className="rounded-xl font-medium">
                <HardDrive className="w-4 h-4 mr-2 text-primary" />
                Guardar en PC (.arduide)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAsIno} className="rounded-xl font-medium">
                <FileCode className="w-4 h-4 mr-2 text-success" />
                Exportar código (.ino)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-border hidden md:block" />

        {/* Right Section - Hardware */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <Select
            value={selectedBoard.fqbn}
            onValueChange={(value) => {
              const board = ARDUINO_BOARDS.find(b => b.fqbn === value);
              if (board) setSelectedBoard(board);
            }}
          >
            <SelectTrigger className="neu-input w-[140px] sm:w-[160px] h-10 text-xs font-bold">
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
            <div>
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
              WebSerial No Soportado
            </DialogTitle>
            <DialogDescription className="pt-2">
              Tu navegador no soporta la API WebSerial, necesaria para conectar con placas Arduino.
              <br /><br />
              <strong>Para usar esta función:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Usa Google Chrome (versión 89+)</li>
                <li>Usa Microsoft Edge (versión 89+)</li>
                <li>Usa Opera (versión 75+)</li>
              </ul>
              <br />
              Safari, Firefox y navegadores móviles no son compatibles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowNoSerialDialog(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Toolbar;
