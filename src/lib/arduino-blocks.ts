import * as Blockly from 'blockly';

// =========================================================
// 1. CONSTANTES Y UTILIDADES
// =========================================================
// Definimos pines para los menús desplegables (si se usan)
const DIGITAL_PINS_DROPDOWN: any = Array.from({length: 14}, (_, i) => [i.toString(), i.toString()]);
const ANALOG_PINS_DROPDOWN: any = Array.from({length: 6}, (_, i) => [`A${i}`, `A${i}`]);

// =========================================================
// 2. DEFINICIÓN VISUAL DE BLOQUES (Blockly.Blocks)
// =========================================================
export const defineArduinoBlocks = () => {
  
  // --- ESTRUCTURA ---
  Blockly.Blocks['arduino_setup_loop'] = {
    init: function() {
      this.appendDummyInput().appendField('Arduino Program');
      this.appendStatementInput('SETUP').setCheck(null).appendField('setup()');
      this.appendStatementInput('LOOP').setCheck(null).appendField('loop()');
      this.setColour(180);
      this.setTooltip('Estructura principal con setup y loop');
    }
  };

  Blockly.Blocks['arduino_start'] = {
    init: function() {
      this.appendDummyInput().appendField("INICIO PROGRAMA");
      this.appendStatementInput("DO").setCheck(null).appendField("Hacer");
      this.setPreviousStatement(true, null); 
      this.setNextStatement(true, null);     
      this.setColour(120);                   
    }
  };

  // --- ENTRADA/SALIDA DIGITAL ---
  Blockly.Blocks['arduino_pin_mode'] = {
    init: function() {
      this.appendValueInput('PIN').setCheck('Number').appendField('pinMode pin');
      this.appendDummyInput().appendField('modo').appendField(new Blockly.FieldDropdown([['INPUT', 'INPUT'], ['OUTPUT', 'OUTPUT'], ['INPUT_PULLUP', 'INPUT_PULLUP']]), 'MODE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    }
  };

  Blockly.Blocks['arduino_digital_write'] = {
    init: function() {
      this.appendValueInput('PIN')
          .setCheck('Number')
          .appendField("Escribir Digital PIN");
      this.appendDummyInput()
          .appendField("Valor")
          .appendField(new Blockly.FieldDropdown([["ALTO","HIGH"], ["BAJO","LOW"]]), "VALUE"); 
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(65);
    }
  };

  Blockly.Blocks['arduino_digital_read'] = {
    init: function() {
      this.appendValueInput('PIN')
          .setCheck('Number')
          .appendField("Leer Digital PIN");
      this.setOutput(true, "Number");
      this.setColour(65);
    }
  };

  // --- ENTRADA/SALIDA ANALÓGICA ---
  Blockly.Blocks['arduino_analog_write'] = {
    init: function() {
      this.appendValueInput('PIN')
          .setCheck('Number')
          .appendField("Escribir PWM PIN");
      this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendField('Valor (0-255)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(65);
    }
  };

  Blockly.Blocks['arduino_analog_read'] = {
    init: function() {
      this.appendValueInput('PIN')
          .setCheck('Number') // Permitir variables o dropdowns numéricos
          .appendField("Leer Analógico PIN");
      this.setOutput(true, "Number");
      this.setColour(65);
    }
  };

  // --- TIEMPO ---
  Blockly.Blocks['arduino_delay'] = {
    init: function() {
      this.appendValueInput("TIME").setCheck("Number").appendField("Esperar (ms)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
    }
  };

  Blockly.Blocks['arduino_delay_microseconds'] = {
    init: function() {
      this.appendValueInput("TIME").setCheck("Number").appendField("Esperar (us)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
    }
  };

  Blockly.Blocks['arduino_millis'] = {
    init: function() {
      this.appendDummyInput().appendField('millis()');
      this.setOutput(true, 'Number');
      this.setColour(60);
    }
  };

  Blockly.Blocks['arduino_micros'] = {
    init: function() {
      this.appendDummyInput().appendField('micros()');
      this.setOutput(true, 'Number');
      this.setColour(60);
    }
  };

  // --- SERIAL ---
  Blockly.Blocks['arduino_serial_begin'] = {
    init: function() {
      this.appendDummyInput().appendField('Serial.begin').appendField(new Blockly.FieldDropdown([['9600', '9600'], ['115200', '115200']]), 'BAUD');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
    }
  };

  Blockly.Blocks['arduino_serial_print'] = {
    init: function() {
      this.appendValueInput('VALUE').setCheck(null).appendField('Serial.print');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
    }
  };

  Blockly.Blocks['arduino_serial_println'] = {
    init: function() {
      this.appendValueInput('VALUE').setCheck(null).appendField('Serial.println');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
    }
  };

  Blockly.Blocks['arduino_serial_available'] = {
    init: function() {
      this.appendDummyInput().appendField('Serial.available()');
      this.setOutput(true, 'Number');
      this.setColour(200);
    }
  };

  Blockly.Blocks['arduino_serial_read'] = {
    init: function() {
      this.appendDummyInput().appendField('Serial.read()');
      this.setOutput(true, 'Number');
      this.setColour(200);
    }
  };

  // --- PIN NUMBER (Helper para Inputs) ---
  Blockly.Blocks['arduino_pin_number'] = {
    init: function() {
      this.appendDummyInput().appendField('pin').appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(230);
    }
  };

  Blockly.Blocks['arduino_led_builtin'] = {
    init: function() {
      this.appendDummyInput().appendField('LED_BUILTIN');
      this.setOutput(true, 'Number');
      this.setColour(230);
    }
  };

  Blockly.Blocks['arduino_high_low'] = {
    init: function() {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([['HIGH', 'HIGH'], ['LOW', 'LOW']]), 'VALUE');
      this.setOutput(true, 'Number');
      this.setColour(230);
    }
  };

  // --- MOTORES L298N ---
  Blockly.Blocks['motor_setup'] = {
    init: function () {
      this.appendDummyInput().appendField("Configurar Motor L298N");
      this.appendDummyInput().appendField("Nombre").appendField(new Blockly.FieldTextInput("Motor1"), "MOTOR_NAME");
      this.appendDummyInput().appendField("IN1").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'IN1');
      this.appendDummyInput().appendField("IN2").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'IN2');
      this.appendDummyInput().appendField("EN").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'EN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#E67E22');
    }
  };

  Blockly.Blocks['motor_run'] = {
    init: function () {
      this.appendDummyInput().appendField("Mover Motor");
      this.appendDummyInput().appendField("Nombre").appendField(new Blockly.FieldTextInput("Motor1"), "MOTOR_NAME");
      this.appendDummyInput().appendField("Dirección").appendField(new Blockly.FieldDropdown([["Adelante", "FORWARD"], ["Atrás", "BACKWARD"]]), "DIRECTION");
      this.appendValueInput("SPEED").setCheck("Number").appendField("Velocidad (0-255)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#E67E22');
    }
  };

  Blockly.Blocks['motor_stop'] = {
    init: function () {
      this.appendDummyInput().appendField("Parar Motor");
      this.appendDummyInput().appendField("Nombre").appendField(new Blockly.FieldTextInput("Motor1"), "MOTOR_NAME");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#E67E22');
    }
  };

  // --- SENSORES ---
  Blockly.Blocks['ultrasonic_read'] = {
    init: function() {
      this.appendDummyInput().appendField("Distancia Ultrasonido (cm)");
      this.appendDummyInput().appendField("Trig").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'TRIG_PIN');
      this.appendDummyInput().appendField("Echo").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'ECHO_PIN');
      this.setOutput(true, "Number");
      this.setColour('#8E44AD');
    }
  };

  Blockly.Blocks['color_sensor_read'] = {
    init: function () {
      this.appendDummyInput().appendField("Sensor Color (TCS3200)");
      this.appendDummyInput().appendField("S0").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'S0');
      this.appendDummyInput().appendField("S1").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'S1');
      this.appendDummyInput().appendField("S2").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'S2');
      this.appendDummyInput().appendField("S3").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'S3');
      this.appendDummyInput().appendField("OUT").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'OUT');
      this.appendDummyInput().appendField("Componente").appendField(new Blockly.FieldDropdown([['Rojo', 'RED'], ['Verde', 'GREEN'], ['Azul', 'BLUE']]), 'COLOR_COMP');
      this.setOutput(true, "Number");
      this.setColour('#F1C40F');
    }
  };

  Blockly.Blocks['sound_sensor_read'] = {
    init: function () {
        this.appendDummyInput().appendField("Sensor Sonido");
        this.appendDummyInput().appendField("Pin").appendField(new Blockly.FieldDropdown(ANALOG_PINS_DROPDOWN), 'PIN');
        this.setOutput(true, "Number");
        this.setColour('#8E44AD');
    }
  };

  // --- WIFI & BLUETOOTH ---
  Blockly.Blocks['wifi_connect'] = {
    init: function() {
      this.appendDummyInput().appendField("Conectar WiFi");
      this.appendValueInput("SSID").setCheck("String").appendField("SSID");
      this.appendValueInput("PASS").setCheck("String").appendField("Clave");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#27AE60');
    }
  };

  Blockly.Blocks['wifi_is_connected'] = {
    init: function() {
      this.appendDummyInput().appendField("¿WiFi Conectado?");
      this.setOutput(true, "Boolean");
      this.setColour('#27AE60');
    }
  };

  Blockly.Blocks['bluetooth_setup'] = {
    init: function() {
      this.appendDummyInput().appendField("Configurar Bluetooth");
      this.appendDummyInput().appendField("RX").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'RX_PIN');
      this.appendDummyInput().appendField("TX").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'TX_PIN');
      this.appendDummyInput().appendField("Baudios").appendField(new Blockly.FieldDropdown([['9600', '9600'], ['38400', '38400']]), 'BAUD');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#2980B9');
    }
  };

  Blockly.Blocks['bluetooth_read_string'] = {
    init: function() {
      this.appendDummyInput().appendField("BT Leer Texto");
      this.setOutput(true, "String");
      this.setColour('#2980B9');
    }
  };

  Blockly.Blocks['bluetooth_send_string'] = {
    init: function() {
      this.appendValueInput("DATA").setCheck(null).appendField("BT Enviar");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#2980B9');
    }
  };

  // --- MATRIZ 8x8 ---
  Blockly.Blocks['display_8x8_setup'] = {
    init: function() {
      this.appendDummyInput().appendField("Configurar Matriz 8x8");
      this.appendDummyInput().appendField("DIN").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'DIN');
      this.appendDummyInput().appendField("CLK").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'CLK');
      this.appendDummyInput().appendField("CS").appendField(new Blockly.FieldDropdown(DIGITAL_PINS_DROPDOWN), 'CS');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#D35400');
    }
  };

  Blockly.Blocks['display_8x8_draw'] = {
    init: function() {
      this.appendDummyInput().appendField("Dibujar Fila Matriz");
      this.appendValueInput("ROW").setCheck("Number").appendField("Fila (0-7)");
      this.appendValueInput("BITMAP").setCheck("Number").appendField("Bits (0-255)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#D35400');
    }
  };

  // --- SERVOS & TONOS ---
  Blockly.Blocks['arduino_servo_attach'] = {
    init: function() {
      this.appendValueInput('PIN').setCheck('Number').appendField('Servo Adjuntar PIN');
      this.appendDummyInput().appendField('como').appendField(new Blockly.FieldDropdown([['servo1', 'servo1'], ['servo2', 'servo2']]), 'SERVO');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(280);
    }
  };

  Blockly.Blocks['arduino_servo_write'] = {
    init: function() {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([['servo1', 'servo1'], ['servo2', 'servo2']]), 'SERVO');
      this.appendValueInput('ANGLE').setCheck('Number').appendField('Mover a ángulo');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(280);
    }
  };

  Blockly.Blocks['arduino_tone'] = {
    init: function() {
      this.appendValueInput('PIN').setCheck('Number').appendField('tone pin');
      this.appendValueInput('FREQ').setCheck('Number').appendField('frequency');
      this.appendValueInput('DURATION').setCheck('Number').appendField('duration (ms)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(280);
    }
  };

  Blockly.Blocks['arduino_no_tone'] = {
    init: function() {
      this.appendValueInput('PIN').setCheck('Number').appendField('noTone pin');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(280);
    }
  };

  // --- MATEMÁTICAS Y LÓGICA EXTRAS ---
  Blockly.Blocks['arduino_map'] = {
    init: function() {
      this.appendValueInput('VALUE').setCheck('Number').appendField('map');
      this.appendValueInput('FROM_LOW').setCheck('Number').appendField('de min');
      this.appendValueInput('FROM_HIGH').setCheck('Number').appendField('de max');
      this.appendValueInput('TO_LOW').setCheck('Number').appendField('a min');
      this.appendValueInput('TO_HIGH').setCheck('Number').appendField('a max');
      this.setOutput(true, 'Number');
      this.setColour(230);
    }
  };

  Blockly.Blocks['arduino_constrain'] = {
    init: function() {
      this.appendValueInput('VALUE').setCheck('Number').appendField('constrain');
      this.appendValueInput('LOW').setCheck('Number').appendField('min');
      this.appendValueInput('HIGH').setCheck('Number').appendField('max');
      this.setOutput(true, 'Number');
      this.setColour(230);
    }
  };

  Blockly.Blocks['arduino_text'] = {
    init: function() {
      this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput('Hello'), 'TEXT').appendField('"');
      this.setOutput(true, 'String');
      this.setColour(160);
    }
  };
};

