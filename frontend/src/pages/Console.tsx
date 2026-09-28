/**
 * @file Console.tsx
 * @description Virtualized server terminal interface with ANSI escape decoding, command auto-completion,
 * history cycling, and log export utilities.
 *
 * Technical Highlights:
 * - Real-time stream rendering via Wails `server:console` IPC event.
 * - `cleanAnsiText`: Handles 24-bit TrueColor sequences emitted by Bedrock Dedicated Server.
 * - Terminal history navigation via ArrowUp / ArrowDown keys.
 * - Dynamic autocomplete matching Bedrock server commands (gamerule, give, op, tp, etc.).
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  Send, 
  Trash2, 
  Copy, 
  Download, 
  Search, 
  ArrowDown, 
  Play, 
  Square,
  RotateCw,
  Sparkles,
  CornerDownLeft,
  ChevronRight,
  Code2
} from 'lucide-react';
import { Api } from '../services/api';
import { Server, ServerStatus } from '../types';
import { useI18n } from '../i18n';
import { getCommandSuggestions, SuggestionResult } from '../utils/commandAutocomplete';

interface ConsoleProps {
  server: Server | null;
  serverStatus: ServerStatus;
  logs: string[];
  onClearLogs: () => void;
  onStartServer: () => void;
  onStopServer: () => void;
  onRestartServer: () => void;
}

/**
 * Strips terminal control codes, standard ANSI escape sequences,
 * and raw 24-bit TrueColor tags from Bedrock Dedicated Server log lines.
 */
