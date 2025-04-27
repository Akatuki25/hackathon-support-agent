'use client';

import { useState, useEffect } from 'react'

export default function MountedWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // まだマウントしてなかったら何も出さない
    return null
  }

  return <>{children}</>
}