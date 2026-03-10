/**
 * IPFS Pinning via Pinata
 * Pins audit reports to IPFS for permanent, decentralized storage
 */

export interface IPFSPinResult {
  success: boolean
  ipfsCid: string | null
  ipfsUrl: string | null
  gatewayUrl: string | null
  timestamp: string
  error?: string
}

export async function pinReportToIPFS(
  reportData: object,
  auditId: string
): Promise<IPFSPinResult> {
  const jwt = process.env.PINATA_JWT

  if (!jwt) {
    return {
      success: false,
      ipfsCid: null,
      ipfsUrl: null,
      gatewayUrl: null,
      timestamp: new Date().toISOString(),
      error: "PINATA_JWT not configured",
    }
  }

  try {
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          pinataContent: reportData,
          pinataMetadata: {
            name: `solay39-audit-${auditId}`,
            keyvalues: {
              auditor: "Solay39",
              auditId: auditId,
              platform: "solay39.eu",
              timestamp: new Date().toISOString(),
            },
          },
          pinataOptions: {
            cidVersion: 1,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Pinata API error:", response.status, errorText)
      return {
        success: false,
        ipfsCid: null,
        ipfsUrl: null,
        gatewayUrl: null,
        timestamp: new Date().toISOString(),
        error: `Pinata API error: ${response.status}`,
      }
    }

    const data = await response.json()
    const cid = data.IpfsHash

    // Use dedicated Pinata gateway if configured, otherwise public gateway
    // Ensure the gateway URL always has the https:// protocol prefix
    const rawGateway = process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud"
    const dedicatedGateway = rawGateway.startsWith("http") ? rawGateway : `https://${rawGateway}`
    
    return {
      success: true,
      ipfsCid: cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: `${dedicatedGateway}/ipfs/${cid}`,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("Pinata upload failed:", error)
    return {
      success: false,
      ipfsCid: null,
      ipfsUrl: null,
      gatewayUrl: null,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}