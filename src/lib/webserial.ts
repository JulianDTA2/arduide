// src/lib/webserial.ts

interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  getSignals(): Promise<{ dataCarrierDetect: boolean; clearToSend: boolean; ringIndicator: boolean; dataSetReady: boolean }>;
}

interface Serial {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

declare global {
  interface Navigator {
    serial: Serial;
  }
}

export interface SerialConnection {
  port: SerialPort;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  isConnected: boolean;
}

export interface ArduinoBoard {
  name: string;
  fqbn: string;
  uploadProtocol: string;
  baudRate: number;
}

// Configuración unificada - Auto-detect habilitado
export const ARDUINO_BOARDS: ArduinoBoard[] = [
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', uploadProtocol: 'stk500v1', baudRate: 115200 },
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', uploadProtocol: 'stk500v1', baudRate: 115200 },
  { name: 'Arduino Nano (Old Bootloader)', fqbn: 'arduino:avr:nano:cpu=atmega328old', uploadProtocol: 'stk500v1', baudRate: 57600 },
  { name: 'Arduino Mega', fqbn: 'arduino:avr:mega', uploadProtocol: 'stk500v2', baudRate: 115200 }
];

export const isWebSerialSupported = (): boolean => 'serial' in navigator;

export const requestSerialPort = async (): Promise<SerialPort | null> => {
  if (!isWebSerialSupported()) throw new Error('WebSerial not supported');
  try { return await navigator.serial.requestPort(); }
  catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') return null; throw error; }
};

export const openSerialConnection = async (port: SerialPort, baudRate: number = 9600): Promise<SerialConnection> => {
  await port.open({ baudRate });
  return { port, reader: port.readable?.getReader() ?? null, writer: port.writable?.getWriter() ?? null, isConnected: true };
};

export const closeSerialConnection = async (connection: SerialConnection): Promise<void> => {
  const { reader, writer, port } = connection;
  try { if (reader) { await reader.cancel(); reader.releaseLock(); } } catch (e) { console.warn(e); }
  try { if (writer) { await writer.close(); writer.releaseLock(); } } catch (e) { console.warn(e); }
  try { await port.close(); } catch (e) { console.warn(e); }
};

export const writeToSerial = async (connection: SerialConnection, data: string): Promise<void> => {
  if (!connection.writer) throw new Error('No writer');
  await connection.writer.write(new TextEncoder().encode(data));
};

const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const STK_GET_SYNC = 0x30;
const STK_ENTER_PROGMODE = 0x50;
const STK_LEAVE_PROGMODE = 0x51;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;
const CRC_EOP = 0x20;

export interface UploadProgress {
  stage: 'connecting' | 'syncing' | 'uploading' | 'verifying' | 'done' | 'error';
  progress: number;
  message: string;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;
export type DebugLogCallback = (message: string) => void;

export const parseHexFile = (hexContent: string): Uint8Array => {
  const lines = hexContent.split('\n').filter(line => line.startsWith(':'));
  const data: number[] = [];
  for (const line of lines) {
    const byteCount = parseInt(line.substring(1, 3), 16);
    const recordType = parseInt(line.substring(7, 9), 16);
    if (recordType === 0x00) {
      for (let i = 0; i < byteCount; i++) {
        data.push(parseInt(line.substring(9 + i * 2, 11 + i * 2), 16));
      }
    }
  }
  return new Uint8Array(data);
};

// Robust read function that collects data with timeout
const readWithTimeout = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  onDebug?: DebugLogCallback
): Promise<Uint8Array> => {
  const buffer: number[] = [];
  const startTime = Date.now();
  
  // Create an AbortController for the timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  
  try {
    while (Date.now() - startTime < timeoutMs) {
      const remainingTime = timeoutMs - (Date.now() - startTime);
      if (remainingTime <= 0) break;
      
      // Try to read with a race against timeout
      const readResult = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) => 
          setTimeout(() => resolve({ value: undefined, done: true }), Math.min(remainingTime, 100))
        )
      ]);
      
      if (readResult.value && readResult.value.length > 0) {
        buffer.push(...readResult.value);
        const hex = Array.from(readResult.value).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.log('[WebSerial] RX:', hex);
        if (onDebug) onDebug(`[RX] ${hex}`);
        
        // Check for complete response (INSYNC + OK)
        if (buffer.includes(STK_INSYNC) && buffer.includes(STK_OK)) {
          break;
        }
      }
      
      if (readResult.done) break;
    }
  } catch (e) {
    // Ignore timeout/abort errors
  } finally {
    clearTimeout(timeoutId);
  }
  
  return new Uint8Array(buffer);
};

