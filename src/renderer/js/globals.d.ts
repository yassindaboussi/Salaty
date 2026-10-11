// Types only (nothing here runs): what the pages get from outside their bundle.
import type { ElectronBridge } from "../../shared/ipc-channels";

declare global {
  interface Window {
    /** set by the preload (contextBridge); pages use it through core/electron-bridge.js */
    electron?: ElectronBridge;
  }
}

export {};
