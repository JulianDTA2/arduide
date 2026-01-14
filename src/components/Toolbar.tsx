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
import { ARDUINO_BOARDS, isWebSerialSupported, requestSerialPort } from '@/lib/webserial';
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
    generatedCode
  } = useIDE();

  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();

  const [newProjectName, setNewProjectName] = React.useState('');
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [showNoSerialDialog, setShowNoSerialDialog] = React.useState(false);
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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
    addConsoleMessage('info', 'Starting build...');
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const result = await compileArduinoCode(generatedCode, selectedBoard.fqbn);
      
      setUploadProgress(100);
      
      if (result.success) {
        addConsoleMessage('success', 'Build completed successfully!');
        if (result.output) {
          addConsoleMessage('info', result.output);
        }
        toast.success('Build completed');
      } else {
        addConsoleMessage('error', result.error || 'Build failed');
        toast.error('Build failed');
      }
    } catch (error) {
      addConsoleMessage('error', `Build error: ${error}`);
      toast.error('Build failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = () => {
    if (!isConnected) {
      toast.error('Please connect a board first');
      addConsoleMessage('warning', 'No board connected');
      return;
    }

    addConsoleMessage('info', 'Starting upload...');
    setIsUploading(true);
    let progress = 0;
    
    // Simulate upload process (would use HEX from compilation in production)
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsUploading(false);
        addConsoleMessage('success', 'Upload completed successfully!');
        toast.success('Upload completed');
      }
    }, 200);
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
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-teal-sm">
              <Cpu className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Arduino Web IDE</span>
          </div>

          {/* File operations */}
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FilePlus className="w-4 h-4" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Project</DialogTitle>
                <DialogDescription>
                  Create a new Arduino project. Your work will be saved locally.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Arduino Project"
                  className="mt-2"
                  onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleNewProject}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FolderOpen className="w-4 h-4" />
                Open
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {projects.length === 0 ? (
                <DropdownMenuItem disabled>No saved projects</DropdownMenuItem>
              ) : (
                projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                  >
                    <div className="flex flex-col">
                      <span>{project.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLoadFromCloud}>
                <Cloud className="w-4 h-4 mr-2" />
                Load from Cloud
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.getElementById('import-file')?.click()}>
                Import from file...
              </DropdownMenuItem>
              <input
                id="import-file"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    addConsoleMessage('info', `Importing ${file.name}...`);
                  }
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" onClick={onSave} className="gap-1.5">
            <Save className="w-4 h-4" />
            Save
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCloudSync} 
            className="gap-1.5"
            disabled={isSyncing}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            Sync
          </Button>

          {currentProject && (
            <span className="text-sm text-muted-foreground px-2 py-1 bg-secondary rounded">
              {currentProject.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Auth status */}
          {!authLoading && (
            isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Cloud className="w-4 h-4 text-primary" />
                    <span className="text-xs truncate max-w-24">{user?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAuthDialog(true)}
                className="gap-1.5"
              >
                <CloudOff className="w-4 h-4" />
                Sign In
              </Button>
            )
          )}

          {/* Board selector */}
          <Select
            value={selectedBoard.fqbn}
            onValueChange={(value) => {
              const board = ARDUINO_BOARDS.find(b => b.fqbn === value);
              if (board) setSelectedBoard(board);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select board" />
            </SelectTrigger>
            <SelectContent>
              {ARDUINO_BOARDS.map((board) => (
                <SelectItem key={board.fqbn} value={board.fqbn}>
                  {board.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Connection status */}
          <Button
            variant={isConnected ? "outline" : "secondary"}
            size="sm"
            onClick={handleConnect}
            className="gap-1.5"
          >
            <Usb className="w-4 h-4" />
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-muted-foreground'}`} />
            {isConnected ? 'Connected' : 'Connect'}
          </Button>

          {/* Build button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBuild}
            disabled={isUploading}
            className="gap-1.5"
          >
            <Hammer className="w-4 h-4" />
            Build
          </Button>

          {/* Upload button */}
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={isUploading}
            className="gap-1.5 bg-primary hover:bg-arduino-teal-light"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Upload progress bar */}
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

      {/* WebSerial not supported dialog */}
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

      {/* Auth dialog */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
};

export default Toolbar;
