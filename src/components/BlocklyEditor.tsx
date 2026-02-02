import React, { useEffect, useRef, useCallback } from 'react';
import * as Blockly from 'blockly';
import { defineArduinoBlocks, createArduinoGenerator, arduinoToolbox } from '@/lib/arduino-blocks';
import { useIDE } from '@/contexts/IDEContext';

interface BlocklyEditorProps {
  onCodeChange?: (code: string) => void;
  initialXml?: string;
}

const BlocklyEditor: React.FC<BlocklyEditorProps> = ({ onCodeChange, initialXml }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const generatorRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const { setGeneratedCode, addConsoleMessage } = useIDE();

  const generateCode = useCallback(() => {
    if (!workspaceRef.current || !generatorRef.current) return;
    
    try {
      generatorRef.current.init(workspaceRef.current);
      const code = generatorRef.current.workspaceToCode(workspaceRef.current);
      setGeneratedCode(code);
      onCodeChange?.(code);
    } catch (error) {
      console.error('Code generation error:', error);
      addConsoleMessage('error', `Error generando código: ${error}`);
    }
  }, [setGeneratedCode, onCodeChange, addConsoleMessage]);

  // Force resize when component mounts or visibility changes
  const forceResize = useCallback(() => {
    if (workspaceRef.current && containerRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (workspaceRef.current) {
          Blockly.svgResize(workspaceRef.current);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    // Define Arduino blocks
    defineArduinoBlocks();
    
    // Create Generator
    generatorRef.current = createArduinoGenerator();

    // Create workspace with kids theme
    const kidsTheme = Blockly.Theme.defineTheme('arduino-kids', {
      name: 'arduino-kids',
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#f8fafc',
        toolboxBackgroundColour: '#f1f5f9',
        toolboxForegroundColour: '#475569',
        flyoutBackgroundColour: '#f8fafc',
        flyoutForegroundColour: '#334155',
        flyoutOpacity: 0.98,
        scrollbarColour: '#94a3b8',
        insertionMarkerColour: '#06b6d4',
        insertionMarkerOpacity: 0.4,
        scrollbarOpacity: 0.7,
        cursorColour: '#06b6d4',
      },
      fontStyle: {
        family: 'Nunito, Quicksand, sans-serif',
        weight: 'bold',
        size: 12,
      },
    });

    workspaceRef.current = Blockly.inject(containerRef.current, {
      toolbox: arduinoToolbox,
      theme: kidsTheme,
      grid: {
        spacing: 24,
        length: 4,
        colour: '#e2e8f0',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: true,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
      sounds: false,
    });

    isInitializedRef.current = true;

    // Load initial XML or default blocks
    if (!initialXml) {
      const defaultXml = `
        <xml xmlns="https://developers.google.com/blockly/xml">
          <block type="arduino_setup_loop" x="50" y="50">
            <statement name="SETUP">
              <block type="arduino_pin_mode">
                <value name="PIN">
                  <block type="arduino_led_builtin"></block>
                </value>
              </block>
            </statement>
            <statement name="LOOP">
              <block type="arduino_digital_write">
                <value name="PIN">
                  <block type="arduino_led_builtin"></block>
                </value>
                <next>
                  <block type="arduino_delay">
                    <value name="TIME">
                      <block type="math_number">
                        <field name="NUM">1000</field>
                      </block>
                    </value>
                    <next>
                      <block type="arduino_digital_write">
                        <value name="PIN">
                          <block type="arduino_led_builtin"></block>
                        </value>
                        <field name="VALUE">LOW</field>
                        <next>
                          <block type="arduino_delay">
                            <value name="TIME">
                              <block type="math_number">
                                <field name="NUM">1000</field>
                              </block>
                            </value>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </xml>
      `;
      Blockly.Xml.domToWorkspace(
        Blockly.utils.xml.textToDom(defaultXml),
        workspaceRef.current
      );
    } else {
      try {
        Blockly.Xml.domToWorkspace(
          Blockly.utils.xml.textToDom(initialXml),
          workspaceRef.current
        );
      } catch (error) {
        console.error('Error loading XML:', error);
        addConsoleMessage('error', `Error cargando bloques: ${error}`);
      }
    }

    // Generate initial code
    setTimeout(generateCode, 100);

    // Listen for workspace changes
    const changeListener = (event: Blockly.Events.Abstract) => {
      if (
        event.type === Blockly.Events.BLOCK_CHANGE ||
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE ||
        event.type === Blockly.Events.BLOCK_MOVE
      ) {
        generateCode();
      }

      // Force resize on toolbox events to fix scroll issues
      if (event.type === Blockly.Events.UI || event.type === Blockly.Events.VIEWPORT_CHANGE) {
        Blockly.svgResize(workspaceRef.current!);
      }
    };

    workspaceRef.current.addChangeListener(changeListener);

    // Handle resize with ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      forceResize();
    });
    resizeObserver.observe(containerRef.current);

    // Also handle window resize
    const handleWindowResize = () => forceResize();
    window.addEventListener('resize', handleWindowResize);

    // Handle visibility change (when switching tabs/views)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(forceResize, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (workspaceRef.current) {
        workspaceRef.current.removeChangeListener(changeListener);
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [generateCode, initialXml, forceResize, addConsoleMessage]);

  // Handle initialXml changes (when loading a project)
  useEffect(() => {
    if (workspaceRef.current && initialXml && isInitializedRef.current) {
      try {
        workspaceRef.current.clear();
        Blockly.Xml.domToWorkspace(
          Blockly.utils.xml.textToDom(initialXml),
          workspaceRef.current
        );
        setTimeout(() => {
          generateCode();
          forceResize();
        }, 100);
      } catch (error) {
        console.error('Error updating workspace XML:', error);
      }
    }
  }, [initialXml, generateCode, forceResize]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full blockly-container bg-card"
      style={{ minHeight: '400px' }}
    />
  );
};

export default BlocklyEditor;

// Export function to get workspace XML
export const getWorkspaceXml = (workspace: Blockly.WorkspaceSvg): string => {
  const xml = Blockly.Xml.workspaceToDom(workspace);
  return Blockly.Xml.domToText(xml);
};