// Reset board using DTR toggle (based on avrdude implementation)
const resetBoardDTR = async (
  port: SerialPort, 
  onDebug?: DebugLogCallback
): Promise<void> => {
  const log = (msg: string) => {
    console.log(`[WebSerial] ${msg}`);
    if (onDebug) onDebug(msg);
  };
  
  log('Ejecutando secuencia de reset DTR...');
  
  // Based on avrdude's stk500_getsync reset sequence
  // First, ensure both signals are low (discharged)
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(r => setTimeout(r, 50));
  
  // Pull DTR high to reset the microcontroller
  await port.setSignals({ dataTerminalReady: true, requestToSend: false });
  await new Promise(r => setTimeout(r, 50));
  
  // Release DTR - this triggers the reset via the capacitor
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  
  // Wait for bootloader to start (critical timing!)
  // The bootloader needs about 100-300ms to initialize
  log('Esperando inicialización del bootloader (300ms)...');
  await new Promise(r => setTimeout(r, 300));
};

// Alternative reset using RTS (for some CH340 clones)
const resetBoardRTS = async (
  port: SerialPort,
  onDebug?: DebugLogCallback
): Promise<void> => {
  const log = (msg: string) => {
    console.log(`[WebSerial] ${msg}`);
    if (onDebug) onDebug(msg);
  };
  
  log('Ejecutando secuencia de reset RTS...');
  
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(r => setTimeout(r, 50));
  
  await port.setSignals({ dataTerminalReady: false, requestToSend: true });
  await new Promise(r => setTimeout(r, 50));
  
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  
  log('Esperando inicialización del bootloader (300ms)...');
  await new Promise(r => setTimeout(r, 300));
};

// Combined DTR+RTS reset (most common for Arduino clones)
const resetBoardCombined = async (
  port: SerialPort,
  onDebug?: DebugLogCallback
): Promise<void> => {
  const log = (msg: string) => {
    console.log(`[WebSerial] ${msg}`);
    if (onDebug) onDebug(msg);
  };
  
  log('Ejecutando secuencia de reset DTR+RTS...');
  
  // Sequence based on Arduino IDE reset
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(r => setTimeout(r, 100));
  
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await new Promise(r => setTimeout(r, 100));
  
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  
  log('Esperando inicialización del bootloader (300ms)...');
  await new Promise(r => setTimeout(r, 300));
};

type ResetMethod = 'dtr' | 'rts' | 'combined';

