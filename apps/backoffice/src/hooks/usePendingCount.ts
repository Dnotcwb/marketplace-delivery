'use client'

import { subscribeToPendingCount } from '@marketplace/shared-services'
import { useEffect, useState } from 'react'

export function usePendingCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    return subscribeToPendingCount(setCount)
  }, [])
  return count
}
