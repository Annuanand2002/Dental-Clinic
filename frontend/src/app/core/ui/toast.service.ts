import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastKind = 'success' | 'error';

export interface ToastPayload {
  message: string;
  type: ToastKind;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toast = new BehaviorSubject<ToastPayload | null>(null);
  readonly toast$ = this._toast.asObservable();

  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  success(message: string): void {
    this.show({ message, type: 'success' });
  }

  error(message: string): void {
    this.show({ message, type: 'error' });
  }

  private show(payload: ToastPayload): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this._toast.next(payload);
    this.clearTimer = setTimeout(() => {
      this._toast.next(null);
      this.clearTimer = null;
    }, 3400);
  }
}
