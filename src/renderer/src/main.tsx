import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import App from './App'
import {
  getSystemThemePreference,
  readStoredThemePreference,
  resolveThemePreference,
  subscribeSystemThemePreference,
  themePreferenceChangedEvent,
  writeStoredThemePreference,
  type ThemePreference
} from './app-theme'
import './styles.css'

function ForgeDeskRoot(): JSX.Element {
  const [themePreference, setThemePreference] = useState(readStoredThemePreference)
  const [systemTheme, setSystemTheme] = useState(getSystemThemePreference)
  const resolvedTheme = resolveThemePreference(themePreference, systemTheme)
  const themeConfig = useMemo(
    () => ({
      algorithm: resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#2563eb',
        borderRadius: 6,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }
    }),
    [resolvedTheme]
  )

  useEffect(() => subscribeSystemThemePreference(setSystemTheme), [])

  useEffect(() => {
    function syncStoredPreference(): void {
      setThemePreference(readStoredThemePreference())
    }

    window.addEventListener('storage', syncStoredPreference)
    window.addEventListener(themePreferenceChangedEvent, syncStoredPreference)

    return () => {
      window.removeEventListener('storage', syncStoredPreference)
      window.removeEventListener(themePreferenceChangedEvent, syncStoredPreference)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  function saveThemePreference(preference: ThemePreference): void {
    setThemePreference(writeStoredThemePreference(preference))
  }

  return (
    <ConfigProvider theme={themeConfig}>
      <App themePreference={themePreference} resolvedTheme={resolvedTheme} onThemePreferenceChange={saveThemePreference} />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ForgeDeskRoot />
  </React.StrictMode>
)
