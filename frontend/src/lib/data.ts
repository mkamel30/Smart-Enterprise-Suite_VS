
import type { MachineParameter } from './types';

// Note: The static data below is deprecated.
// All data is now read from and written to Firestore.

// This data is managed from the Settings page in the UI.
export const machineParameters: Omit<MachineParameter, 'id'>[] = [];

// Deprecated mock data. No longer used.
export const assets: any[] = [];
export const inventory: any[] = [];
export const technicians: any[] = [];

