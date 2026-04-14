# Comité de Publicidad Alpina

Plataforma web para gestionar el flujo de revisión y aprobación de piezas publicitarias de Alpina. Digitaliza el proceso que antes se hacía por email, WhatsApp y reuniones, centralizando todo en una sola herramienta.

## ¿Qué hace?

El Comité de Publicidad revisa ~180 piezas publicitarias al mes. Cada pieza pasa por revisión de dos equipos (ARA & Nutrición y Legal) antes de poder ser publicada. Esta plataforma automatiza ese flujo:

1. **Solicitante** sube una pieza publicitaria (PDF)
2. **Revisores ARA y Legal** revisan la pieza, dejan comentarios y anotaciones directamente sobre el PDF
3. Cada equipo marca la pieza como "Sin comentarios", "Con comentarios" o "Rechazada"
4. Si queda "Con comentarios", el solicitante sube la versión final corregida
5. El solicitante publica la pieza cuando está lista

## Funcionalidades principales

### Para solicitantes
- Crear solicitudes con PDF adjunto (subida directa a S3)
- Ver el estado de sus piezas en tiempo real
- Recibir notificaciones por correo cuando el comité revisa
- Subir versiones corregidas con historial de cambios
- Marcar piezas como publicadas

### Para revisores (ARA & Legal)
- Cola de revisión con piezas pendientes
- Visor de PDF integrado con herramientas de anotación:
  - Pin, Rectángulo, Subrayar, Tachar, Flecha, Dibujo libre
  - Selector de colores
  - Zoom con Ctrl+scroll y herramienta de mano para navegar
- Comentarios tipo blog por pieza
- Aprobación independiente por equipo (ARA y Legal)

### Para administradores
- Dashboard con métricas, gráficas por marca, tendencias y filtros por fecha
- Gestión de usuarios y roles con permisos granulares
- Configuración de correos (SMTP, reglas de notificación, destinatarios)
- Restricción de horario configurable (ej: no subir piezas después de las 5 PM)
- Gestión de maestros (marcas, canales, áreas, tipos de contenido)
- Recordatorio semanal automático de piezas pendientes

### Correos automáticos
- Nueva solicitud creada → revisores
- Revisión parcial (un equipo revisó) → solicitante
- Resultado final (sin comentarios / con comentarios / rechazada) → solicitante
- Nuevo comentario del comité → solicitante
- Recordatorio semanal de piezas pendientes → solicitantes
- Bienvenida a nuevos usuarios

## Stack técnico

### Frontend
- **React 19** + TypeScript
- **Vite** como bundler
- **Tailwind CSS** para estilos
- **Recharts** para gráficas del dashboard
- **react-pdf** para el visor de PDF
- **react-dropzone** para subida de archivos

### Backend (AWS)
- **API Gateway** (HTTP API) — rutas REST
- **Lambda** (Node.js 20) — lógica de negocio
  - `lambda-solicitudes` — CRUD de solicitudes
  - `lambda-comentarios` — comentarios y anotaciones PDF
  - `lambda-versiones` — historial de versiones de documentos
  - `lambda-maestros` — parámetros configurables
  - `lambda-usuarios` — gestión de usuarios
  - `lambda-presign` — URLs pre-firmadas para S3
  - `lambda-ses` — envío de correos via SMTP (Office 365)
  - `lambda-bedrock` — análisis IA de piezas (pendiente)
  - `lambda-recordatorio` — recordatorio semanal automático
- **DynamoDB** — base de datos
- **S3** — almacenamiento de PDFs y assets
- **Cognito** — autenticación
- **EventBridge** — cron para recordatorio semanal

### Hosting
- **AWS Amplify** — frontend
- Dominio: `datahub-alpina.com/comite-publicidad`

## Estructura del proyecto

```
alpina-comité-de-publicidad/
├── src/
│   ├── app/                    # Páginas
│   │   ├── dashboard/          # Dashboard con métricas
│   │   ├── login/              # Login (Cognito + dev)
│   │   ├── solicitudes/        # Lista, detalle, nueva solicitud
│   │   ├── revision/           # Cola de revisión, detalle con PDF
│   │   └── admin/              # Configuración, maestros, usuarios, reportes
│   ├── components/
│   │   ├── ui/                 # Componentes reutilizables (Button, Card, PdfViewer...)
│   │   └── layout/             # Sidebar, Header
│   ├── contexts/               # AuthContext, ConfigContext, MaestrosContext...
│   ├── hooks/                  # useSolicitudes
│   ├── lib/                    # API client, utilidades, constantes
│   └── types/                  # TypeScript types
├── public/                     # Assets estáticos
├── amplify.yml                 # Configuración de build para Amplify
└── vite.config.ts
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y configurar:

```env
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_xxx
VITE_COGNITO_CLIENT_ID=xxx
VITE_COGNITO_DOMAIN=xxx.auth.us-east-1.amazoncognito.com
VITE_AWS_REGION=us-east-1
VITE_SES_LAMBDA_URL=https://xxx.execute-api.us-east-1.amazonaws.com/prod/email
VITE_PRESIGN_URL=https://xxx.execute-api.us-east-1.amazonaws.com/prod/presign
```

## Desarrollo local

```bash
npm install
npm run dev
```

La app incluye usuarios de desarrollo para pruebas rápidas sin Cognito (accesibles desde la pantalla de login).

## Deploy

### Frontend
Se despliega automáticamente con Amplify al hacer push a `main`.

### Backend
```powershell
powershell -ExecutionPolicy Bypass -File infra/deploy.ps1
```

## Impacto estimado

Con 180 piezas/mes, la plataforma reduce el tiempo dedicado al proceso de ~35 horas/semana a ~15 horas/semana (reducción del 55-60%), liberando ~270 horas/mes que antes se dedicaban a logística y coordinación manual.
