// Estrazione di FATTI deterministici dall'AST di solc.
// Un fatto non è un giudizio: è qualcosa che chiunque può rifare e ottenere lo stesso risultato.
// Questo layer avrebbe evitato i falsi positivi C-01/H-01 (delegatecall in libreria mai chiamata,
// contratto non upgradeable) e trovato i problemi "dichiarato ma non applicato" (MAX_SUPPLY).

export function walk(node, cb) {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, cb);
    return;
  }
  if (node && typeof node === "object") {
    if (node.nodeType) cb(node);
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v === "object") walk(v, cb);
    }
  }
}


// Valuta espressioni costanti semplici (letterali, + - * / **, costanti referenziate) -> BigInt | null
export function makeEvalConst(byId) {
  const ev = (n, depth = 0) => {
    if (!n || depth > 20) return null;
    if (n.nodeType === "Literal" && n.kind === "number") {
      const v = String(n.value).replace(/_/g, "");
      try { return /e/i.test(v) ? BigInt(Number(v)) : BigInt(v); } catch { return null; }
    }
    if (n.nodeType === "TupleExpression" && n.components?.length === 1) return ev(n.components[0], depth + 1);
    if (n.nodeType === "Identifier") {
      const d = byId.get(n.referencedDeclaration);
      return d?.nodeType === "VariableDeclaration" && d.constant ? ev(d.value, depth + 1) : null;
    }
    if (n.nodeType === "BinaryOperation") {
      const a = ev(n.leftExpression, depth + 1), b = ev(n.rightExpression, depth + 1);
      if (a === null || b === null) return null;
      switch (n.operator) {
        case "+": return a + b; case "-": return a - b; case "*": return a * b;
        case "/": return b === 0n ? null : a / b; case "**": return a ** b;
      }
    }
    return null;
  };
  return ev;
}

