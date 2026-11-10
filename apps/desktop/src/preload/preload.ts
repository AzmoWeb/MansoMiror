import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC, type MansoApi } from "../shared/api.ts";

const invoke = (ch: string, ...args: unknown[]) => ipcRenderer.invoke(ch, ...args);

function listen<T>(ch: string, cb: (v: T) => void) {
  const h = (_e: IpcRendererEvent, v: T) => cb(v);
  ipcRenderer.on(ch, h);
  return () => {
    ipcRenderer.removeListener(ch, h);
  };
}

const api: MansoApi = {
  info: () => invoke(IPC.info),
  getSettings: () => invoke(IPC.getSettings),
  setSettings: (p) => invoke(IPC.setSettings, p),
  history: () => invoke(IPC.history),
  clearHistory: () => invoke(IPC.clearHistory),
  listSources: () => invoke(IPC.listSources),
  selectSource: (id) => invoke(IPC.selectSource, id),
  hostStart: () => invoke(IPC.hostStart),
  hostNewPin: () => invoke(IPC.hostNewPin),
  hostStop: () => invoke(IPC.hostStop),
  hostAccept: (id, sdp) => invoke(IPC.hostAccept, id, sdp),
  hostRefuse: (id) => invoke(IPC.hostRefuse, id),
  hostEndSession: () => invoke(IPC.hostEndSession),
  onHostEvent: (cb) => listen(IPC.hostEvent, cb),
  discoverStart: () => invoke(IPC.discoverStart),
  discoverStop: () => invoke(IPC.discoverStop),
  onDevices: (cb) => listen(IPC.devices, cb),
  viewerConnect: (a) => invoke(IPC.viewerConnect, a),
  viewerSetRecording: (on) => invoke(IPC.viewerSetRecording, on),
  viewerDisconnect: () => invoke(IPC.viewerDisconnect),
  onViewerEvent: (cb) => listen(IPC.viewerEvent, cb),
  killAll: () => invoke(IPC.killAll),
  onKilled: (cb) => listen(IPC.killed, cb),
  saveFile: (kind, data) => invoke(IPC.saveFile, kind, data),
  airplayState: (recheck) => invoke(IPC.airplayState, recheck === true),
  airplayStart: () => invoke(IPC.airplayStart),
  airplayStop: () => invoke(IPC.airplayStop),
  onAirPlay: (cb) => listen(IPC.airplayEvent, cb),
  onAirPlayVideo: (cb) => listen(IPC.airplayVideo, cb),
  androidStatus: () => invoke(IPC.androidStatus),
  androidDevices: () => invoke(IPC.androidDevices),
  androidPair: (hp, code) => invoke(IPC.androidPair, hp, code),
  androidConnect: (hp) => invoke(IPC.androidConnect, hp),
  androidStart: (serial, control) => invoke(IPC.androidStart, serial, control),
  androidInput: (serial, input) => invoke(IPC.androidInput, serial, input),
  androidStop: (serial) => invoke(IPC.androidStop, serial),
  onAndroidEvent: (cb) => listen(IPC.androidEvent, cb),
  onAndroidVideo: (cb) => listen(IPC.androidVideo, cb),
  updateState: () => invoke(IPC.updateState),
  updateCheck: () => invoke(IPC.updateCheck),
  updateInstall: () => invoke(IPC.updateInstall),
  onUpdate: (cb) => listen(IPC.updateEvent, cb),
};

contextBridge.exposeInMainWorld("mm", api);
