import { configurationTargets, type ConfigurationContext, type ConfigurationRequest, type ConfigurationTarget } from './configuration-guidance.js'

type Navigator = { context: () => ConfigurationContext; open: (request: ConfigurationRequest) => void }
let navigator: Navigator | null = null
export function registerConfigurationNavigator(value: Navigator): () => void {
  navigator = value
  return () => { if (navigator === value) navigator = null }
}
export function captureConfigurationContext(): ConfigurationContext { return { ...navigator?.context() } }
export function openConfiguration(target: ConfigurationTarget, context = captureConfigurationContext()): void {
  if (!Object.hasOwn(configurationTargets, target)) return
  navigator?.open({ target, ...context })
}
