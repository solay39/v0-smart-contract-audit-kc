"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, RefreshCw, ExternalLink, CheckCircle2, XCircle } from "lucide-react"

interface BlobAudit {
  pathname: string
  url: string
  uploadedAt: string
  size: number
  status?: "ok" | "error" | "checking"
}

export default function AdminAuditsPage() {
  const [audits, setAudits] = useState<BlobAudit[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchAudits = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/publish?list=true")
      const data = await res.json()
      setAudits(data.audits || [])
    } catch (err) {
      console.error("Failed to fetch audits:", err)
    }
    setLoading(false)
  }

  const checkAuditPage = async (audit: BlobAudit) => {
    const id = audit.pathname.replace("audits/", "").replace(".json", "")
    try {
      const res = await fetch(`/audit/${id}`, { method: "HEAD" })
      return res.ok ? "ok" : "error"
    } catch {
      return "error"
    }
  }

  const checkAllPages = async () => {
    setLoading(true)
    const updated = await Promise.all(
      audits.map(async (audit) => ({
        ...audit,
        status: await checkAuditPage(audit),
      }))
    )
    setAudits(updated)
    setLoading(false)
  }

  const deleteAudit = async (audit: BlobAudit) => {
    if (!confirm(`Delete ${audit.pathname}?`)) return
    setDeleting(audit.url)
    try {
      await fetch("/api/publish", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audit.url }),
      })
      setAudits((prev) => prev.filter((a) => a.url !== audit.url))
    } catch (err) {
      console.error("Failed to delete:", err)
    }
    setDeleting(null)
  }

  const deleteAllErrors = async () => {
    const errorAudits = audits.filter((a) => a.status === "error")
    if (!confirm(`Delete ${errorAudits.length} audits with errors?`)) return
    
    for (const audit of errorAudits) {
      await deleteAudit(audit)
    }
  }

  useEffect(() => {
    fetchAudits()
  }, [])

  const getId = (pathname: string) => pathname.replace("audits/", "").replace(".json", "")

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Audit Management</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAudits} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={checkAllPages} disabled={loading}>
                Check Pages
              </Button>
              {audits.some((a) => a.status === "error") && (
                <Button variant="destructive" size="sm" onClick={deleteAllErrors}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Errors ({audits.filter((a) => a.status === "error").length})
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {audits.length} audit(s) in Vercel Blob storage
          </p>
          
          <div className="space-y-2">
            {audits.map((audit) => (
              <div
                key={audit.url}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {audit.status === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {audit.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                  {!audit.status && <div className="h-4 w-4" />}
                  
                  <div>
                    <p className="font-mono text-sm">{getId(audit.pathname)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(audit.uploadedAt).toLocaleString()} · {(audit.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={`/audit/${getId(audit.pathname)}`} target="_blank" rel="noopener">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAudit(audit)}
                    disabled={deleting === audit.url}
                  >
                    <Trash2 className={`h-4 w-4 text-red-500 ${deleting === audit.url ? "animate-pulse" : ""}`} />
                  </Button>
                </div>
              </div>
            ))}
            
            {audits.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">
                No audits found in Blob storage
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
