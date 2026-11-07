"use client"

import React, { useEffect, useRef, useState } from "react"
import { safeReportUrl } from "../lib/preliminary-report"

/** Token identity is independent of the report's unverified security score. */
export function ReportTokenLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const url = safeReportUrl(logoUrl)
  const [failedUrl, setFailedUrl] = useState<string>()
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    // An SSR image can fail before hydration attaches its error handler.
    if (url && imageRef.current?.complete && imageRef.current.naturalWidth === 0) setFailedUrl(url)
  }, [url])
  const showImage = Boolean(url && failedUrl !== url)
  return <span className="r-token-logo" data-logo-state={showImage ? "image" : "fallback"}>
    {showImage ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img ref={imageRef} src={url} alt={`${name} logo`} width={48} height={48} decoding="async"
        referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    ) : (
      <span role="img" aria-label={`${name} logo unavailable`}>
        {Array.from(name.trim())[0]?.toUpperCase() || "?"}
      </span>
    )}
  </span>
}
