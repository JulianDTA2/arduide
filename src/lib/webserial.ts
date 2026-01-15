// src/lib/webserial.ts

// --- DEFINICIONES DE TIPOS ---
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

export const ARDUINO_BOARDS: ArduinoBoard[] = [
  { 
    name: 'Arduino Uno', 
    fqbn: 'arduino:avr:uno',
    uploadProtocol: 'stk500v1',
    baudRate: 115200 
  },
  { 
    name: 'Arduino Nano (Auto-Detect)', 
    fqbn: 'arduino:avr:nano',
    uploadProtocol: 'stk500v1',
    baudRate: 115200 // Se probará 115200 y luego 57600 automáticamente
  },
  { 
    name: 'Arduino Mega 2560', 
    fqbn: 'arduino:avr:mega',
    uploadProtocol: 'stk500v2',
    baudRate: 115200 
  }
];

export const isWebSerialSupported = (): boolean => {
  return 'serial' in navigator;
};

export const requestSerialPort = async (): Promise<SerialPort | null> => {
  if (!isWebSerialSupported()) throw new Error('WebSerial not supported');
  try {
    return await navigator.serial.requestPort();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
};

export const openSerialConnection = async (port: SerialPort, baudRate: number = 9600): Promise<SerialConnection> => {
  await port.open({ baudRate });
  return {
    port,
    reader: port.readable?.getReader() ?? null,
    writer: port.writable?.getWriter() ?? null,
    isConnected: true
  };
};

export const closeSerialConnection = async (connection: SerialConnection): Promise<void> => {
  if (connection.reader) {
    try { await connection.reader.cancel(); connection.reader.releaseLock(); } catch (e) { console.warn(e); }
  }
  if (connection.writer) {
    try { await connection.writer.close(); connection.writer.releaseLock(); } catch (e) { console.warn(e); }
  }
  try { await connection.port.close(); } catch (e) { console.warn(e); }
};

export const writeToSerial = async (connection: SerialConnection, data: string): Promise<void> => {
  if (!connection.writer) throw new Error('No writer');
  await connection.writer.write(new TextEncoder().encode(data));
};

// --- PROTOCOLO STK500 ---
const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const STK_GET_SYNC = 0x30;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;
const STK_LEAVE_PROGMODE = 0x51;
const CRC_EOP = 0x20;

export interface UploadProgress {
  stage: 'connecting' | 'syncing' | 'uploading' | 'verifying' | 'done' | 'error';
  progress: number;
  message: string;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

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

// Helper: Lee bytes del puerto pero devuelve lo que tenga sin esperar el timeout completo si ya hay datos
const readAny = async (reader: ReadableStreamDefaultReader<Uint8Array>, timeout: number): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const readPromise = reader.read();
    const timerPromise = new Promise<{value: undefined, done: true}>(r => setTimeout(() => r({value: undefined, done: true}), 10));
    const { value, done } = await Promise.race([readPromise, timerPromise]);
    
    if (value) chunks.push(value);
    if (done) break;
    // Si ya tenemos al menos 2 bytes (mínimo para una respuesta válida OK), salimos rápido
    const len = chunks.reduce((a,c) => a+c.length, 0);
    if (len >= 2) break; 
  }
  
  const total = chunks.reduce((a,c) => a+c.length, 0);
  const res = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { res.set(c, off); off += c.length; }
  return res;
};

// Intenta sincronizar a una velocidad específica con la estrategia "Pulse & Spam"
const attemptSync = async (
  port: SerialPort, 
  baudRate: number, 
  onProgress: UploadProgressCallback
): Promise<{ success: boolean; reader: any; writer: any }> => {
  
  console.log(`[Sync] Probando a ${baudRate} baudios...`);
  try {
    await port.open({ baudRate });
  } catch(e) {
    console.warn("Puerto ocupado o error al abrir", e);
    return { success: false, reader: null, writer: null };
  }
  
  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  
  if (!writer || !reader) {
    await port.close();
    return { success: false, reader: null, writer: null };
  }

  onProgress({ stage: 'connecting', progress: 5, message: `Probando conexión (${baudRate})...` });

  // === ESTRATEGIA DE RESET (PULSE) ===
  // 1. Asegurar estado inactivo (DTR False = High/Idle en TTL)
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(r => setTimeout(r, 100));

  // 2. RESET ACTIVO (DTR True = Low/Reset en TTL)
  // Mantenemos el reset pulsado 100ms
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await new Promise(r => setTimeout(r, 100));

  // 3. SOLTAR RESET Y BOMBARDEAR (Spamming)
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  // IMPORTANTE: No esperar aquí. Empezar a hablar inmediatamente mientras el bootloader despierta.

  let synced = false;
  const ATTEMPT_DURATION = 1500; // Intentar sincronizar durante 1.5 segundos
  const startTime = Date.now();

  while (Date.now() - startTime < ATTEMPT_DURATION) {
    try {
      // Enviar comando GET_SYNC (0x30) + EOP (0x20)
      await writer.write(new Uint8Array([STK_GET_SYNC, CRC_EOP]));
      
      // Leer respuesta rápida (max 50ms)
      const response = await readAny(reader, 50);
      
      // Verificar si recibimos INSYNC (0x14) y OK (0x10)
      if (response.includes(STK_INSYNC) && response.includes(STK_OK)) {
        synced = true;
        break;
      }
      // Pequeña pausa para no saturar
      await new Promise(r => setTimeout(r, 10));
    } catch (e) {
      console.log("Error enviando ping", e);
      break;
    }
  }

  if (synced) {
    return { success: true, reader, writer };
  } else {
    // Cerrar limpiamente para el siguiente intento
    try { await reader.cancel(); reader.releaseLock(); } catch {}
    try { await writer.close(); writer.releaseLock(); } catch {}
    try { await port.close(); } catch {}
    return { success: false, reader: null, writer: null };
  }
};

