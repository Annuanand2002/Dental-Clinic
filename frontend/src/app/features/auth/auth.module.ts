import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './presentation/components/login/login.component';
import { AUTH_REPOSITORY } from './application/tokens/auth-repository.token';
import { AuthRepositoryImpl } from './data/repositories/auth.repository.impl';
import { LoginUseCase } from './domain/use-cases/login.usecase';
import { AuthFacade } from './application/auth.facade';

@NgModule({
  declarations: [LoginComponent],
  imports: [CommonModule, ReactiveFormsModule, AuthRoutingModule],
  providers: [
    { provide: AUTH_REPOSITORY, useClass: AuthRepositoryImpl },
    LoginUseCase,
    AuthFacade
  ]
})
export class AuthModule {}

