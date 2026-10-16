import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { App, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { PrototypeApp } from './prototype-app'
import './prototype.css'

function PrototypeRoot(): JSX.Element {
  // Deliberately in memory: previewing themes must not alter the real app preference.
  const [dark, setDark] = useState(false)
  return <ConfigProvider locale={zhCN} theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: {
    colorPrimary: '#357363', borderRadius: 6, colorBgBase: dark ? '#121a1b' : '#ffffff',
    colorTextBase: dark ? '#e4ece8' : '#22322e', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  } }}><App><PrototypeApp dark={dark} onToggleTheme={() => setDark(value => !value)} /></App></ConfigProvider>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<PrototypeRoot />)
