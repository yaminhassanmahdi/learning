'use client'

import { Provider } from 'jotai'
import { AuthProvider } from '../contexts/AuthContext'

export const Providers = ({ children }) => {
  return (
    <Provider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </Provider>
  )
}