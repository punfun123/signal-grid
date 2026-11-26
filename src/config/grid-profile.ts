import { hasExplicitDesktopSignals } from './desktop-runtime';

export const IS_GRID_PUBLIC_WEB = !hasExplicitDesktopSignals();
