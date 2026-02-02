import React, { useState, useRef, useEffect } from 'react';
import { useIDE } from '@/contexts/IDEContext';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const Header: React.FC = () => {
  const { currentProject, renameProject } = useIDE();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = currentProject?.name || 'Proyecto sin guardar';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (!currentProject) {
      toast.info('Guarda el proyecto primero para cambiarle el nombre');
      return;
    }
    setEditName(currentProject.name);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    
    if (currentProject && trimmedName !== currentProject.name) {
      await renameProject(trimmedName);
      toast.success('Nombre actualizado');
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img 
          src="/favicon.ico" 
          alt="ArduIDE Logo" 
          className="w-8 h-8 object-contain"
        />
        <span className="font-black text-lg text-primary hidden sm:inline">
          ArduIDE
        </span>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Editable Project Name */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="neu-input px-3 py-1.5 text-sm font-bold w-40 sm:w-56"
              placeholder="Nombre del proyecto"
            />
            <button
              onClick={handleSave}
              className="p-1.5 rounded-lg hover:bg-success/20 text-success transition-colors"
              title="Guardar"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/50 transition-colors group"
            title={currentProject ? 'Click para editar nombre' : 'Guarda el proyecto primero'}
          >
            <span className={`font-bold text-sm truncate max-w-32 sm:max-w-48 ${
              currentProject ? 'text-foreground' : 'text-muted-foreground italic'
            }`}>
              📁 {displayName}
            </span>
            {currentProject && (
              <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;