const attemptSync = async (
  port: SerialPort,
  baudRate: number,
  resetMethod: ResetMethod,
  onProgress: UploadProgressCallback,
  onDebug?: DebugLogCallback
): Promise<{ success: boolean; reader: ReadableStreamDefaultReader<Uint8Array> | null; writer: WritableStreamDefaultWriter<Uint8Array> | null }> => {
  const log = (msg: string) => {
    console.log(`[WebSerial] ${msg}`);
    if (onDebug) onDebug(msg);
  };

  log(`━━━ Probando ${baudRate} baud, reset: ${resetMethod} ━━━`);
  
  try {
    await port.open({ baudRate });
  } catch (e) {
    log(`Error abriendo puerto: ${e}`);
    return { success: false, reader: null, writer: null };
  }

  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();

  if (!writer || !reader) {
    try { await port.close(); } catch {}
    return { success: false, reader: null, writer: null };
  }

  onProgress({ stage: 'connecting', progress: 5, message: `Probando ${baudRate} baud...` });

  // Apply reset
  switch (resetMethod) {
    case 'dtr':
      await resetBoardDTR(port, onDebug);
      break;
    case 'rts':
      await resetBoardRTS(port, onDebug);
      break;
    case 'combined':
      await resetBoardCombined(port, onDebug);
      break;
  }

  // Drain any bootloader startup message
  log('Limpiando buffer inicial...');
  const drain = await readWithTimeout(reader, 200, onDebug);
  if (drain.length > 0) {
    log(`Datos iniciales: ${drain.length} bytes`);
  }

  onProgress({ stage: 'syncing', progress: 10, message: 'Sincronizando con bootloader...' });

  // Try to sync with bootloader
  let synced = false;
  const maxAttempts = 8;
  
  for (let attempt = 0; attempt < maxAttempts && !synced; attempt++) {
    try {
      log(`Sync intento ${attempt + 1}/${maxAttempts}`);
      
      // Send sync command: STK_GET_SYNC + CRC_EOP
      const syncCmd = new Uint8Array([STK_GET_SYNC, CRC_EOP]);
      log(`[TX] 0x${STK_GET_SYNC.toString(16)} 0x${CRC_EOP.toString(16)}`);
      await writer.write(syncCmd);
      
      // Wait for response with longer timeout
      const response = await readWithTimeout(reader, 500, onDebug);
      
      if (response.length === 0) {
        log(`Intento ${attempt + 1}: Sin respuesta`);
      } else {
        const hex = Array.from(response).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        log(`Intento ${attempt + 1}: Respuesta = ${hex}`);
        
        // Check for INSYNC (0x14) and OK (0x10)
        if (response.includes(STK_INSYNC) && response.includes(STK_OK)) {
          log('✓ ¡Sincronización exitosa!');
          synced = true;
          break;
        }
      }
      
      // Wait between attempts
      await new Promise(r => setTimeout(r, 100));
      
      // Re-apply reset after half the attempts
      if (attempt === 3) {
        log('Re-aplicando reset...');
        switch (resetMethod) {
          case 'dtr': await resetBoardDTR(port, onDebug); break;
          case 'rts': await resetBoardRTS(port, onDebug); break;
          case 'combined': await resetBoardCombined(port, onDebug); break;
        }
      }
    } catch (e) {
      log(`Error en intento ${attempt + 1}: ${e}`);
    }
  }

  if (synced) {
    return { success: true, reader, writer };
  }

  // Cleanup on failure
  try { await reader.cancel(); reader.releaseLock(); } catch {}
  try { await writer.close(); writer.releaseLock(); } catch {}
  try { await port.close(); } catch {}
  
  return { success: false, reader: null, writer: null };
};

