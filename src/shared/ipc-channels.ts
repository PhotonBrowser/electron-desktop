export const IPC_CHANNELS = {
  browser: {
    getSnapshot: "photon:browser:get-snapshot",
    updates: "photon:browser-updates",
  },
  focusOmnibox: "photon:focus-omnibox",
  navigation: {
    back: "photon:navigation:back",
    command: "photon:navigation-command",
    forward: "photon:navigation:forward",
    navigate: "photon:navigation:navigate",
    reload: "photon:navigation:reload",
    stop: "photon:navigation:stop",
  },
  tabs: {
    create: "photon:tabs:create",
    select: "photon:tabs:select",
    close: "photon:tabs:close",
    reorder: "photon:tabs:reorder",
    update: "photon:tabs:update",
  },
  window: {
    minimize: "photon:window:minimize",
    toggleMaximize: "photon:window:toggle-maximize",
    close: "photon:window:close",
    newWindow: "photon:window:new",
  },
  memorySaver: {
    setSettings: "photon:memory-saver:set-settings",
  },
  downloads: {
    changed: "photon:downloads-changed",
    getSnapshot: "photon:downloads:get-snapshot",
    cancel: "photon:downloads:cancel",
    pause: "photon:downloads:pause",
    resume: "photon:downloads:resume",
    open: "photon:downloads:open",
    showInFolder: "photon:downloads:showInFolder",
  },
  performance: {
    metrics: "photon:performance:metrics",
  },
} as const

export const DOWNLOAD_ACTIONS = ["cancel", "pause", "resume", "open", "showInFolder"] as const