function cleanAnsiText(text: string): string {
  if (!text) return '';
  // 1. Strip standard ANSI CSI sequences (\x1b[...m or \u001b[...m)
  let cleaned = text.replace(/[\u001b\x1b]\[[0-9;]*[a-zA-Z]/g, '');
  // 2. Strip raw 24-bit TrueColor sequences without escape char (e.g. [38;2;173;216;230m or [0m)
  cleaned = cleaned.replace(/\[(?:38;2;\d+;\d+;\d+|38;5;\d+|\d+)m/g, '');
  // 3. Strip unprintable control characters
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  return cleaned;
}

export const Console: React.FC<ConsoleProps> = ({
  server,
  serverStatus,
  logs,
  onClearLogs,
  onStartServer,
  onStopServer,
  onRestartServer,
}) => {
  const { t } = useI18n();
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  // Command History & Autocomplete State
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('llsm_cmd_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Compute command suggestions dynamically whenever command changes
  useEffect(() => {
    if (!command.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const matches = getCommandSuggestions(command);
    setSuggestions(matches);
    setSelectedSuggestionIndex(0);
    setShowSuggestions(matches.length > 0);
  }, [command]);

  // Close suggestions if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsBoxRef.current && 
        !suggestionsBoxRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!server || !command.trim()) return;

    const cmdToSend = command.trim();
    setCommand('');
    setShowSuggestions(false);
    setHistoryIndex(-1);

    // Save to history (avoid duplicates at top)
    const newHistory = [cmdToSend, ...commandHistory.filter(c => c !== cmdToSend)].slice(0, 50);
    setCommandHistory(newHistory);
    try {
      sessionStorage.setItem('llsm_cmd_history', JSON.stringify(newHistory));
    } catch {
      // ignore
    }

    try {
      await Api.sendConsoleCommand(server.id, cmdToSend);
    } catch (err: any) {
      alert(t('failedSendCommand', 'Failed to send command: ') + err.message);
    }
  };

  const applySuggestion = (suggestion: SuggestionResult) => {
    setCommand(suggestion.completedValue);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 1. Tab Key: Autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const activeSuggestion = suggestions[selectedSuggestionIndex] || suggestions[0];
        if (activeSuggestion) {
          applySuggestion(activeSuggestion);
        }
      }
      return;
    }

    // 2. Escape: Dismiss suggestions
    if (e.key === 'Escape') {
      if (showSuggestions) {
        e.preventDefault();
        setShowSuggestions(false);
      }
      return;
    }

    // 3. Arrow Down: Navigate suggestions or command history
    if (e.key === 'ArrowDown') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      } else if (commandHistory.length > 0) {
        e.preventDefault();
        if (historyIndex > 0) {
          const nextIdx = historyIndex - 1;
          setHistoryIndex(nextIdx);
          setCommand(commandHistory[nextIdx]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setCommand('');
        }
      }
      return;
    }

    // 4. Arrow Up: Navigate suggestions or command history
    if (e.key === 'ArrowUp') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (commandHistory.length > 0) {
        e.preventDefault();
        const nextIdx = historyIndex + 1;
        if (nextIdx < commandHistory.length) {
          setHistoryIndex(nextIdx);
          setCommand(commandHistory[nextIdx]);
        }
      }
      return;
    }

    // 5. Enter Key: If suggestion is active and suggestions open, select it, otherwise submit
    if (e.key === 'Enter') {
      if (showSuggestions && suggestions.length > 0 && selectedSuggestionIndex >= 0) {
        // If user actively navigated suggestions via Up/Down arrow, Tab or Enter selects it
        // Only if the current command isn't already the complete suggestion
        const active = suggestions[selectedSuggestionIndex];
        if (active && command !== active.completedValue.trim()) {
          // If user pressed Enter on a sub-suggestion, apply it instead of sending prematurely
          e.preventDefault();
          applySuggestion(active);
          return;
        }
      }
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    alert(t('logsCopied', 'Console output copied to clipboard!'));
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `server_console_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(l => 
    !filter || l.toLowerCase().includes(filter.toLowerCase())
  );

  const isRunning = serverStatus === 'ONLINE' || serverStatus === 'STARTING';

  return (
    <div className="h-full flex flex-col p-6 space-y-4 stagger-settle">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-dark-750/80">
        <div className="flex items-center gap-3 animate-slide-left">
          <div className="flex items-center gap-2">
            <TerminalIcon size={18} className="text-brand-500" />
            <h1 className="text-base font-bold text-slate-100 uppercase tracking-tight">
              {t('interactiveConsole', 'Interactive Server Console')}
            </h1>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            serverStatus === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            serverStatus === 'STARTING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
            'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            ● {serverStatus === 'ONLINE' ? t('online', 'ONLINE') : serverStatus === 'STARTING' ? t('starting', 'STARTING') : t('offline', 'OFFLINE')}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 animate-slide-right">
          {!isRunning ? (
            <button
              onClick={onStartServer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95"
            >
              <Play size={13} className="fill-current" /> {t('start', 'Start Server')}
            </button>
          ) : (
            <>
              <button
                onClick={onStopServer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs active:scale-95"
              >
                <Square size={13} className="fill-current" /> {t('stop', 'Stop Server')}
              </button>
              <button
                onClick={onRestartServer}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 font-medium text-xs border border-dark-700 active:scale-95"
              >
                <RotateCw size={13} /> {t('restart', 'Restart')}
              </button>
            </>
          )}

          {/* Search Filter */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('searchLogsPlaceholder', 'Search in logs...')}
              className="bg-dark-900 border border-dark-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 active:scale-95 ${
              autoScroll ? 'bg-brand-500/15 border-brand-500/30 text-brand-400' : 'bg-dark-800 border-dark-700 text-slate-400'
            }`}
            title={t('autoScroll', 'Auto-Scroll')}
          >
            <ArrowDown size={14} />
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 active:scale-95"
            title={t('copyLogs', 'Copy Logs')}
          >
            <Copy size={14} />
          </button>

          <button
            onClick={handleDownloadLogs}
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 active:scale-95"
            title={t('downloadLogs', 'Download Logs')}
          >
            <Download size={14} />
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-rose-400 border border-dark-700 active:scale-95"
            title={t('clearConsole', 'Clear')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Display */}
      <div 
        ref={logContainerRef}
        className="flex-1 bg-dark-950 rounded-xl border border-dark-800 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text shadow-inner"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            {t('noLogsYet', 'No console logs available yet. Start the server to stream output.')}
          </div>
        ) : (
          filteredLogs.map((line, idx) => {
            const cleaned = cleanAnsiText(line);
            let textColor = "text-slate-300";
            if (cleaned.includes("[ERROR]") || cleaned.includes("CRASH") || cleaned.toLowerCase().includes("fail")) {
              textColor = "text-rose-400 font-semibold";
            } else if (cleaned.includes("[WARN]") || cleaned.includes("WARNING")) {
              textColor = "text-amber-400";
            } else if (cleaned.includes("Server started") || cleaned.includes("loaded") || cleaned.includes("ready")) {
              textColor = "text-emerald-400";
            } else if (cleaned.includes("[INFO]")) {
              textColor = "text-slate-300";
            }

            return (
              <div key={idx} className={`leading-relaxed break-all ${textColor}`}>
                {cleaned}
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Command Prompt & Real-time Suggestions */}
      <div className="relative">
        {/* Floating Command Recommendation Popup */}
        {showSuggestions && suggestions.length > 0 && isRunning && (
          <div 
            ref={suggestionsBoxRef}
            className="absolute bottom-full mb-2 left-0 right-0 max-h-72 bg-dark-900/95 backdrop-blur-xl border border-brand-500/30 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Header / Keyboard shortcuts toolbar */}
            <div className="px-3.5 py-2 bg-dark-950/80 border-b border-dark-750 flex items-center justify-between text-[11px] select-none">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <Sparkles size={13} className="text-brand-400" />
                <span>{t('commandSuggestions', 'Command Suggestions')}</span>
                <span className="text-[10px] text-slate-500 font-mono">({suggestions.length})</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1 bg-dark-800 px-1.5 py-0.5 rounded border border-dark-700 text-brand-300">
                  <kbd className="font-sans font-bold text-[10px]">Tab</kbd> {t('complete', 'Complete')}
                </span>
                <span className="flex items-center gap-1 bg-dark-800 px-1.5 py-0.5 rounded border border-dark-700">
                  <kbd className="font-sans font-bold text-[10px]">↑↓</kbd> {t('navigate', 'Navigate')}
                </span>
                <span className="flex items-center gap-1 bg-dark-800 px-1.5 py-0.5 rounded border border-dark-700">
                  <kbd className="font-sans font-bold text-[10px]">Esc</kbd> {t('dismiss', 'Close')}
                </span>
              </div>
            </div>

            {/* Suggestions list */}
            <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-dark-800/50 max-h-56">
              {suggestions.map((sug, idx) => {
                const isSelected = idx === selectedSuggestionIndex;
                const categoryColor = 
                  sug.category === 'gameplay' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
                  sug.category === 'admin' ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' :
                  sug.category === 'world' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                  sug.category === 'levilamina' ? 'bg-purple-500/15 text-purple-400 border-purple-500/20' :
                  'bg-blue-500/15 text-blue-400 border-blue-500/20';

                return (
                  <div
                    key={idx}
                    onClick={() => applySuggestion(sug)}
                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                    className={`px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 text-xs ${
                      isSelected 
                        ? 'bg-brand-500/20 border border-brand-500/40 text-slate-100 shadow-sm' 
                        : 'hover:bg-dark-800/80 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0 text-brand-400">
                        {isSelected ? <CornerDownLeft size={13} className="text-brand-400" /> : <ChevronRight size={13} className="text-slate-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-300 text-xs">{sug.hintText}</span>
                          <span className="font-mono text-[10px] text-slate-400 truncate">{sug.syntax}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{sug.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${categoryColor}`}>
                        {sug.category}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] text-brand-400 font-mono hidden sm:inline-block">
                          Tab ↹
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSendCommand} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 font-mono text-xs font-bold text-brand-500 select-none">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (command.trim() && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              disabled={!isRunning}
              placeholder={isRunning ? t('commandPlaceholder', 'Type a server command (e.g. help, list, say, gamemode)... Press [Tab] to complete') : t('offline', 'Offline')}
              className="w-full bg-dark-900 border border-dark-750 rounded-xl pl-7 pr-4 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 disabled:opacity-50 transition-colors"
            />

            {/* Ghost text overlay for Tab completion */}
            {command && suggestions.length > 0 && suggestions[0].completedValue.toLowerCase().startsWith(command.toLowerCase()) && (
              <div 
                aria-hidden="true"
                className="absolute left-7 top-2.5 pointer-events-none text-xs font-mono text-slate-600 whitespace-pre overflow-hidden"
              >
                <span className="invisible">{command}</span>
                <span className="text-slate-500/70">{suggestions[0].completedValue.slice(command.length)}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!isRunning || !command.trim()}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-slate-950 font-bold text-xs transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
          >
            <Send size={13} /> {t('sendCommand', 'Send')}
          </button>
        </form>
      </div>
    </div>
  );
};
