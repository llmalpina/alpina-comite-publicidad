# Bugfix Requirements Document

## Introduction

The login page of the Alpina Comité de Publicidad app has two security and usability bugs. First, development-only quick access buttons are exposed in production, allowing anyone to bypass authentication entirely. Second, when a user's temporary Cognito password has expired, the system displays a raw English error message instead of a user-friendly Spanish message with guidance on next steps.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user visits the login page THEN the system displays "Acceso rápido (dev)" buttons (Solicitante, Revisor ARA, Revisor Legal, Administrador) that allow bypassing authentication without credentials

1.2 WHEN a user clicks any quick access button THEN the system calls `loginDev(role)` which sets a fake user session in localStorage and navigates to the dashboard without any Cognito authentication

1.3 WHEN a user with an expired temporary password attempts to log in THEN the system displays the raw Cognito error message in English: "Temporary password has expired and must be reset by an administrator."

### Expected Behavior (Correct)

2.1 WHEN a user visits the login page in production THEN the system SHALL NOT display any quick access buttons or development login shortcuts

2.2 WHEN the login page is rendered THEN the system SHALL NOT provide any mechanism to authenticate without valid Cognito credentials

2.3 WHEN a user with an expired temporary password attempts to log in THEN the system SHALL display a user-friendly error message in Spanish explaining that their contraseña temporal ha expirado and that they must contact an administrator to reset it

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user enters valid Cognito credentials THEN the system SHALL CONTINUE TO authenticate successfully and navigate to the dashboard

3.2 WHEN a user enters invalid credentials THEN the system SHALL CONTINUE TO display an appropriate error message

3.3 WHEN a user with a NEW_PASSWORD_REQUIRED challenge logs in THEN the system SHALL CONTINUE TO show the password change form and complete the flow normally

3.4 WHEN a user's session token expires THEN the system SHALL CONTINUE TO attempt token refresh using the stored refresh token

3.5 WHEN a user receives other Cognito error messages (e.g., "Incorrect username or password") THEN the system SHALL CONTINUE TO display those errors as before
