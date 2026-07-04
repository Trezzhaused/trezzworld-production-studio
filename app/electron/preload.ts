import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  platform: process.platform,
  getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: unknown, url: string) => callback(url);
    ipcRenderer.on('deep-link-url', listener);
    return () => ipcRenderer.removeListener('deep-link-url', listener);
  },
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('nextgen', {
  send: electronAPI.send,
  on: electronAPI.on,
  invoke: electronAPI.invoke,
  getRuntimeInfo: electronAPI.getRuntimeInfo,
});

