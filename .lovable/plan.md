
# Plan de Implementacion - ArduIDE Modo Local

## Resumen
Convertir la aplicacion a modo completamente local (sin nube), agregar logo, eliminar autenticacion, permitir edicion del nombre del proyecto, corregir bug de scroll de Blockly y mejorar responsive.

---

## 1. Modo Local - Guardar/Abrir desde PC

### Que se hara:
- Agregar botones "Exportar a PC" y "Abrir desde PC" en el Toolbar
- Usar la API nativa del navegador `File System Access API` (showSaveFilePicker/showOpenFilePicker)
- Formato de archivo: `.arduide` (JSON con blocklyXml, generatedCode, board, name)
- Fallback para navegadores sin soporte: descargar como archivo y input file para abrir

### Archivos a modificar:
- `src/lib/storage.ts` - Agregar funciones `exportToFile()` y `importFromFile()`
- `src/components/Toolbar.tsx` - Agregar botones de Exportar/Importar PC

### Formato del archivo .arduide:
```text
{
  "name": "Mi Proyecto",
  "blocklyXml": "<xml>...</xml>",
  "generatedCode": "void setup()...",
  "board": "arduino:avr:nano",
  "version": "1.0",
  "exportedAt": "2026-02-02T..."
}
```

---

## 2. Agregar Logo con Favicon

### Que se hara:
- Crear componente de header con el logo (usando favicon.ico)
- Mostrar nombre del proyecto editable junto al logo
- Agregar el logo en la barra superior del IDE

### Archivos a crear/modificar:
- `src/components/Header.tsx` - Nuevo componente con logo y nombre del proyecto
- `src/pages/Index.tsx` - Integrar el nuevo Header

---

## 3. Eliminar Login y Cloud Sync

### Que se eliminara:
- Boton "Iniciar Sesion" del Toolbar
- Boton "Sync" del Toolbar  
- Opcion "Cargar de la Nube" del dropdown
- Componente AuthDialog
- Hook useAuth (importaciones)
- Funciones onSyncToCloud y onLoadFromCloud

### Archivos a modificar:
- `src/components/Toolbar.tsx` - Remover botones de auth y sync
- `src/pages/Index.tsx` - Remover imports y funciones de cloud/auth
- Mantener `src/lib/cloud-storage.ts` solo para `compileArduinoCode()` (compilacion)

---

## 4. Barra para Cambiar Nombre del Proyecto

### Que se hara:
- Input editable en el Header que muestre el nombre actual
- Click para editar, Enter/blur para guardar
- Actualizar el proyecto en IndexedDB al cambiar nombre
- Si no hay proyecto, mostrar "Proyecto sin guardar"

### Archivos a modificar:
- `src/components/Header.tsx` - Input editable con estado
- `src/contexts/IDEContext.tsx` - Agregar funcion `renameProject()`

---

## 5. Correccion Bug Scroll de Bloques

### Problema identificado:
Cuando se cierra/abre el toolbox de Blockly, el scroll puede quedar en estado inconsistente

### Solucion:
- Llamar `Blockly.svgResize()` despues de cambios de visibilidad
- Agregar cleanup apropiado en el useEffect
- Forzar resize cuando el panel cambia de tamano

### Archivos a modificar:
- `src/components/BlocklyEditor.tsx` - Mejorar manejo de resize y cleanup

---

## 6. Mejoras Responsive

### Que se mejorara:
- Toolbar: stack vertical en movil, iconos sin texto en pantallas pequenas
- Paneles: en movil, tabs fullscreen en lugar de split
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Touch: areas de tap mas grandes en botones

### Archivos a modificar:
- `src/pages/Index.tsx` - Layout adaptativo con useIsMobile()
- `src/components/Toolbar.tsx` - Toolbar responsive con wrap
- `src/index.css` - Media queries para ajustes finos

---

## Seccion Tecnica

### Dependencias:
No se requieren nuevas dependencias

### Estructura de cambios por archivo:

```text
src/
  components/
    Header.tsx           [NUEVO] - Logo + nombre editable
    Toolbar.tsx          [MODIFICAR] - Remover auth, agregar export/import PC
    BlocklyEditor.tsx    [MODIFICAR] - Fix resize/scroll
    AuthDialog.tsx       [MANTENER] - No eliminar por si se necesita despues
  contexts/
    IDEContext.tsx       [MODIFICAR] - Agregar renameProject()
  hooks/
    useAuth.ts           [MANTENER] - Solo remover imports donde se usa
  lib/
    storage.ts           [MODIFICAR] - Agregar exportToFile/importFromFile
    cloud-storage.ts     [MANTENER] - Solo para compilacion
  pages/
    Index.tsx            [MODIFICAR] - Integrar Header, layout responsive
  index.css              [MODIFICAR] - Media queries responsive
```

### Flujo de guardado local:
```text
Usuario clickea "Guardar en PC"
         |
         v
showSaveFilePicker() / fallback download
         |
         v
Genera JSON con proyecto actual
         |
         v
Guarda archivo .arduide en PC
```

### Flujo de abrir local:
```text
Usuario clickea "Abrir desde PC"
         |
         v
showOpenFilePicker() / input file
         |
         v
Lee y parsea archivo .arduide
         |
         v
Carga bloques en workspace
         |
         v
Genera codigo automaticamente
```
