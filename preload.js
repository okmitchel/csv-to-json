const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openCSV: () => ipcRenderer.invoke('open-csv-dialog'),
  saveJSON: (jsonString, suggestedName) =>
    ipcRenderer.invoke('save-json-dialog', jsonString, suggestedName)
});