export const uploadToArduino = async (
  port: SerialPort,
  hexData: Uint8Array,
  board: ArduinoBoard,
  onProgress: UploadProgressCallback
): Promise<void> => {
  
  let activeReader, activeWriter;
  let usedBaud = board.baudRate;

  try {
    // Determinar qué velocidades probar
    let baudsToTry = [board.baudRate];
    
    // Si es Nano, siempre probar ambas velocidades
    if (board.name.includes("Nano")) {
      // Priorizar la velocidad estándar moderna, luego la vieja
      baudsToTry = [115200, 57600];
    }

    let connectionResult;
    for (const baud of baudsToTry) {
      connectionResult = await attemptSync(port, baud, onProgress);
      if (connectionResult.success) {
        usedBaud = baud;
        activeReader = connectionResult.reader;
        activeWriter = connectionResult.writer;
        break;
      }
      // Pequeña espera antes de reabrir el puerto
      await new Promise(r => setTimeout(r, 200));
    }

    if (!activeReader || !activeWriter) {
      throw new Error('No se pudo sincronizar. Si usas un clon CH340, intenta presionar RESET justo cuando aparezca "Probando conexión".');
    }

    onProgress({ stage: 'syncing', progress: 15, message: `¡Conectado a ${usedBaud} baudios!` });
    
    // === FASE DE CARGA ===
    onProgress({ stage: 'uploading', progress: 20, message: 'Subiendo firmware...' });

    const pageSize = board.name.includes('Mega') ? 256 : 128;
    const totalPages = Math.ceil(hexData.length / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const address = page * pageSize;
      const pageData = hexData.slice(address, address + pageSize);
      const paddedPage = new Uint8Array(pageSize);
      paddedPage.set(pageData);
      if (pageData.length < pageSize) paddedPage.fill(0xFF, pageData.length);
      
      const wordAddress = address >> 1;
      // Comando LOAD_ADDRESS
      await activeWriter.write(new Uint8Array([STK_LOAD_ADDRESS, wordAddress & 0xFF, (wordAddress >> 8) & 0xFF, CRC_EOP]));
      await readAny(activeReader, 200);
      
      // Comando PROG_PAGE
      const header = new Uint8Array([STK_PROG_PAGE, (paddedPage.length >> 8) & 0xFF, paddedPage.length & 0xFF, 0x46]);
      const fullPacket = new Uint8Array(header.length + paddedPage.length + 1);
      fullPacket.set(header, 0);
      fullPacket.set(paddedPage, header.length);
      fullPacket[fullPacket.length - 1] = CRC_EOP;
      
      await activeWriter.write(fullPacket);
      await readAny(activeReader, 1000);
      
      const percent = 20 + ((page + 1) / totalPages) * 70;
      onProgress({ stage: 'uploading', progress: percent, message: `Subiendo bloque ${page + 1}/${totalPages}...` });
    }

    onProgress({ stage: 'verifying', progress: 95, message: 'Finalizando...' });
    await activeWriter.write(new Uint8Array([STK_LEAVE_PROGMODE, CRC_EOP]));
    await readAny(activeReader, 200);
    
    onProgress({ stage: 'done', progress: 100, message: '¡Carga completa!' });

  } finally {
    if (activeReader) { try { await activeReader.cancel(); activeReader.releaseLock(); } catch {} }
    if (activeWriter) { try { await activeWriter.close(); activeWriter.releaseLock(); } catch {} }
    try { await port.close(); } catch {}
  }
};