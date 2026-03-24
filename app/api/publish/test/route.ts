// Test endpoint to verify GitHub configuration
const GITHUB_REPO = "solay39/Solay39-audit"
const GITHUB_API = "https://api.github.com"

export async function GET() {
  const token = process.env.GITHUB_TOKEN
  
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tokenConfigured: !!token,
    tokenPreview: token ? `${token.slice(0, 8)}...${token.slice(-4)}` : null,
    repo: GITHUB_REPO,
  }

  if (!token) {
    return Response.json({
      ...result,
      error: "GITHUB_TOKEN not configured",
    })
  }

  // Test 1: Check if repo exists
  try {
    const repoRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
    
    const repoData = await repoRes.json()
    result.repoExists = repoRes.ok
    result.repoStatus = repoRes.status
    
    if (!repoRes.ok) {
      result.repoError = repoData.message || "Unknown error"
    } else {
      result.repoPrivate = repoData.private
      result.defaultBranch = repoData.default_branch
    }
  } catch (err) {
    result.repoError = err instanceof Error ? err.message : String(err)
  }

  // Test 2: Check token permissions
  try {
    const userRes = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
    
    const userData = await userRes.json()
    result.tokenValid = userRes.ok
    result.tokenUser = userData.login
    result.tokenScopes = userRes.headers.get("x-oauth-scopes")
  } catch (err) {
    result.tokenError = err instanceof Error ? err.message : String(err)
  }

  // Test 3: Check if audits folder exists
  try {
    const folderRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/audits`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
    
    result.auditsFolderExists = folderRes.ok
    if (!folderRes.ok && folderRes.status === 404) {
      result.auditsFolderNote = "Folder will be created on first upload"
    }
  } catch {
    result.auditsFolderExists = false
  }

  return Response.json(result)
}
