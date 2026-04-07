import React from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import './styles/theme.css'

export default function App(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <MainPanel />
      </div>
    </div>
  )
}
