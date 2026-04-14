import { Solicitud, User, AreaBudget } from '../types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Carlos Rodríguez',  email: 'carlos.rodriguez@alpina.com', role: 'SOLICITANTE',   area: 'Mercadeo - Bon Yurt',  avatar: 'https://i.pravatar.cc/150?u=u1' },
  { id: 'u2', name: 'Ana María López',   email: 'ana.lopez@alpina.com',        role: 'REVISOR_ARA',   area: 'Asuntos Regulatorios', avatar: 'https://i.pravatar.cc/150?u=u2' },
  { id: 'u3', name: 'Juan Felipe Gómez', email: 'juan.gomez@alpina.com',       role: 'REVISOR_LEGAL', area: 'Legal',                avatar: 'https://i.pravatar.cc/150?u=u3' },
  { id: 'u4', name: 'Marta Lucía Casas', email: 'marta.casas@alpina.com',      role: 'ADMIN',         area: 'Coordinación Comité',  avatar: 'https://i.pravatar.cc/150?u=u4' },
];

export const MOCK_BUDGETS: AreaBudget[] = [
  { area: 'Mercadeo - Bon Yurt', totalHours: 20, consumedHours: 0 },
  { area: 'Mercadeo - Alpina',   totalHours: 20, consumedHours: 0 },
  { area: 'Trade Marketing',     totalHours: 20, consumedHours: 0 },
  { area: 'Retail',              totalHours: 20, consumedHours: 0 },
  { area: 'Food Service',        totalHours: 20, consumedHours: 0 },
];

// Array mutable — las nuevas solicitudes se agregan aquí en modo dev
export const MOCK_SOLICITUDES: Solicitud[] = [];
