import json, re, sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding='utf-8')
lines = source.splitlines()
findings = []

def add(check, severity, title, line, evidence, recommendation):
    findings.append({
        'id': f'CUSTOM-{len(findings)+1:03d}', 'check': check, 'severity': severity,
        'title': title, 'file': 'Contract.sol', 'line': line,
        'trace': [f'Contract.sol:{line}'], 'proof_of_concept': evidence,
        'reproducible': True, 'recommendation': recommendation,
    })

patterns = [
    ('tx.origin', 'HIGH', 'Authentication depends on tx.origin', 'Use msg.sender and explicit authorization.'),
    ('delegatecall(', 'HIGH', 'Delegatecall requires manual target and storage review', 'Constrain the target and document storage compatibility.'),
    ('selfdestruct(', 'HIGH', 'Contract contains selfdestruct', 'Remove it or protect it behind a timelock and multisig.'),
    ('block.timestamp', 'MEDIUM', 'Block timestamp influences contract logic', 'Use bounded timestamp assumptions and test miner manipulation.'),
]
for needle, severity, title, recommendation in patterns:
    for i, line in enumerate(lines, 1):
        if needle in line:
            add(needle, severity, title, i, f'Observed source line: {line.strip()}', recommendation)

# Regression-style invariants that are deterministic and can be rerun from the artifact.
checks = {
    'balanced_braces': source.count('{') == source.count('}'),
    'no_unchecked_tx_origin': 'tx.origin' not in source,
    'pragma_present': bool(re.search(r'pragma\s+solidity', source)),
}
print(json.dumps({'success': True, 'tool': 'solay39-custom-regression', 'version': '1.0.0', 'checks': checks, 'findings': findings}, indent=2))
