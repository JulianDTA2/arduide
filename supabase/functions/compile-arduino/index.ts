// Edge function for compiling Arduino sketches

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompileRequest {
  code: string;
  board: string;
}

interface CompileResponse {
  success: boolean;
  hex?: string;
  output?: string;
  error?: string;
  size?: {
    flash: number | null;
    ram: number | null;
  };
}

// Board FQBN mappings
const BOARD_FQBN_MAP: Record<string, string> = {
  'arduino:avr:uno': 'arduino:avr:uno',
  'arduino:avr:nano': 'arduino:avr:nano:cpu=atmega328',
  'arduino:avr:mega': 'arduino:avr:mega:cpu=atmega2560',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { code, board }: CompileRequest = await req.json();

    if (!code || !board) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: code and board' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map board to FQBN
    const fqbn = BOARD_FQBN_MAP[board] || board;

    // Get external compiler URL from environment
    const compilerUrl = Deno.env.get('ARDUINO_COMPILER_URL');

    if (!compilerUrl) {
      // No external compiler configured - provide helpful message
      const validation = validateArduinoCode(code);
      
      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: validation.error,
            output: `Code validation failed: ${validation.error}`,
          } as CompileResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Compiler service not configured',
          output: [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '⚠️  ARDUINO_COMPILER_URL not configured',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '',
            '✓ Code validation: PASSED',
            `✓ Board: ${board} → ${fqbn}`,
            '',
            'To enable real HEX compilation, deploy the compiler service:',
            '',
            '1. Go to docs/arduino-compiler-service/README.md',
            '2. Deploy to Render.com, Railway.app, or Google Cloud Run',
            '3. Add ARDUINO_COMPILER_URL secret in Cloud → Secrets',
            '',
            'Example: ARDUINO_COMPILER_URL = https://your-service.onrender.com',
            '',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          ].join('\n'),
        } as CompileResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call external compiler service
    console.log(`Calling compiler service: ${compilerUrl}/compile`);
    
    const compileResponse = await fetch(`${compilerUrl}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, fqbn }),
    });

    if (!compileResponse.ok) {
      const errorText = await compileResponse.text();
      console.error('Compiler service error:', errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Compiler service error: ${compileResponse.status}`,
          output: errorText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await compileResponse.json();
    
    // Format successful output
    if (result.success && result.size) {
      const formattedOutput = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '✓ COMPILATION SUCCESSFUL',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `Board: ${board}`,
        `FQBN: ${fqbn}`,
        '',
        result.size.flash ? `Flash: ${result.size.flash} bytes` : '',
        result.size.ram ? `RAM: ${result.size.ram} bytes` : '',
        '',
        'HEX file generated successfully!',
        'Ready to upload to board.',
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].filter(Boolean).join('\n');
      
      result.output = formattedOutput;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Compile error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Basic Arduino code validation
function validateArduinoCode(code: string): { valid: boolean; error?: string } {
  // Check for required functions
  const hasSetup = /void\s+setup\s*\(\s*\)/.test(code);
  const hasLoop = /void\s+loop\s*\(\s*\)/.test(code);

  if (!hasSetup) {
    return { valid: false, error: 'Missing required void setup() function' };
  }

  if (!hasLoop) {
    return { valid: false, error: 'Missing required void loop() function' };
  }

  // Check for basic syntax issues
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    return { valid: false, error: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing` };
  }

  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;

  if (openParens !== closeParens) {
    return { valid: false, error: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing` };
  }

  // Check for common errors
  const semicolonAfterBrace = /}\s*;/.test(code);
  if (semicolonAfterBrace) {
    // This is actually valid in some cases (struct, class)
  }

  return { valid: true };
}
