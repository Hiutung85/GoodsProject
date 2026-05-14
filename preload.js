const { contextBridge, ipcRenderer } = require('electron')

// 极其稳妥地在隔离层之间搭建一座透明桥梁，把大管家的功能直接挂在 window.electron 上
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
  }
})