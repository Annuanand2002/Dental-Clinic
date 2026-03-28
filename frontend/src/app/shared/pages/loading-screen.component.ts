import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-screen',
  template: `
    <div style="min-height:100vh;display:grid;place-items:center;background:#f8fafc;">
      <div style="text-align:center;">
        <div style="width:48px;height:48px;border:4px solid #cbd5e1;border-top-color:#4f46e5;border-radius:999px;animation:spin 1s linear infinite;margin:0 auto 12px;"></div>
        <h2 style="margin:0;color:#0f172a;">Loading...</h2>
        <p style="margin:6px 0 0;color:#64748b;">Please wait while we prepare your screen.</p>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
  ]
})
export class LoadingScreenComponent {}

