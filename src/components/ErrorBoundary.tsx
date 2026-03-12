import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let message = "حدث خطأ ما. يرجى المحاولة مرة أخرى.";
      
      try {
        const errData = JSON.parse(this.state.error?.message || "");
        if (errData.error && errData.error.includes("insufficient permissions")) {
          message = "ليس لديك صلاحية للقيام بهذا الإجراء.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4 bg-stone-50 dark:bg-stone-950">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center text-2xl font-bold">!</div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">{message}</h2>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-full font-medium"
          >
            إعادة تحميل التطبيق
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
