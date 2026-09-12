const PREFIX = "[Photon]"

export const logger = {
  debug: (...messages: unknown[]): void => console.debug(PREFIX, ...messages),
  warn: (...messages: unknown[]): void => console.warn(PREFIX, ...messages),
  error: (...messages: unknown[]): void => console.error(PREFIX, ...messages),
}
