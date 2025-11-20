"use client";

import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';
import { X, Code2 } from "lucide-react";

const MonacoCore = dynamic(() => import('@monaco-editor/react'), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center text-gray-500">Initializing VS Code Engine...</div>
});

const JsIcon = () => (
  <div className="w-3.5 h-3.5 bg-[#f7df1e] text-black flex items-end justify-end px-[1px] rounded-[1px] font-bold text-[8px] leading-none select-none shrink-0">
    JS
  </div>
);


export default function CodeEditor({ 
  files, 
  activeFile, 
  setActiveFile,
  onCloseFile,
  setCode,
  onSave,
  fontSize = 14, 
  theme = 'vs-dark' 
}) {
  
  const activeFileObj = files[activeFile];
  
  const handleEditorDidMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onSave) onSave();
    });
  };

  return (
    <div className="h-full w-full pro-panel rounded-xl overflow-hidden flex flex-col transition-all duration-500 group border border-[var(--border-color)] hover:border-[var(--accent)]/30">
      
      {/* Multi-Tab Header */}
      <div className="h-9 border-b border-[var(--border-color)] flex items-end px-2 gap-1 overflow-x-auto no-scrollbar z-20">
        {Object.keys(files).map((fileName) => (
          <div 
            key={fileName}
            onClick={() => setActiveFile(fileName)}
            className={`relative group/tab px-3 py-2 min-w-[100px] max-w-[180px] border-t border-l border-r rounded-t-md flex items-center gap-2 text-xs cursor-pointer select-none transition-all ${
              activeFile === fileName 
                ? "bg-[var(--bg-panel)] border-[var(--border-color)] text-[var(--text-main)] z-10" 
                : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-panel)]/50 hover:text-[var(--text-main)]"
            }`}
          >
            {activeFile === fileName && (
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--accent)] rounded-t-md"></div>
            )}
            
            <JsIcon />
            <span className="truncate flex-1">{fileName}</span>

            {fileName !== 'index.js' && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation(); 
                        onCloseFile(fileName); 
                    }}
                    className={`p-0.5 rounded-md transition-all opacity-0 group-hover/tab:opacity-100 ${
                        activeFile === fileName 
                        ? "hover:bg-[var(--text-main)]/10 text-[var(--text-muted)] hover:text-[var(--text-main)]" 
                        : "hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-500"
                    }`}
                    title="Close File"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
          </div>
        ))}
      </div>
      
      {/* Editor Area */}
      <div className="flex-1 bg-[var(--bg-panel)] relative z-10"> 
        {activeFileObj ? (
            <MonacoCore 
                height="100%"
                defaultLanguage="javascript"
                theme={theme}
                path={activeFile}
                value={activeFileObj.value}
                onChange={(value) => setCode(value)}
                onMount={handleEditorDidMount}
                options={{
                    fontSize: fontSize,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 24, bottom: 24 },
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontLigatures: true,
                    lineNumbers: "on",
                    renderLineHighlight: "all",
                    cursorBlinking: "smooth",
                    smoothScrolling: true,
                    contextmenu: true,
                }}
            />
        ) : (
             <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">No file selected</div>
        )}
      </div>
    </div>
  );
}