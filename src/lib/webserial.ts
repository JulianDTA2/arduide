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

// Polling-based read with timeout - prevents reader from blocking indefinitely
const collectData = async (
  port: SerialPort,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  expectedBytes: number = 2
): Promise<Uint8Array> => {
  const buffer: number[] = [];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      // Release and re-acquire reader for each poll cycle
      reader.releaseLock();
      const newReader = port.readable?.getReader();
      if (!newReader) break;
      reader = newReader;

      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ value: undefined; done: true }>((resolve) =>
        setTimeout(() => resolve({ value: undefined, done: true }), 20)
      );

      const result = await Promise.race([readPromise, timeoutPromise]);

      if (result.value) {
        buffer.push(...result.value);
        console.log('[WebSerial] Received:', Array.from(result.value).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        // Check for INSYNC + OK
        if (buffer.includes(STK_INSYNC) && buffer.includes(STK_OK)) {
          break;
        }
        if (buffer.length >= expectedBytes) break;
      }
    } catch (e) {
      // Ignore read errors during polling
    }
    await new Promise((r) => setTimeout(r, 5));
  }

  return new Uint8Array(buffer);
};

// Simple read with manual timeout
const simpleRead = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
): Promise<Uint8Array> => {
  const buffer: number[] = [];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const timeRemaining = deadline - Date.now();
      if (timeRemaining <= 0) break;

      const readPromise = reader.read();
      const timeoutId = setTimeout(() => {}, Math.min(timeRemaining, 50));
      
      const result = await Promise.race([
        readPromise,
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 50)
        ),
      ]);
      
      clearTimeout(timeoutId);

      if (result.value) {
        buffer.push(...result.value);
        if (buffer.includes(STK_INSYNC) && buffer.includes(STK_OK)) {
          break;
        }
      }
      if (result.done) break;
    } catch {
      break;
    }
  }

  return new Uint8Array(buffer);
};

const resetBoard = async (port: SerialPort, variant: 'standard' | 'ch340' | 'ftdi'): Promise<void> => {
  console.log(`[WebSerial] Reset board using ${variant} sequence`);
  
  switch (variant) {
    case 'ch340':
      // CH340 clones need a specific sequence
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise((r) => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });
      await new Promise((r) => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise((r) => setTimeout(r, 100));
      break;
      
    case 'ftdi':
      // FTDI chips
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise((r) => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: true, requestToSend: false });
      await new Promise((r) => setTimeout(r, 250));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise((r) => setTimeout(r, 50));
      break;
      
    case 'standard':
    default:
      // Standard Arduino with native USB
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise((r) => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });
      await new Promise((r) => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((r) => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise((r) => setTimeout(r, 50));
      break;
  }
};