export const uploadToArduino = async (
  port: SerialPort,
  hexData: Uint8Array,
  board: ArduinoBoard,
  onProgress: UploadProgressCallback,
  onDebug?: DebugLogCallback
): Promise<void> => {
  const log = (msg: string) => {
    console.log(`[WebSerial] ${msg}`);
    if (onDebug) onDebug(msg);
  };

  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`Iniciando upload para ${board.name}`);
  log(`Tamaño firmware: ${hexData.length} bytes`);
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let activeWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  // Determine baud rates based on board
  const isOldBootloader = board.fqbn.includes('atmega328old');
  const baudRates = isOldBootloader ? [57600] : board.name.includes('Nano') ? [115200, 57600] : [board.baudRate];
  
  log(`Baudios a probar: ${baudRates.join(', ')}`);

  // Reset methods to try
  const resetMethods: ResetMethod[] = ['combined', 'dtr', 'rts'];

  let connected = false;
  
  outerLoop:
  for (const baud of baudRates) {
    for (const method of resetMethods) {
      const result = await attemptSync(port, baud, method, onProgress, onDebug);
      
      if (result.success && result.reader && result.writer) {
        activeReader = result.reader;
        activeWriter = result.writer;
        connected = true;
        log(`✓ Conectado: ${baud} baud, reset ${method}`);
        break outerLoop;
      }
      
      // Wait before next attempt
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!connected || !activeReader || !activeWriter) {
    log('✗ No se pudo conectar con el bootloader');
    log('');
    log('SOLUCIÓN: Usa el modo RESET MANUAL:');
    log('1. Mantén presionado el botón RESET en tu Arduino');
    log('2. Haz clic en "Upload" de nuevo');
    log('3. Suelta el botón RESET cuando veas "Sincronizando..."');
    throw new Error(
      'No se pudo conectar con el bootloader.\n\n' +
      'Prueba el RESET MANUAL:\n' +
      '1. Mantén presionado el botón RESET\n' +
      '2. Haz clic en Upload\n' +
      '3. Suelta RESET cuando veas "Sincronizando..."'
    );
  }

  try {
    // Enter programming mode
    log('Entrando en modo programación...');
    await activeWriter.write(new Uint8Array([STK_ENTER_PROGMODE, CRC_EOP]));
    const progModeResp = await readWithTimeout(activeReader, 500, onDebug);
    
    if (!progModeResp.includes(STK_INSYNC)) {
      log('Advertencia: No se confirmó modo programación');
    }

    onProgress({ stage: 'uploading', progress: 20, message: '¡Conectado! Subiendo firmware...' });

    // Upload pages
    const pageSize = 128;
    const totalPages = Math.ceil(hexData.length / pageSize);
    log(`Total páginas a escribir: ${totalPages}`);

    for (let page = 0; page < totalPages; page++) {
      const addr = page * pageSize;
      const pageData = hexData.slice(addr, addr + pageSize);
      
      // Pad page to full size with 0xFF
      const paddedData = new Uint8Array(pageSize);
      paddedData.fill(0xFF);
      paddedData.set(pageData);

      // Set address (word address = byte address / 2)
      const wordAddr = addr >> 1;
      const addrCmd = new Uint8Array([
        STK_LOAD_ADDRESS,
        wordAddr & 0xFF,
        (wordAddr >> 8) & 0xFF,
        CRC_EOP,
      ]);
      
      await activeWriter.write(addrCmd);
      const addrResp = await readWithTimeout(activeReader, 200);
      
      if (!addrResp.includes(STK_INSYNC)) {
        log(`Advertencia: Dirección página ${page} sin confirmar`);
      }

      // Program page
      const progCmd = new Uint8Array([
        STK_PROG_PAGE,
        (paddedData.length >> 8) & 0xFF,
        paddedData.length & 0xFF,
        0x46, // 'F' for flash
      ]);
      
      const fullPacket = new Uint8Array(progCmd.length + paddedData.length + 1);
      fullPacket.set(progCmd, 0);
      fullPacket.set(paddedData, progCmd.length);
      fullPacket[fullPacket.length - 1] = CRC_EOP;

      await activeWriter.write(fullPacket);
      const progResp = await readWithTimeout(activeReader, 1000);
      
      if (!progResp.includes(STK_INSYNC)) {
        log(`Advertencia: Página ${page} sin confirmar`);
      }

      const progress = 20 + ((page + 1) / totalPages) * 70;
      onProgress({
        stage: 'uploading',
        progress,
        message: `Subiendo... ${Math.round(((page + 1) / totalPages) * 100)}%`,
      });
    }

    // Leave programming mode
    onProgress({ stage: 'verifying', progress: 95, message: 'Finalizando...' });
    await activeWriter.write(new Uint8Array([STK_LEAVE_PROGMODE, CRC_EOP]));
    await readWithTimeout(activeReader, 200);

    onProgress({ stage: 'done', progress: 100, message: '¡Carga exitosa!' });
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('✓ UPLOAD COMPLETADO EXITOSAMENTE');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } finally {
    // Cleanup
    if (activeReader) {
      try { await activeReader.cancel(); activeReader.releaseLock(); } catch {}
    }
    if (activeWriter) {
      try { await activeWriter.close(); activeWriter.releaseLock(); } catch {}
    }
    try { await port.close(); } catch {}
  }
};