// =========================================================
// 3. GENERADOR DE CÓDIGO (createArduinoGenerator)
// =========================================================
export const createArduinoGenerator = (): any => {
  const Arduino: any = new Blockly.Generator('Arduino');

  // Prioridad de operadores C++
  Arduino.ORDER_ATOMIC = 0;
  Arduino.ORDER_UNARY_POSTFIX = 1;
  Arduino.ORDER_UNARY_PREFIX = 2;
  Arduino.ORDER_MULTIPLICATIVE = 3;
  Arduino.ORDER_ADDITIVE = 4;
  Arduino.ORDER_SHIFT = 5;
  Arduino.ORDER_RELATIONAL = 6;
  Arduino.ORDER_EQUALITY = 7;
  Arduino.ORDER_BITWISE_AND = 8;
  Arduino.ORDER_BITWISE_XOR = 9;
  Arduino.ORDER_BITWISE_OR = 10;
  Arduino.ORDER_LOGICAL_AND = 11;
  Arduino.ORDER_LOGICAL_OR = 12;
  Arduino.ORDER_CONDITIONAL = 13;
  Arduino.ORDER_ASSIGNMENT = 14;
  Arduino.ORDER_NONE = 99;

  // Inicialización de listas para definiciones
  Arduino.init = function(workspace: Blockly.Workspace) {
    this.definitions_ = {};
    this.setups_ = {};
    this.variables_ = {};
    
    // Declarar variables globales automáticamente
    const variables = workspace.getVariableMap().getAllVariables();
    for (const variable of variables) {
      const varName = variable.name.replace(/[^a-zA-Z0-9_]/g, '_');
      this.variables_[varName] = `int ${varName} = 0;`;
    }
  };

  // Construcción del código final
  Arduino.finish = function(code: string) {
    const definitions = Object.values(this.definitions_).join('\n');
    const variables = Object.values(this.variables_).join('\n');
    const setups = Object.values(this.setups_).join('\n  ');
    
    // Si el usuario usa el bloque "arduino_setup_loop", no generamos setup() automático
    let setupFunction = '';
    let loopFunction = '';

    if (code.includes('void setup()') || code.includes('void loop()')) {
        // El usuario usó bloques de estructura explícita
        return `// Generado por M4rk-IDE${definitions}${variables}\n\n${code}`;
    } else {
        // Generación automática de estructura
        setupFunction = `void setup() {\n  ${setups}\n}\n\n`;
        loopFunction = `void loop() {\n${code}\n}`;
        return `// Generado por M4rk-IDE${definitions}${variables}\n\n${setupFunction}${loopFunction}`;
    }
  };

  Arduino.scrub_ = function(block: Blockly.Block, code: string) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const nextCode = this.blockToCode(nextBlock);
    return code + nextCode;
  };

  // --- GENERADORES INDIVIDUALES ---
  
  Arduino.forBlock = Arduino.forBlock || {};

  // Estructura
  Arduino.forBlock['arduino_setup_loop'] = function(block: Blockly.Block) {
    const setupCode = Arduino.statementToCode(block, 'SETUP');
    const loopCode = Arduino.statementToCode(block, 'LOOP');
    return `void setup() {\n${setupCode}}\n\nvoid loop() {\n${loopCode}}\n`;
  };
  
  Arduino.forBlock['arduino_start'] = function(block: Blockly.Block) {
    return Arduino.statementToCode(block, 'DO');
  };

  // Digital I/O
  Arduino.forBlock['arduino_pin_mode'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '0';
    const mode = block.getFieldValue('MODE');
    return `pinMode(${pin}, ${mode});\n`;
  };

  Arduino.forBlock['arduino_digital_write'] = function(block: Blockly.Block) {
    // AHORA USA valueToCode porque 'PIN' es un Input, no un Field
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '0';
    const state = block.getFieldValue('VALUE'); // Restaurado a VALUE
    Arduino.setups_['pin_' + pin] = `pinMode(${pin}, OUTPUT);`;
    return `digitalWrite(${pin}, ${state});\n`;
  };

  Arduino.forBlock['arduino_digital_read'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '0';
    Arduino.setups_['pin_' + pin] = `pinMode(${pin}, INPUT);`;
    return [`digitalRead(${pin})`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Analog I/O
  Arduino.forBlock['arduino_analog_write'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '0';
    const val = Arduino.valueToCode(block, 'VALUE', Arduino.ORDER_ATOMIC) || '0';
    Arduino.setups_['pin_' + pin] = `pinMode(${pin}, OUTPUT);`;
    return `analogWrite(${pin}, ${val});\n`;
  };

  Arduino.forBlock['arduino_analog_read'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || 'A0';
    return [`analogRead(${pin})`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Tiempo
  Arduino.forBlock['arduino_delay'] = function(block: Blockly.Block) {
    const time = Arduino.valueToCode(block, 'TIME', Arduino.ORDER_ATOMIC) || '1000';
    return `delay(${time});\n`;
  };

  Arduino.forBlock['arduino_delay_microseconds'] = function(block: Blockly.Block) {
    const time = Arduino.valueToCode(block, 'TIME', Arduino.ORDER_ATOMIC) || '1000';
    return `delayMicroseconds(${time});\n`;
  };

  Arduino.forBlock['arduino_millis'] = function() {
    return ['millis()', Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['arduino_micros'] = function() {
    return ['micros()', Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Serial
  Arduino.forBlock['arduino_serial_begin'] = function(block: Blockly.Block) {
    const baud = block.getFieldValue('BAUD');
    Arduino.setups_['serial'] = `Serial.begin(${baud});`;
    return '';
  };

  Arduino.forBlock['arduino_serial_print'] = function(block: Blockly.Block) {
    const val = Arduino.valueToCode(block, 'VALUE', Arduino.ORDER_ATOMIC) || '""';
    return `Serial.print(${val});\n`;
  };

  Arduino.forBlock['arduino_serial_println'] = function(block: Blockly.Block) {
    const val = Arduino.valueToCode(block, 'VALUE', Arduino.ORDER_ATOMIC) || '""';
    return `Serial.println(${val});\n`;
  };

  Arduino.forBlock['arduino_serial_available'] = function() {
    return ['Serial.available()', Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['arduino_serial_read'] = function() {
    return ['Serial.read()', Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Pines y Constantes
  Arduino.forBlock['arduino_pin_number'] = function(block: Blockly.Block) {
    const pin = block.getFieldValue('PIN');
    return [pin, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['arduino_led_builtin'] = function() {
    return ['LED_BUILTIN', Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['arduino_high_low'] = function(block: Blockly.Block) {
    const val = block.getFieldValue('VALUE');
    return [val, Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Motores L298N
  Arduino.forBlock['motor_setup'] = function(block: Blockly.Block) {
    const name = block.getFieldValue('MOTOR_NAME').replace(/[^a-zA-Z0-9_]/g, '');
    const in1 = block.getFieldValue('IN1');
    const in2 = block.getFieldValue('IN2');
    const en = block.getFieldValue('EN');
    
    Arduino.definitions_['motor_' + name] = `int ${name}_IN1=${in1}; int ${name}_IN2=${in2}; int ${name}_EN=${en};`;
    Arduino.setups_['motor_' + name] = `pinMode(${name}_IN1, OUTPUT); pinMode(${name}_IN2, OUTPUT); pinMode(${name}_EN, OUTPUT);`;
    return '';
  };

  Arduino.forBlock['motor_run'] = function(block: Blockly.Block) {
    const name = block.getFieldValue('MOTOR_NAME').replace(/[^a-zA-Z0-9_]/g, '');
    const dir = block.getFieldValue('DIRECTION');
    const speed = Arduino.valueToCode(block, 'SPEED', Arduino.ORDER_ATOMIC) || '255';
    
    const code = `digitalWrite(${name}_IN1, ${dir === 'FORWARD' ? 'HIGH' : 'LOW'});\n` +
                 `digitalWrite(${name}_IN2, ${dir === 'FORWARD' ? 'LOW' : 'HIGH'});\n` +
                 `analogWrite(${name}_EN, ${speed});\n`;
    return code;
  };

  Arduino.forBlock['motor_stop'] = function(block: Blockly.Block) {
    const name = block.getFieldValue('MOTOR_NAME').replace(/[^a-zA-Z0-9_]/g, '');
    return `analogWrite(${name}_EN, 0); digitalWrite(${name}_IN1, LOW); digitalWrite(${name}_IN2, LOW);\n`;
  };

  // Sensores
  Arduino.forBlock['ultrasonic_read'] = function(block: Blockly.Block) {
    const trig = block.getFieldValue('TRIG_PIN');
    const echo = block.getFieldValue('ECHO_PIN');
    Arduino.setups_['ultra_' + trig] = `pinMode(${trig}, OUTPUT); pinMode(${echo}, INPUT);`;
    Arduino.definitions_['func_ultra'] = `long readUltrasonicDistance(int trigPin, int echoPin) {\n  digitalWrite(trigPin, LOW); delayMicroseconds(2);\n  digitalWrite(trigPin, HIGH); delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n  return pulseIn(echoPin, HIGH) * 0.034 / 2;\n}`;
    return [`readUltrasonicDistance(${trig}, ${echo})`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['color_sensor_read'] = function(block: Blockly.Block) {
    const s0 = block.getFieldValue('S0');
    const s1 = block.getFieldValue('S1');
    const s2 = block.getFieldValue('S2');
    const s3 = block.getFieldValue('S3');
    const out = block.getFieldValue('OUT');
    const colorComp = block.getFieldValue('COLOR_COMP');

    Arduino.setups_['color_sensor_' + out] = `pinMode(${s0}, OUTPUT); pinMode(${s1}, OUTPUT); pinMode(${s2}, OUTPUT); pinMode(${s3}, OUTPUT); pinMode(${out}, INPUT); digitalWrite(${s0}, HIGH); digitalWrite(${s1}, LOW);`;

    let filterCode = '';
    if (colorComp === 'RED') { filterCode = `digitalWrite(${s2}, LOW); digitalWrite(${s3}, LOW);`; }
    else if (colorComp === 'GREEN') { filterCode = `digitalWrite(${s2}, HIGH); digitalWrite(${s3}, HIGH);`; }
    else if (colorComp === 'BLUE') { filterCode = `digitalWrite(${s2}, LOW); digitalWrite(${s3}, HIGH);`; }

    const funcName = `readColor_${colorComp}`;
    Arduino.definitions_['func_' + funcName] = `int ${funcName}(int s2, int s3, int out) { ${filterCode} return pulseIn(out, LOW); }`;

    return [`${funcName}(${s2}, ${s3}, ${out})`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['sound_sensor_read'] = function (block: Blockly.Block) {
    const pin = block.getFieldValue('PIN');
    return ['analogRead(' + pin + ')', Arduino.ORDER_ATOMIC] as [string, number];
  };

  // WiFi
  Arduino.forBlock['wifi_connect'] = function(block: Blockly.Block) {
    const ssid = Arduino.valueToCode(block, 'SSID', Arduino.ORDER_ATOMIC) || '"SSID"';
    const pass = Arduino.valueToCode(block, 'PASS', Arduino.ORDER_ATOMIC) || '"PASS"';
    Arduino.definitions_['wifi_inc'] = '#include <WiFi.h>';
    Arduino.setups_['wifi_begin'] = `WiFi.begin(${ssid}, ${pass});`;
    return '';
  };

  Arduino.forBlock['wifi_is_connected'] = function(block: Blockly.Block) {
    return ['(WiFi.status() == WL_CONNECTED)', Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Bluetooth
  Arduino.forBlock['bluetooth_setup'] = function(block: Blockly.Block) {
    const rx = block.getFieldValue('RX_PIN');
    const tx = block.getFieldValue('TX_PIN');
    const baud = block.getFieldValue('BAUD');
    Arduino.definitions_['bt_inc'] = '#include <SoftwareSerial.h>';
    Arduino.definitions_['bt_obj'] = `SoftwareSerial BTSerial(${rx}, ${tx});`;
    Arduino.setups_['bt_begin'] = `BTSerial.begin(${baud});`;
    return '';
  };

  Arduino.forBlock['bluetooth_read_string'] = function(block: Blockly.Block) {
    return ['BTSerial.readString()', Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['bluetooth_send_string'] = function(block: Blockly.Block) {
    const data = Arduino.valueToCode(block, 'DATA', Arduino.ORDER_ATOMIC) || '""';
    return `BTSerial.println(${data});\n`;
  };

  // Display 8x8
  Arduino.forBlock['display_8x8_setup'] = function(block: Blockly.Block) {
    const din = block.getFieldValue('DIN');
    const clk = block.getFieldValue('CLK');
    const cs = block.getFieldValue('CS');
    Arduino.definitions_['matrix_pins'] = `const int DIN_PIN = ${din}; const int CLK_PIN = ${clk}; const int CS_PIN = ${cs};`;
    Arduino.definitions_['matrix_func'] = `void max7219_write(byte addr, byte data) { digitalWrite(CS_PIN, LOW); shiftOut(DIN_PIN, CLK_PIN, MSBFIRST, addr); shiftOut(DIN_PIN, CLK_PIN, MSBFIRST, data); digitalWrite(CS_PIN, HIGH); }`;
    Arduino.setups_['matrix_init'] = `pinMode(DIN_PIN, OUTPUT); pinMode(CLK_PIN, OUTPUT); pinMode(CS_PIN, OUTPUT); max7219_write(0x09, 0x00); max7219_write(0x0B, 0x07); max7219_write(0x0C, 0x01); max7219_write(0x0F, 0x00);`;
    return '';
  };

  Arduino.forBlock['display_8x8_draw'] = function(block: Blockly.Block) {
     const row = Arduino.valueToCode(block, 'ROW', Arduino.ORDER_ATOMIC) || '0';
     const bits = Arduino.valueToCode(block, 'BITMAP', Arduino.ORDER_ATOMIC) || '0';
     return `max7219_write(${row} + 1, ${bits});\n`; 
  };

  // Servos & Tonos
  Arduino.forBlock['arduino_servo_attach'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '9';
    const servo = block.getFieldValue('SERVO');
    Arduino.definitions_['servo_inc'] = '#include <Servo.h>';
    Arduino.definitions_['servo_' + servo] = `Servo ${servo};`;
    Arduino.setups_['servo_att_' + servo] = `${servo}.attach(${pin});`;
    return '';
  };

  Arduino.forBlock['arduino_servo_write'] = function(block: Blockly.Block) {
    const servo = block.getFieldValue('SERVO');
    const angle = Arduino.valueToCode(block, 'ANGLE', Arduino.ORDER_ATOMIC) || '90';
    return `${servo}.write(${angle});\n`;
  };

  Arduino.forBlock['arduino_tone'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '0';
    const freq = Arduino.valueToCode(block, 'FREQ', Arduino.ORDER_ATOMIC) || '440';
    const duration = Arduino.valueToCode(block, 'DURATION', Arduino.ORDER_ATOMIC) || '1000';
    return `tone(${pin}, ${freq}, ${duration});\n`;
  };

  Arduino.forBlock['arduino_no_tone'] = function(block: Blockly.Block) {
    const pin = Arduino.valueToCode(block, 'PIN', Arduino.ORDER_ATOMIC) || '0';
    return `noTone(${pin});\n`;
  };

  // Wrappers para Matemáticas y Lógica
  Arduino.forBlock['arduino_map'] = function(block: Blockly.Block) {
    const val = Arduino.valueToCode(block, 'VALUE', Arduino.ORDER_ATOMIC) || '0';
    const fl = Arduino.valueToCode(block, 'FROM_LOW', Arduino.ORDER_ATOMIC) || '0';
    const fh = Arduino.valueToCode(block, 'FROM_HIGH', Arduino.ORDER_ATOMIC) || '1023';
    const tl = Arduino.valueToCode(block, 'TO_LOW', Arduino.ORDER_ATOMIC) || '0';
    const th = Arduino.valueToCode(block, 'TO_HIGH', Arduino.ORDER_ATOMIC) || '255';
    return [`map(${val}, ${fl}, ${fh}, ${tl}, ${th})`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['arduino_constrain'] = function(block: Blockly.Block) {
    const val = Arduino.valueToCode(block, 'VALUE', Arduino.ORDER_ATOMIC) || '0';
    const low = Arduino.valueToCode(block, 'LOW', Arduino.ORDER_ATOMIC) || '0';
    const high = Arduino.valueToCode(block, 'HIGH', Arduino.ORDER_ATOMIC) || '255';
    return [`constrain(${val}, ${low}, ${high})`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['arduino_text'] = function(block: Blockly.Block) {
    const text = block.getFieldValue('TEXT');
    return [`"${text}"`, Arduino.ORDER_ATOMIC] as [string, number];
  };

  // --- BLOQUES ESTÁNDAR (Logic, Math, Loops) ---
  
  Arduino.forBlock['controls_if'] = function(block: Blockly.Block) {
    let n = 0;
    let code = '';
    let branchCode, conditionCode;
    do {
      conditionCode = Arduino.valueToCode(block, 'IF' + n, Arduino.ORDER_NONE) || 'false';
      branchCode = Arduino.statementToCode(block, 'DO' + n);
      code += (n > 0 ? ' else ' : '') + `if (${conditionCode}) {\n${branchCode}}`;
      ++n;
    } while (block.getInput('IF' + n));
    if (block.getInput('ELSE')) {
      branchCode = Arduino.statementToCode(block, 'ELSE');
      code += ` else {\n${branchCode}}`;
    }
    return code + '\n';
  };

  Arduino.forBlock['controls_repeat_ext'] = function(block: Blockly.Block) {
    const times = Arduino.valueToCode(block, 'TIMES', Arduino.ORDER_ATOMIC) || '10';
    const branch = Arduino.statementToCode(block, 'DO');
    return `for (int i = 0; i < ${times}; i++) {\n${branch}}\n`;
  };

  Arduino.forBlock['controls_whileUntil'] = function(block: Blockly.Block) {
    const until = block.getFieldValue('MODE') === 'UNTIL';
    let argument0 = Arduino.valueToCode(block, 'BOOL', Arduino.ORDER_NONE) || 'false';
    const branch = Arduino.statementToCode(block, 'DO');
    if (until) {
      argument0 = `!${argument0}`;
    }
    return `while (${argument0}) {\n${branch}}\n`;
  };

  Arduino.forBlock['controls_for'] = function(block: Blockly.Block) {
    const varId = block.getFieldValue('VAR');
    const variable = block.workspace.getVariableById(varId);
    const varName = Arduino.getVariableName(variable.name);

    const argument0 = Arduino.valueToCode(block, 'FROM', Arduino.ORDER_ASSIGNMENT) || '0';
    const argument1 = Arduino.valueToCode(block, 'TO', Arduino.ORDER_ASSIGNMENT) || '10';
    const increment = Arduino.valueToCode(block, 'BY', Arduino.ORDER_ASSIGNMENT) || '1';
    const branch = Arduino.statementToCode(block, 'DO');
    return `for (int ${varName} = ${argument0}; ${varName} <= ${argument1}; ${varName} += ${increment}) {\n${branch}}\n`;
  };

  Arduino.forBlock['math_number'] = function(block: Blockly.Block) {
    const code = String(block.getFieldValue('NUM'));
    return [code, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['math_arithmetic'] = function(block: Blockly.Block) {
    const OPERATORS: any = {
      'ADD': [' + ', Arduino.ORDER_ADDITIVE],
      'MINUS': [' - ', Arduino.ORDER_ADDITIVE],
      'MULTIPLY': [' * ', Arduino.ORDER_MULTIPLICATIVE],
      'DIVIDE': [' / ', Arduino.ORDER_MULTIPLICATIVE],
      'POWER': [null, Arduino.ORDER_NONE]
    };
    const tuple = OPERATORS[block.getFieldValue('OP')];
    const operator = tuple[0];
    const order = tuple[1];
    const arg0 = Arduino.valueToCode(block, 'A', order) || '0';
    const arg1 = Arduino.valueToCode(block, 'B', order) || '0';
    if (!operator) return [`pow(${arg0}, ${arg1})`, Arduino.ORDER_UNARY_POSTFIX] as [string, number];
    return [arg0 + operator + arg1, order] as [string, number];
  };

  Arduino.forBlock['logic_compare'] = function(block: Blockly.Block) {
     const OPS: any = { 'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 'GT': '>', 'GTE': '>=' };
     const op = OPS[block.getFieldValue('OP')];
     const arg0 = Arduino.valueToCode(block, 'A', Arduino.ORDER_RELATIONAL) || '0';
     const arg1 = Arduino.valueToCode(block, 'B', Arduino.ORDER_RELATIONAL) || '0';
     return [`${arg0} ${op} ${arg1}`, Arduino.ORDER_RELATIONAL] as [string, number];
  };

  Arduino.forBlock['logic_operation'] = function(block: Blockly.Block) {
    const op = (block.getFieldValue('OP') == 'AND') ? '&&' : '||';
    const order = (op == '&&') ? Arduino.ORDER_LOGICAL_AND : Arduino.ORDER_LOGICAL_OR;
    const argument0 = Arduino.valueToCode(block, 'A', order) || 'false';
    const argument1 = Arduino.valueToCode(block, 'B', order) || 'false';
    return [argument0 + ' ' + op + ' ' + argument1, order] as [string, number];
  };

  Arduino.forBlock['logic_negate'] = function(block: Blockly.Block) {
    const argument0 = Arduino.valueToCode(block, 'BOOL', Arduino.ORDER_UNARY_PREFIX) || 'true';
    return ['!' + argument0, Arduino.ORDER_UNARY_PREFIX] as [string, number];
  };

  Arduino.forBlock['logic_boolean'] = function(block: Blockly.Block) {
    const code = (block.getFieldValue('BOOL') == 'TRUE') ? 'true' : 'false';
    return [code, Arduino.ORDER_ATOMIC] as [string, number];
  };

  // Variables
  Arduino.forBlock['variables_get'] = function(block: Blockly.Block) {
    const varId = block.getFieldValue('VAR');
    const variable = block.workspace.getVariableById(varId);
    const varName = Arduino.getVariableName(variable.name);
    return [varName, Arduino.ORDER_ATOMIC] as [string, number];
  };

  Arduino.forBlock['variables_set'] = function(block: Blockly.Block) {
    const varId = block.getFieldValue('VAR');
    const variable = block.workspace.getVariableById(varId);
    const varName = Arduino.getVariableName(variable.name);
    
    const value = Arduino.valueToCode(block, 'VALUE', Arduino.ORDER_ASSIGNMENT) || '0';
    return `${varName} = ${value};\n`;
  };

  Arduino.getVariableName = function(name: string) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  return Arduino;
};

// =========================================================
// 4. CONFIGURACIÓN DEL TOOLBOX (MENU LATERAL)
// =========================================================
export const arduinoToolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Estructura',
      colour: '120',
      contents: [
        { kind: 'block', type: 'arduino_start' },
        { kind: 'block', type: 'arduino_setup_loop' }
      ]
    },
    {
      kind: 'category',
      name: 'Hardware IO',
      colour: '65',
      contents: [
        { kind: 'block', type: 'arduino_digital_write' },
        { kind: 'block', type: 'arduino_digital_read' },
        { kind: 'block', type: 'arduino_analog_write' },
        { kind: 'block', type: 'arduino_analog_read' },
        { kind: 'block', type: 'arduino_pin_mode' },
        { kind: 'block', type: 'arduino_pin_number' }, // Añadido bloque de número de pin
        { kind: 'block', type: 'arduino_delay' },
        { kind: 'block', type: 'arduino_millis' }
      ]
    },
    {
      kind: 'category',
      name: 'Motores',
      colour: '#E67E22',
      contents: [
        { kind: 'block', type: 'motor_setup' },
        { kind: 'block', type: 'motor_run' },
        { kind: 'block', type: 'motor_stop' },
        { kind: 'block', type: 'arduino_servo_attach' },
        { kind: 'block', type: 'arduino_servo_write' }
      ]
    },
    {
      kind: 'category',
      name: 'Sensores',
      colour: '#8E44AD',
      contents: [
        { kind: 'block', type: 'ultrasonic_read' },
        { kind: 'block', type: 'color_sensor_read' },
        { kind: 'block', type: 'sound_sensor_read' }
      ]
    },
    {
      kind: 'category',
      name: 'Conectividad',
      colour: '#27AE60',
      contents: [
        { kind: 'block', type: 'wifi_connect' },
        { kind: 'block', type: 'wifi_is_connected' },
        { kind: 'block', type: 'bluetooth_setup' },
        { kind: 'block', type: 'bluetooth_send_string' },
        { kind: 'block', type: 'bluetooth_read_string' },
        { kind: 'block', type: 'arduino_serial_begin' },
        { kind: 'block', type: 'arduino_serial_print' },
        { kind: 'block', type: 'arduino_serial_println' }
      ]
    },
    {
      kind: 'category',
      name: 'Display',
      colour: '#D35400',
      contents: [
        { kind: 'block', type: 'display_8x8_setup' },
        { kind: 'block', type: 'display_8x8_draw' }
      ]
    },
    {
      kind: 'category',
      name: 'Lógica',
      colour: '210',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_negate' }
      ]
    },
    {
      kind: 'category',
      name: 'Bucles',
      colour: '120',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' }
      ]
    },
    {
      kind: 'category',
      name: 'Matemáticas',
      colour: '230',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'arduino_map' },
        { kind: 'block', type: 'arduino_constrain' }
      ]
    },
    {
      kind: 'category',
      name: 'Texto',
      colour: '160',
      contents: [
        { kind: 'block', type: 'arduino_text' }
      ]
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: '#A65C81',
      custom: 'VARIABLE'
    }
  ]
};