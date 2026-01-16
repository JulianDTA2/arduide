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
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', uploadProtocol: 'stk500v1', baudRate: 115200 }, // Auto-detect probará 115200 y 57600
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

// Lectura optimizada para capturar respuestas fragmentadas
const readAny = async (reader: ReadableStreamDefaultReader<Uint8Array>, timeout: number): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const read = reader.read();
    const timer = new Promise<{value: undefined, done: true}>(r => setTimeout(() => r({value: undefined, done: true}), 10)); // Check rápido
    const { value, done } = await Promise.race([read, timer]);
    if (value) chunks.push(value);
    if (done) break;
    // Si ya tenemos al menos 2 bytes (mínimo para OK+INSYNC), salimos
    if (chunks.reduce((a,c) => a+c.length, 0) >= 2) break;
  }
  const total = chunks.reduce((a,c) => a+c.length, 0);
  const res = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { res.set(c, off); off += c.length; }
  return res;
};

const attemptSync = async (port: SerialPort, baudRate: number, onProgress: UploadProgressCallback): Promise<{s: boolean, r: any, w: any}> => {
  try { await port.open({ baudRate }); } catch (e) { return {s: false, r: null, w: null}; }
  
  const w = port.writable?.getWriter();
  const r = port.readable?.getReader();
  if (!w || !r) { await port.close(); return {s: false, r: null, w: null}; }

  onProgress({ stage: 'connecting', progress: 0, message: `Probando a ${baudRate} baudios...` });

  // === SECUENCIA DE RESET CH340 OPTIMIZADA ===
  // 1. Estado inicial seguro
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(resolve => setTimeout(resolve, 50));

  // 2. RESET ACTIVO: Solo DTR True. RTS False (para evitar conflictos en clones raros)
  await port.setSignals({ dataTerminalReady: true, requestToSend: false });
  await new Promise(resolve => setTimeout(resolve, 250)); // Pulso sólido

  // 3. SOLTAR RESET
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise(resolve => setTimeout(resolve, 50)); // Pequeña pausa para que el bootloader despierte

  // === BOMBARDEO (SYNC LOOP) ===
  const start = Date.now();
  let synced = false;
  
  // Intentamos sincronizar durante 1.5 segundos
  while (Date.now() - start < 1500) {
    try {
      await w.write(new Uint8Array([STK_GET_SYNC, CRC_EOP]));
      // Leemos rápido (50ms)
      const res = await readAny(r, 50);
      if (res.includes(STK_INSYNC) && res.includes(STK_OK)) {
        synced = true;
        break;
      }
    } catch (e) { break; }
    // Espera mínima entre intentos para no saturar
    await new Promise(r => setTimeout(r, 10));
  }

  if (synced) return { s: true, r, w };
  
  // Limpieza
  try { await r.cancel(); r.releaseLock(); } catch {}
  try { await w.close(); w.releaseLock(); } catch {}
  try { await port.close(); } catch {}
  return { s: false, r: null, w: null };
};

export const uploadToArduino = async (port: SerialPort, hexData: Uint8Array, board: ArduinoBoard, onProgress: UploadProgressCallback): Promise<void> => {
  let activeR, activeW;
  
  // Probar ambas velocidades si es Nano
  const bauds = board.name.includes("Nano") ? [115200, 57600] : [board.baudRate];
  
  for (const baud of bauds) {
    const res = await attemptSync(port, baud, onProgress);
    if (res.s) {
      activeR = res.r;
      activeW = res.w;
      break;
    }
    // Pausa para dar tiempo al driver USB a recuperarse antes de reabrir
    await new Promise(r => setTimeout(r, 200));
  }

  if (!activeR || !activeW) {
    throw new Error('No se pudo sincronizar. Intenta presionar el botón RESET manualmente justo cuando veas "Probando...".');
  }

  try {
    onProgress({ stage: 'syncing', progress: 20, message: '¡Conectado! Subiendo...' });

    // === CARGA ===
    const pageSize = 128;
    const totalPages = Math.ceil(hexData.length / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const addr = page * pageSize;
      const data = hexData.slice(addr, addr + pageSize);
      const padded = new Uint8Array(pageSize);
      padded.set(data);
      if (data.length < pageSize) padded.fill(0xFF, data.length);

      const wordAddr = addr >> 1;
      await activeW.write(new Uint8Array([STK_LOAD_ADDRESS, wordAddr & 0xFF, (wordAddr >> 8) & 0xFF, CRC_EOP]));
      await readAny(activeR, 100);

      const header = new Uint8Array([STK_PROG_PAGE, (padded.length >> 8) & 0xFF, padded.length & 0xFF, 0x46]);
      const pkt = new Uint8Array(header.length + padded.length + 1);
      pkt.set(header, 0); pkt.set(padded, header.length); pkt[pkt.length-1] = CRC_EOP;
      
      await activeW.write(pkt);
      await readAny(activeR, 500);
      
      onProgress({ stage: 'uploading', progress: 20 + ((page+1)/totalPages)*70, message: `Subiendo ${Math.round(((page+1)/totalPages)*100)}%` });
    }

    onProgress({ stage: 'verifying', progress: 95, message: 'Finalizando...' });
    await activeW.write(new Uint8Array([STK_LEAVE_PROGMODE, CRC_EOP]));
    await readAny(activeR, 100);
    onProgress({ stage: 'done', progress: 100, message: '¡Carga Exitosa!' });

  } finally {
    if (activeR) { try { await activeR.cancel(); activeR.releaseLock(); } catch {} }
    if (activeW) { try { await activeW.close(); activeW.releaseLock(); } catch {} }
    try { await port.close(); } catch {}
  }
};