export function extractFacts(compiled, targetName) {
  const { asts, sourcesById, primaryId } = compiled;

  // ---- indici ----
  const byId = new Map();
  for (const a of asts) walk(a, (n) => { if (typeof n.id === "number") byId.set(n.id, n); });

  const lineStarts = new Map();
  for (const [id, s] of sourcesById) {
    const starts = [0];
    for (let i = 0; i < s.buf.length; i++) if (s.buf[i] === 10) starts.push(i + 1);
    lineStarts.set(id, starts);
  }
  function locate(node) {
    const [start, , fileId] = String(node.src).split(":").map(Number);
    const starts = lineStarts.get(fileId);
    const s = sourcesById.get(fileId);
    if (!starts || !s) return { file: "?", line: 0, text: "" };
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= start) lo = mid; else hi = mid - 1;
    }
    const end = lo + 1 < starts.length ? starts[lo + 1] - 1 : s.buf.length;
    return { file: s.file, line: lo + 1, text: s.buf.subarray(starts[lo], end).toString("utf8").trim() };
  }

  // ---- contratto target ----
  const contracts = [...byId.values()].filter((n) => n.nodeType === "ContractDefinition");
  const primaryContracts = contracts.filter((c) => Number(String(c.src).split(":")[2]) === primaryId);
  let target = targetName
    ? primaryContracts.find((c) => c.name === targetName)
    : [...primaryContracts].reverse().find((c) => c.contractKind === "contract" && !c.abstract);
  if (!target) throw new Error(`Contratto target non trovato: ${targetName ?? "(auto)"}`);

  const linear = target.linearizedBaseContracts.map((id) => byId.get(id));
  const linearIds = new Set(linear.map((c) => c.id));
  const fns = [];
  for (const c of linear) for (const n of c.nodes) if (n.nodeType === "FunctionDefinition") fns.push(n);
  const keyOf = (f) => (f.kind === "function" ? f.name : f.kind);
  const fnsByKey = new Map();
  for (const f of fns) {
    const k = keyOf(f);
    if (!fnsByKey.has(k)) fnsByKey.set(k, []);
    fnsByKey.get(k).push(f);
  }

  // ---- call graph (con dispatch virtuale: stesso nome nella linearizzazione) ----
  const calleesMemo = new Map();
  function callees(f) {
    if (calleesMemo.has(f.id)) return calleesMemo.get(f.id);
    const out = new Set();
    const visit = (n) => {
      const rd = n.referencedDeclaration;
      if (typeof rd !== "number") return;
      const d = byId.get(rd);
      if (!d) return;
      if (d.nodeType === "FunctionDefinition") {
        out.add(d);
        if (linearIds.has(d.scope)) for (const v of fnsByKey.get(keyOf(d)) || []) out.add(v);
      } else if (d.nodeType === "ModifierDefinition") {
        out.add(d);
      }
    };
    walk(f.body ?? {}, visit);
    for (const m of f.modifiers || []) walk(m, visit);
    calleesMemo.set(f.id, out);
    return out;
  }
  const reachMemo = new Map();
  function reach(entry) {
    if (reachMemo.has(entry.id)) return reachMemo.get(entry.id);
    const seen = new Set([entry]);
    const q = [entry];
    while (q.length) {
      const f = q.pop();
      for (const g of callees(f)) if (!seen.has(g)) { seen.add(g); q.push(g); }
    }
    reachMemo.set(entry.id, seen);
    return seen;
  }

  const entries = fns.filter(
    (f) => ["public", "external"].includes(f.visibility) && ["function", "receive", "fallback"].includes(f.kind)
  );

  // ---- proprietà per funzione ----
  const propsMemo = new Map();
  function props(f) {
    if (propsMemo.has(f.id)) return propsMemo.get(f.id);
    const p = { delegatecall: [], ecrecover: false, chainid: false, thisRef: false };
    const visit = (n) => {
      if (n.nodeType === "MemberAccess" && n.memberName === "delegatecall") p.delegatecall.push(locate(n));
      if (n.nodeType === "YulIdentifier" && n.name === "delegatecall") p.delegatecall.push(locate(n));
      if (n.nodeType === "Identifier" && n.name === "ecrecover") p.ecrecover = true;
      if (n.nodeType === "MemberAccess" && n.memberName === "chainid") p.chainid = true;
      if (n.nodeType === "YulIdentifier" && n.name === "chainid") p.chainid = true;
      if (n.nodeType === "Identifier" && n.name === "this") p.thisRef = true;
    };
    walk(f.body ?? {}, visit);
    propsMemo.set(f.id, p);
    return p;
  }
  const fname = (f) => `${byId.get(f.scope)?.name ?? "?"}.${keyOf(f)}`;

  const facts = [];

  // 1) Upgradeability
  {
    const upgradeBase = /(upgradeable|uups|erc1967|initializable|transparentupgradeableproxy)/i;
    const bases = linear.map((c) => c.name).filter((n) => upgradeBase.test(n));
    const upFns = fns.filter((f) => /^(_authorizeUpgrade|upgradeTo|upgradeToAndCall|initialize|reinitialize)$/.test(f.name));
    facts.push({
      id: "F-upgradeability",
      kind: "upgradeability",
      upgradeable: bases.length > 0 || upFns.length > 0,
      evidence: { bases, functions: upFns.map(fname) },
    });
    for (const f of upFns.filter((x) => x.name === "_authorizeUpgrade")) {
      const empty = (f.body?.statements?.length ?? 0) === 0;
      const noMods = (f.modifiers || []).length === 0;
      if (empty && noMods) {
        const loc = locate(f);
        facts.push({ id: "F-unprotected-upgrade", kind: "unprotected_upgrade", ...loc, function: fname(f) });
      }
    }
  }

  // 2) delegatecall raggiungibile da un entry point (e non solo "presente nel file")
  {
    const reachable = [];
    const reachedFns = new Set();
    for (const e of entries) for (const f of reach(e)) reachedFns.add(f);
    for (const e of entries) {
      for (const f of reach(e)) {
        for (const loc of props(f).delegatecall) reachable.push({ entry: fname(e), via: fname(f), ...loc });
      }
    }
    const unreachable = [];
    for (const n of byId.values()) {
      if (n.nodeType !== "FunctionDefinition" || !n.body) continue;
      if (props(n).delegatecall.length && !reachedFns.has(n)) {
        unreachable.push({ function: fname(n), ...props(n).delegatecall[0] });
      }
    }
    facts.push({
      id: "F-delegatecall",
      kind: "delegatecall",
      reachable: reachable.length > 0,
      reachableFrom: reachable,
      presentButUnreachable: unreachable,
      ...(reachable[0] ? { file: reachable[0].file, line: reachable[0].line, text: reachable[0].text } : {}),
    });
  }

  // 3) Costanti-limite dichiarate ma mai usate (es. MAX_SUPPLY)
  const limitConsts = [];
  for (const c of linear) {
    for (const v of c.nodes.filter((n) => n.nodeType === "VariableDeclaration" && n.constant)) {
      if (!/(MAX|CAP|LIMIT)/i.test(v.name)) continue;
      let refs = 0;
      for (const a of asts) walk(a, (n) => { if (n.referencedDeclaration === v.id) refs++; });
      limitConsts.push({ name: v.name, id: v.id, refs, ...locate(v) });
    }
  }
  for (const l of limitConsts.filter((x) => x.refs === 0)) {
    facts.push({ id: `F-unused-limit-${l.name}`, kind: "unused_limit_constant", name: l.name, file: l.file, line: l.line, text: l.text });
  }

  // 4) Mint raggiungibili e se hanno un controllo di cap
  for (const f of fns.filter((x) => linearIds.has(x.scope) && x.scope === target.id && x.body)) {
    let mints = [];
    let capChecked = false;
    const fixedAmount = [];
    walk(f.body, (n) => {
      const rd = n.referencedDeclaration;
      const d = typeof rd === "number" ? byId.get(rd) : null;
      // solo mint ereditati dal contratto stesso (non mint di contratti esterni come il position manager)
      if (d && d.nodeType === "FunctionDefinition" && /^_?mint$/.test(d.name) && linearIds.has(d.scope)) mints.push(locate(n));
      if (d && d.nodeType === "VariableDeclaration" && d.constant && /(MAX|CAP|LIMIT)/i.test(d.name)) capChecked = true;
      if (n.nodeType === "FunctionCall" && n.arguments?.length >= 2) {
        const callee = byId.get(n.expression?.referencedDeclaration);
        const amt = byId.get(n.arguments[1]?.referencedDeclaration);
        if (callee && /^_?mint$/.test(callee.name) && linearIds.has(callee.scope) && amt?.nodeType === "VariableDeclaration" && amt.constant) fixedAmount.push(locate(n));
      }
      if ((n.nodeType === "Identifier" || n.nodeType === "MemberAccess") && (n.name === "totalSupply" || n.memberName === "totalSupply")) capChecked = true;
    });
    if (mints.length && fixedAmount.length === mints.length) continue; // importi costanti: nessun mint arbitrario
    if (mints.length) {
      facts.push({
        id: `F-mint-${keyOf(f)}`,
        kind: "mint_site",
        function: fname(f),
        visibility: f.visibility,
        modifiers: (f.modifiers || []).map((m) => m.modifierName.name),
        capChecked,
        ...mints[0],
      });
    }
  }

  // 5) Firma verificata senza separazione di dominio (chainId / address(this))
  for (const e of entries) {
    const r = [...reach(e)];
    if (!r.some((f) => props(f).ecrecover)) continue;
    const hasDomain = r.some((f) => props(f).chainid || props(f).thisRef);
    facts.push({
      id: `F-signature-${keyOf(e)}`,
      kind: "signature_verification",
      function: fname(e),
      hasDomainSeparation: hasDomain,
      ...locate(e),
    });
  }

  // 6) Parametri di slippage a zero (named args *Min = 0)
  for (const f of fns.filter((x) => x.scope === target.id && x.body)) {
    walk(f.body, (n) => {
      if (n.nodeType !== "FunctionCall" || !n.names?.length) return;
      n.names.forEach((nm, i) => {
        const a = n.arguments[i];
        if (/min/i.test(nm) && a?.nodeType === "Literal" && /^0+$/.test(String(a.value))) {
          facts.push({ id: `F-zero-min-${nm}-${locate(n).line}`, kind: "zero_slippage_param", param: nm, function: fname(f), ...locate(a) });
        }
      });
    });
  }


  // 6b) Owner che bypassa ogni controllo di ruolo (override di _checkRole/hasRole che legge owner())
  for (const f of fns.filter((x) => x.scope === target.id && /^(_checkRole|hasRole)$/.test(x.name) && x.body)) {
    let readsOwner = false;
    walk(f.body, (n) => {
      const d = byId.get(n.referencedDeclaration);
      if ((d?.nodeType === "FunctionDefinition" || d?.nodeType === "VariableDeclaration") && d.name === "owner") readsOwner = true;
    });
    if (readsOwner) facts.push({ id: `F-owner-bypass-${f.name}`, kind: "owner_bypass", function: fname(f), ...locate(f) });
  }
  // (ereditato da una base: stessa verifica sulle funzioni dei contratti base nel file)
  for (const f of fns.filter((x) => x.scope !== target.id && /^_checkRole$/.test(x.name) && x.body && Number(String(x.src).split(":")[2]) === primaryId)) {
    let readsOwner = false;
    walk(f.body, (n) => {
      const d = byId.get(n.referencedDeclaration);
      if ((d?.nodeType === "FunctionDefinition" || d?.nodeType === "VariableDeclaration") && d.name === "owner") readsOwner = true;
    });
    if (readsOwner && !facts.some((x) => x.kind === "owner_bypass")) facts.push({ id: `F-owner-bypass-${f.name}`, kind: "owner_bypass", function: fname(f), ...locate(f) });
  }

  // 6c) Funzioni privilegiate che spostano valore (ETH)
  for (const f of fns.filter((x) => ["public", "external"].includes(x.visibility) && x.body && (x.modifiers || []).length)) {
    let moves = null;
    walk(f.body, (n) => {
      if (moves) return;
      if (n.nodeType === "MemberAccess" && /^(sendValue|send|transfer)$/.test(n.memberName) && /address/.test(n.expression?.typeDescriptions?.typeString ?? "")) moves = n;
      if (n.nodeType === "MemberAccess" && n.memberName === "sendValue") moves = n;
      if (n.nodeType === "FunctionCallOptions" && n.names?.includes("value")) moves = n;
    });
    if (moves) facts.push({ id: `F-priv-withdraw-${f.name}`, kind: "privileged_withdrawal", function: fname(f), modifiers: f.modifiers.map((m) => m.modifierName.name), ...locate(moves) });
  }

  // 6d) Mint verso un indirizzo costante + quota rispetto a MAX_SUPPLY
  {
    const ev = makeEvalConst(byId);
    const maxC = limitConsts.find((l) => l.name === "MAX_SUPPLY");
    const maxVal = maxC ? ev({ nodeType: "Identifier", referencedDeclaration: maxC.id }) : null;
    const fixed = [];
    for (const f of fns.filter((x) => x.scope === target.id && x.body)) {
      walk(f.body, (n) => {
        if (n.nodeType !== "FunctionCall" || n.arguments?.length < 2) return;
        const callee = byId.get(n.expression?.referencedDeclaration);
        if (!callee || !/^_?mint$/.test(callee.name) || !linearIds.has(callee.scope)) return;
        const to = byId.get(n.arguments[0]?.referencedDeclaration);
        const amt = ev(n.arguments[1]);
        if (amt === null) return;
        const constRecipient = to?.nodeType === "VariableDeclaration" && to.constant;
        fixed.push({ recipient: constRecipient ? to.name : null, amount: amt, fn: fname(f), loc: locate(n) });
      });
    }
    const totalFixed = fixed.reduce((a, x) => a + x.amount, 0n);
    for (const m of fixed.filter((x) => x.recipient)) {
      const pct = maxVal ? Number((m.amount * 10000n) / maxVal) / 100 : null;
      facts.push({ id: `F-fixed-mint-${m.recipient}`, kind: "mint_to_constant_recipient", recipient: m.recipient, function: m.fn,
        amount: m.amount.toString(), pctOfMaxSupply: pct, ...m.loc });
    }
    if (maxVal !== null && fixed.length) {
      facts.push({ id: "F-supply-budget", kind: "supply_budget", maxSupply: maxVal.toString(), fixedMints: totalFixed.toString(),
        unallocated: (maxVal - totalFixed).toString() });
    }
  }

  // 6e) Pool inizializzato/creato nella stessa funzione che minta liquidità con minimi a zero
  for (const f of fns.filter((x) => x.scope === target.id && x.body)) {
    let poolInit = null;
    walk(f.body, (n) => {
      if (n.nodeType === "MemberAccess" && /^(createAndInitializePoolIfNecessary|initialize)$/.test(n.memberName) && !linearIds.has(byId.get(n.referencedDeclaration)?.scope)) poolInit = n;
    });
    const zero = facts.find((x) => x.kind === "zero_slippage_param" && x.function === fname(f));
    if (poolInit && zero) facts.push({ id: `F-pool-init-zero-min-${f.name}`, kind: "pool_init_zero_min", function: fname(f), ...locate(poolInit) });
  }

  // 6f) Setter privilegiato di un indirizzo usato per verificare firme, senza timelock
  {
    const sigEntries = entries.filter((e) => [...reach(e)].some((f) => props(f).ecrecover));
    const hasTimelock = linear.some((c) => /timelock/i.test(c.name)) || fns.some((f) => /timelock/i.test(f.name));
    for (const s of fns.filter((x) => (x.modifiers || []).length && x.body)) {
      const vars = new Set();
      walk(s.body, (n) => {
        if (n.nodeType !== "Assignment") return;
        const d = byId.get(n.leftHandSide?.referencedDeclaration);
        if (d?.nodeType === "VariableDeclaration" && d.stateVariable && d.typeName?.name === "address") vars.add(d);
      });
      for (const v of vars) {
        const users = sigEntries.filter((e) => [...reach(e)].some((f) => { let u = false; walk(f.body ?? {}, (n) => { if (n.referencedDeclaration === v.id) u = true; }); return u; }));
        if (users.length) facts.push({ id: `F-signer-setter-${s.name}`, kind: "signer_setter", function: fname(s), variable: v.name, modifiers: s.modifiers.map((m) => m.modifierName.name), usedBy: users.map(fname), hasTimelock, ...locate(s) });
      }
    }
  }

  // 7) Pragma
  for (const a of asts) {
    walk(a, (n) => {
      if (n.nodeType === "PragmaDirective" && n.literals[0] === "solidity" && Number(String(n.src).split(":")[2]) === primaryId) {
        const v = n.literals.slice(1).join("");
        facts.push({ id: "F-pragma", kind: "pragma", value: v, floating: /[\^>]/.test(v), ...locate(n) });
      }
    });
  }

  // 8) Inventario funzioni esterne che modificano lo stato (per la revisione manuale)
  const inventory = entries
    .filter((f) => !["view", "pure"].includes(f.stateMutability))
    .map((f) => ({ function: fname(f), visibility: f.visibility, modifiers: (f.modifiers || []).map((m) => m.modifierName.name), ...locate(f) }));
  facts.push({ id: "F-inventory", kind: "state_changing_entry_points", count: inventory.length, items: inventory });

  return { target: target.name, linearized: linear.map((c) => c.name), limitConsts, facts };
}
