import { Component, OnDestroy } from '@angular/core';
import { Event, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ToastService } from './core/ui/toast.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('appToast', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(14px) scale(0.98)' }),
        animate('220ms cubic-bezier(.2,.9,.2,1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(10px)' }))
      ])
    ])
  ]
})
export class AppComponent implements OnDestroy {
  title = 'frontend';
  isNavigating = false;
  private readonly routerSub: Subscription;

  get toast$() {
    return this.toastService.toast$;
  }

  constructor(
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    this.routerSub = this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart) {
        this.isNavigating = true;
        return;
      }
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.isNavigating = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }
}
