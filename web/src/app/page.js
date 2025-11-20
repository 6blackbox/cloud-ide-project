"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import CodeEditor from "./components/CodeEditor";
import FileExplorer from "./components/FileExplorer";
import CommandPalette from "./components/CommandPalette";
import ResizeHandle from "./components/ResizeHandle";
import BrowserPreview from "./components/BrowserPreview"; 
import { io } from "socket.io-client";
import { Play, Sun, Moon, Code2, PanelLeft, Command as CmdIcon, Wand2, TerminalSquare, Globe, Files, Search, GitGraph, Settings, LayoutTemplate, Wifi, CheckCircle2, AlertCircle } from "lucide-react"; 
import { Panel, PanelGroup } from "react-resizable-panels";
import * as prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserEstree from "prettier/plugins/estree";

const Terminal = dynamic(() => import("./components/Terminal"), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-gray-500 font-mono text-sm animate-pulse">Initializing Terminal...</div>,
});

const INITIAL_FILES = {
  "index.js": { name: "index.js", language: "javascript", value: `const http = require('http');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/plain' });\n  res.end('Hello from your Cloud Server!');\n});\n\n// IMPORTANT: Use process.env.PORT\nconst PORT = process.env.PORT || 3000;\n\nserver.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});` }
};

export default function Home() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [activeFile, setActiveFile] = useState("index.js");
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [settings, setSettings] = useState({ theme: 'default', fontSize: 14 });
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  
  // Layout State
  const [activeTab, setActiveTab] = useState("terminal"); 
  const [previewUrl, setPreviewUrl] = useState(null);
  const [runId, setRunId] = useState(0); 
  const [activeActivity, setActiveActivity] = useState("explorer"); // 'explorer', 'search', 'git'

  const sidebarRef = useRef(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false);

  useEffect(() => { document.documentElement.setAttribute('data-theme', settings.theme); }, [settings.theme]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem("cloud-ide-files");
        if (saved) setFiles(JSON.parse(saved));
    }
    const newSocket = io("http://localhost:4000");
    
    newSocket.on("connect", () => setIsConnected(true));
    newSocket.on("disconnect", () => setIsConnected(false));
    
    newSocket.on("system-info", (data) => {
        setPreviewUrl(`http://localhost:4000/preview/${newSocket.id}`);
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => { localStorage.setItem("cloud-ide-files", JSON.stringify(files)); }, [files]);

  const runCode = () => {
      if (!socket) return;
      setActiveTab('terminal'); 
      socket.emit("run-code", files);
      setRunId(prev => prev + 1); 
      
      if (files[activeFile].value.includes('listen') || files[activeFile].value.includes('http')) {
          setTimeout(() => setActiveTab('preview'), 1500);
      }
  };
  
  const toggleTheme = () => setSettings(prev => ({ ...prev, theme: prev.theme === 'light' ? 'default' : 'light' }));
  const handleCodeChange = (val) => setFiles(prev => ({ ...prev, [activeFile]: { ...prev[activeFile], value: val } }));
  
  const formatCode = async () => {
    try {
        const currentCode = files[activeFile].value;
        if (!activeFile.endsWith('.js') && !activeFile.endsWith('.json')) return;
        const formatted = await prettier.format(currentCode, {
            parser: activeFile.endsWith('.json') ? "json" : "babel",
            plugins: [parserBabel, parserEstree],
            semi: true, singleQuote: true, trailingComma: 'es5',
        });
        handleCodeChange(formatted);
    } catch (err) { console.error("Formatting failed:", err); }
  };

  const createNewFile = () => {
    const name = `new_file_${Object.keys(files).length}.js`;
    if(!files[name]) { setFiles(prev => ({ ...prev, [name]: { name, value: "// New File" } })); setActiveFile(name); }
  };
  
  const handleAddFile = (name) => { if(!files[name]) { setFiles(prev => ({ ...prev, [name]: { name, value: "// New File" } })); setActiveFile(name); }};
  const handleDeleteFile = (name) => { if(name!=='index.js') { const n={...files}; delete n[name]; setFiles(n); if(activeFile===name) setActiveFile('index.js'); }};
  
  const toggleSidebar = () => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
        setIsLayoutTransitioning(true);
        const isCollapsed = sidebar.getCollapsed();
        if (isCollapsed) sidebar.expand(); else sidebar.collapse();
        setTimeout(() => setIsLayoutTransitioning(false), 300);
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col font-sans overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] transition-colors duration-500">
      
      <CommandPalette open={isCmdOpen} setOpen={setIsCmdOpen} runCode={runCode} formatCode={formatCode} clearTerminal={() => {}} toggleTheme={toggleTheme} createNewFile={createNewFile} files={files} setActiveFile={setActiveFile} />

      {/* --- TOP HEADER --- */}
      <header className="h-12 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-4 z-20 select-none">
        <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5 group cursor-pointer">
                <div className="relative w-7 h-7 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
                    <Code2 className="w-4 h-4 text-white" />
                    <div className="absolute inset-0 rounded-lg ring-1 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                </div>
                <h1 className="font-bold text-sm tracking-wide text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                    Cloud IDE <span className="opacity-50 font-normal">Project</span>
                </h1>
            </div>
            
            {/* Menu Trigger */}
            <button onClick={() => setIsCmdOpen(true)} className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent)]/50 transition-all group">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-main)]">Search...</span>
                <kbd className="ml-2 bg-[var(--border-color)] px-1.5 py-0.5 rounded text-[9px] text-[var(--text-muted)] font-mono">⌘K</kbd>
            </button>
        </div>

        <div className="flex items-center gap-3">
            <button onClick={formatCode} className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all" title="Format Code">
                <Wand2 className="w-4 h-4" />
            </button>

            <button onClick={toggleTheme} className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-color)] transition-all">
                {settings.theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <button onClick={runCode} className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white text-xs font-bold tracking-wide shadow-lg shadow-[var(--accent)]/20 transition-all active:scale-95">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>RUN</span>
            </button>
        </div>
      </header>

      {/* --- MAIN LAYOUT --- */}
      <div className="flex-1 flex min-h-0">
        
        {/* 1. Activity Bar (Leftmost Strip) */}
        <div className="w-12 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col items-center py-4 gap-4 z-10">
            <button onClick={() => { setActiveActivity('explorer'); if(isSidebarCollapsed) toggleSidebar(); }} className={`p-2.5 rounded-lg transition-all ${activeActivity === 'explorer' ? "text-[var(--text-main)] bg-[var(--border-color)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>
                <Files className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveActivity('search')} className={`p-2.5 rounded-lg transition-all ${activeActivity === 'search' ? "text-[var(--text-main)] bg-[var(--border-color)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>
                <Search className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveActivity('git')} className={`p-2.5 rounded-lg transition-all ${activeActivity === 'git' ? "text-[var(--text-main)] bg-[var(--border-color)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>
                <GitGraph className="w-5 h-5" />
            </button>
            <div className="flex-1"></div>
            <button className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">
                <Settings className="w-5 h-5" />
            </button>
        </div>

        {/* 2. Resizable Workspace */}
        <PanelGroup direction="horizontal" autoSaveId="layout-main" className="flex-1">
            
            {/* Sidebar Panel */}
            <Panel 
                ref={sidebarRef}
                defaultSize={20} minSize={12} maxSize={30} collapsible={true} collapsedSize={0}
                onCollapse={() => setIsSidebarCollapsed(true)}
                onExpand={() => setIsSidebarCollapsed(false)}
                className={`flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-app)] ${isLayoutTransitioning ? "transition-all duration-300" : ""}`}
            >
                <div className="h-full overflow-hidden">
                    <FileExplorer files={files} activeFile={activeFile} onSelectFile={setActiveFile} onAddFile={handleAddFile} onDeleteFile={handleDeleteFile} />
                </div>
            </Panel>

            {!isSidebarCollapsed && <ResizeHandle />}

            {/* Editor & Terminal Group */}
            <Panel>
                <PanelGroup direction="horizontal" autoSaveId="layout-inner">
                    <Panel defaultSize={60} minSize={30} className="flex flex-col relative">
                        <CodeEditor 
                            files={files}
                            activeFile={activeFile} 
                            setActiveFile={setActiveFile}
                            onCloseFile={handleDeleteFile} 
                            setCode={handleCodeChange} 
                            onSave={formatCode} 
                            fontSize={settings.fontSize} 
                            theme={settings.theme === 'light' ? 'light' : 'vs-dark'} 
                        />
                    </Panel>
                    
                    <ResizeHandle />
                    
                    <Panel defaultSize={40} minSize={20} className="flex flex-col bg-[var(--bg-panel)]">
                        {/* Right Panel Header (Tabs) */}
                        <div className="h-9 border-b border-[var(--border-color)] flex items-center px-2 gap-1 bg-[var(--bg-app)]">
                            <button 
                                onClick={() => setActiveTab('terminal')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'terminal' ? "bg-[var(--border-color)] text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
                            >
                                <TerminalSquare className="w-3.5 h-3.5" /> Terminal
                            </button>
                            <button 
                                onClick={() => setActiveTab('preview')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'preview' ? "bg-[var(--border-color)] text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
                            >
                                <Globe className="w-3.5 h-3.5" /> Preview
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 relative">
                            <div className={`h-full w-full absolute inset-0 ${activeTab === 'terminal' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}>
                                <Terminal socket={socket} themeMode={settings.theme === 'light' ? 'light' : 'dark'} />
                            </div>
                            <div className={`h-full w-full absolute inset-0 ${activeTab === 'preview' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}>
                                <BrowserPreview previewUrl={previewUrl} key={runId} />
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </Panel>
        </PanelGroup>
      </div>

      {/* --- STATUS BAR (Footer) --- */}
      <footer className="h-6 border-t border-[var(--border-color)] bg-[var(--accent)]/5 flex items-center justify-between px-3 text-[10px] text-[var(--text-muted)] select-none">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors cursor-pointer">
                <Wifi className={`w-3 h-3 ${isConnected ? "text-green-500" : "text-red-500"}`} />
                <span>{isConnected ? "Connected to Remote" : "Reconnecting..."}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <LayoutTemplate className="w-3 h-3" />
                <span>master*</span>
            </div>
            <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                <span>0 Errors</span>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <span>Ln 12, Col 44</span>
            <span>UTF-8</span>
            <div className="flex items-center gap-1.5 text-[var(--accent)] font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Prettier</span>
            </div>
            <span className="uppercase">JavaScript</span>
        </div>
      </footer>
    </main>
  );
}