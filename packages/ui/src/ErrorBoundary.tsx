/**
 * Defence in depth for a render that throws.
 *
 * `edit.ts` is supposed to refuse anything the renderer cannot build, and
 * after the review of commit d8d681b it does. But the whole point of a
 * boundary is that it catches the case nobody thought of: without one, a
 * throw inside the SVG unmounts the entire editor, and the document that
 * caused it is already committed to state, so the user cannot even undo
 * their way out.
 *
 * The recovery offered here is undo, because the bad document is by
 * definition the current one and the previous one was fine.
 */

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { log } from "./log.js";

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Usually the store's `undo`. Shown as the recovery action. */
  readonly onRecover?: () => void;
}

interface State {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error("the editor failed to render", {
      code: (error as { code?: string }).code ?? "RENDER_FAILED",
      message: error.message,
      componentStack: info.componentStack ?? "",
    });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <h3>The editor could not draw this profile.</h3>
        <p>
          The document is in a state the geometry core cannot build. This is
          a defect: an edit should have been refused before it was stored.
        </p>
        <pre>{error.message}</pre>
        {this.props.onRecover !== undefined && (
          <button
            type="button"
            onClick={() => {
              this.props.onRecover?.();
              this.setState({ error: null });
            }}
          >
            Undo the last change
          </button>
        )}
      </div>
    );
  }
}
