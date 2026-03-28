import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-error-page',
  template: `
    <div style="min-height:100vh;display:grid;place-items:center;background:#f8fafc;">
      <div style="max-width:520px;text-align:center;padding:24px;">
        <div style="font-size:64px;line-height:1;">⚠️</div>
        <h1 style="margin:10px 0 6px;color:#0f172a;">Something went wrong</h1>
        <p style="margin:0;color:#64748b;">The page you requested is unavailable or an unexpected error occurred.</p>
        <button
          type="button"
          (click)="goHome()"
          style="margin-top:16px;background:#4f46e5;color:#fff;border:none;padding:10px 16px;border-radius:10px;cursor:pointer;font-weight:600;"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  `
})
export class ErrorPageComponent {
  constructor(private readonly router: Router) {}

  goHome(): void {
    this.router.navigate(['/home']);
  }
}

