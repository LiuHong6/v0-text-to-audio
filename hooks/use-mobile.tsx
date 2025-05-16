"use client"

import { useEffect, useState } from "react"

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // 初始检查
    checkIsMobile()

    // 添加窗口大小变化监听器
    window.addEventListener("resize", checkIsMobile)

    // 清理函数
    return () => {
      window.removeEventListener("resize", checkIsMobile)
    }
  }, [])

  return isMobile
}
