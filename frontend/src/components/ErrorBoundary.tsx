import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { getStoredTranslation } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-dark-950 flex items-center justify-center p-6 text-slate-100 select-none">
          <div className="bg-dark-900 border border-dark-750 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {getStoredTranslation('interfaceRecovery', 'Interface Recovery')}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {getStoredTranslation(
                  'interfaceRecoveryDesc',
                  'An unexpected view rendering issue occurred. The manager caught it safely so your server files and processes remain unaffected.'
                )}
              </p>
            </div>

            {this.state.error && (
              <div className="bg-dark-950 p-3 rounded-xl border border-dark-800 text-left font-mono text-[11px] text-rose-300 max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 cursor-pointer"
            >
              <RotateCw size={14} /> {getStoredTranslation('reloadInterface', 'Reload Interface')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