const attemptSyncWithBaud = async (
  port: SerialPort,
  baudRate: number,
  resetVariant: 'standard' | 'ch340' | 'ftdi',
  onProgress: UploadProgressCallback
): Promise<{ success: boolean; reader: any; writer: any }> => {
  console.log(`[WebSerial] Attempting sync at ${baudRate} baud with ${resetVariant} reset`);
  
  try {
    await port.open({ baudRate });
  } catch (e) {
    console.log('[WebSerial] Failed to open port:', e);
    return { success: false, reader: null, writer: null };
  }

  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();

  if (!writer || !reader) {
    try { await port.close(); } catch {}
    return { success: false, reader: null, writer: null };
  }

  onProgress({ stage: 'connecting', progress: 5, message: `Conectando a ${baudRate} baudios...` });

  // Reset the board
  await resetBoard(port, resetVariant);

  // Drain any pending data
  console.log('[WebSerial] Draining buffer...');
  const drainData = await simpleRead(reader, 100);
  if (drainData.length > 0) {
    console.log('[WebSerial] Drained:', Array.from(drainData).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  }

  onProgress({ stage: 'syncing', progress: 10, message: 'Sincronizando con bootloader...' });

  // Try to sync with bootloader - multiple attempts
  let synced = false;
  const maxAttempts = 15;
  
  for (let attempt = 0; attempt < maxAttempts && !synced; attempt++) {
    try {
      console.log(`[WebSerial] Sync attempt ${attempt + 1}/${maxAttempts}`);
      
      // Send sync command
      await writer.write(new Uint8Array([STK_GET_SYNC, CRC_EOP]));
      
      // Wait for response
      const response = await simpleRead(reader, 100);
      
      if (response.length > 0) {
        console.log('[WebSerial] Response:', Array.from(response).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      }
      
      if (response.includes(STK_INSYNC) && response.includes(STK_OK)) {
        console.log('[WebSerial] Sync successful!');
        synced = true;
        break;
      }
      
      // Small delay between attempts
      await new Promise((r) => setTimeout(r, 30));
      
      // Try another reset mid-way through attempts
      if (attempt === 5 || attempt === 10) {
        console.log('[WebSerial] Mid-sync reset');
        await resetBoard(port, resetVariant);
        await new Promise((r) => setTimeout(r, 50));
      }
    } catch (e) {
      console.log('[WebSerial] Sync attempt error:', e);
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
  onProgress: UploadProgressCallback
): Promise<void> => {
  console.log('[WebSerial] Starting upload for', board.name);
  console.log('[WebSerial] Firmware size:', hexData.length, 'bytes');

  let activeReader: any = null;
  let activeWriter: any = null;

  // Determine baud rates to try based on board
  const baudRates = board.fqbn.includes('atmega328old') 
    ? [57600] // Old bootloader always uses 57600
    : board.name.includes('Nano') 
      ? [115200, 57600] // New Nano uses 115200, but try 57600 as fallback
      : [board.baudRate];

  // Reset variants to try
  const resetVariants: Array<'standard' | 'ch340' | 'ftdi'> = ['ch340', 'standard', 'ftdi'];

  // Try all combinations
  let connected = false;
  
  outerLoop:
  for (const baud of baudRates) {
    for (const variant of resetVariants) {
      onProgress({ stage: 'connecting', progress: 0, message: `Intentando ${baud} baudios (${variant})...` });
      
      const result = await attemptSyncWithBaud(port, baud, variant, onProgress);
      
      if (result.success) {
        activeReader = result.reader;
        activeWriter = result.writer;
        connected = true;
        console.log(`[WebSerial] Connected with ${baud} baud, ${variant} reset`);
        break outerLoop;
      }
      
      // Wait before next attempt
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (!connected || !activeReader || !activeWriter) {
    throw new Error(
      'No se pudo sincronizar con el bootloader. Sugerencias:\n' +
      '1. Desconecta y vuelve a conectar el cable USB\n' +
      '2. Presiona el botón RESET en la placa justo antes de subir\n' +
      '3. Intenta seleccionar "Arduino Nano (Old Bootloader)" si es un clon'
    );
  }

  try {
    onProgress({ stage: 'uploading', progress: 20, message: '¡Conectado! Subiendo firmware...' });

    // Upload pages
    const pageSize = 128;
    const totalPages = Math.ceil(hexData.length / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const addr = page * pageSize;
      const pageData = hexData.slice(addr, addr + pageSize);
      
      // Pad page to full size
      const paddedData = new Uint8Array(pageSize);
      paddedData.set(pageData);
      if (pageData.length < pageSize) {
        paddedData.fill(0xFF, pageData.length);
      }

      // Set address (word address = byte address / 2)
      const wordAddr = addr >> 1;
      const addrCmd = new Uint8Array([
        STK_LOAD_ADDRESS,
        wordAddr & 0xFF,
        (wordAddr >> 8) & 0xFF,
        CRC_EOP,
      ]);
      
      await activeWriter.write(addrCmd);
      const addrResp = await simpleRead(activeReader, 150);
      
      if (!addrResp.includes(STK_INSYNC)) {
        console.warn('[WebSerial] Address command did not get INSYNC');
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
      const progResp = await simpleRead(activeReader, 500);
      
      if (!progResp.includes(STK_INSYNC)) {
        console.warn(`[WebSerial] Page ${page} did not get INSYNC`);
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
    await simpleRead(activeReader, 100);

    onProgress({ stage: 'done', progress: 100, message: '¡Carga exitosa!' });
    console.log('[WebSerial] Upload complete!');

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