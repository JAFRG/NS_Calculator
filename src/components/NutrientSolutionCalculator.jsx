import React, { useMemo, useState } from "react";

/*
  Nutrient Solution Builder — Audit + Chelates + Cost Optimizer

  - audited atomic weights and refined molar masses
  - micronutrient chelate options and stability notes
  - UI for overriding product molar masses and costs
  - a heuristic cost-minimizer (NNLS + greedy pruning)
*/

const AW = {
  H: 1.00794,
  He: 4.002602,
  Li: 6.941,
  Be: 9.012182,
  B: 10.811,
  C: 12.0107,
  N: 14.0067,
  O: 15.9994,
  F: 18.9984032,
  Na: 22.98976928,
  Mg: 24.3050,
  Al: 26.9815386,
  Si: 28.0855,
  P: 30.973761,
  S: 32.065,
  Cl: 35.453,
  K: 39.0983,
  Ca: 40.078,
  Mn: 54.938045,
  Fe: 55.845,
  Cu: 63.546,
  Zn: 65.38,
  Mo: 95.95,
};

const IONS = ["N", "P", "K", "Ca", "Mg", "S", "Fe", "B", "Mn", "Zn", "Cu", "Mo"];

const SALTS = [
  { id: "ca_no3_4h2o", name: "Calcium nitrate tetrahydrate (Ca(NO3)2·4H2O)", molarMass: 236.15, ions: { Ca: 1, N: 2 }, recommendedTank: "A", costPerKg: 1.8, sourceNotes: "Common horticultural grade; check product label for water of crystallization." },
  { id: "k_no3", name: "Potassium nitrate (KNO3)", molarMass: 101.1032, ions: { K: 1, N: 1 }, recommendedTank: "A", costPerKg: 1.2, sourceNotes: "Widely available; high solubility." },
  { id: "map", name: "Monoammonium phosphate (NH4H2PO4)", molarMass: 115.027, ions: { N: 1, P: 1 }, recommendedTank: "B", costPerKg: 0.9, sourceNotes: "Acidifying phosphate source; may lower pH." },
  { id: "kh2po4", name: "Potassium dihydrogen phosphate (KH2PO4)", molarMass: 136.086, ions: { K: 1, P: 1 }, recommendedTank: "B", costPerKg: 1.1, sourceNotes: "Good P + K, can acidify solution." },
  { id: "k2so4", name: "Potassium sulfate (K2SO4)", molarMass: 174.259, ions: { K: 2, S: 1 }, recommendedTank: "B", costPerKg: 0.8, sourceNotes: "Sulfate source; keep away from Ca in concentrated mixes." },
  { id: "mg_so4_7h2o", name: "Magnesium sulfate heptahydrate (MgSO4·7H2O)", molarMass: 246.474, ions: { Mg: 1, S: 1 }, recommendedTank: "B", costPerKg: 0.6, sourceNotes: "Epsom salt; highly soluble." },
  { id: "mg_no3_6h2o", name: "Magnesium nitrate hexahydrate (Mg(NO3)2·6H2O)", molarMass: 256.41, ions: { Mg: 1, N: 2 }, recommendedTank: "A", costPerKg: 2.0, sourceNotes: "Useful when more nitrate is desired." },
  { id: "urea", name: "Urea (CO(NH2)2)", molarMass: 60.055, ions: { N: 2 }, recommendedTank: "A", costPerKg: 0.7, sourceNotes: "Non-ionic; requires hydrolysis in soil/water to convert to nitrate/ammonium—use with caution in hydroponics." },
  { id: "ammonium_sulfate", name: "Ammonium sulfate ((NH4)2SO4)", molarMass: 132.14, ions: { N: 2, S: 1 }, recommendedTank: "B", costPerKg: 0.65, sourceNotes: "Acidifying; provides sulfate." },
  { id: "kcl", name: "Potassium chloride (KCl)", molarMass: 74.5513, ions: { K: 1 }, recommendedTank: "A", costPerKg: 0.5, sourceNotes: "Cheap K source but adds chloride—useful if chloride tolerance is high." },
  { id: "ca_cl2", name: "Calcium chloride (CaCl2)", molarMass: 110.98, ions: { Ca: 1 }, recommendedTank: "A", costPerKg: 0.9, sourceNotes: "Highly soluble; provides quick Ca but also chloride." },
  { id: "ssp", name: "Single Superphosphate (SSP)", molarMass: 300.0, ions: { P: 1, Ca: 1, S: 1 }, recommendedTank: "B", costPerKg: 0.4, sourceNotes: "Variable composition—use product datasheet to set exact P content." },
  { id: "tsp", name: "Triple Superphosphate (TSP)", molarMass: 252.0, ions: { P: 1 }, recommendedTank: "B", costPerKg: 0.6, sourceNotes: "Concentrated P source; often granular—dissolution rate varies." },
  { id: "fe_edta", name: "Fe-EDTA (iron EDTA)", molarMass: 367.9, ions: { Fe: 1 }, recommendedTank: "B", costPerKg: 18.0, sourceNotes: "Common chelate; stable at pH up to ≈6.5. Check product label for %Fe." },
  { id: "fe_dtpA", name: "Fe-DTPA (iron DTPA)", molarMass: 404.0, ions: { Fe: 1 }, recommendedTank: "B", costPerKg: 22.0, sourceNotes: "More stable than EDTA up to pH ≈7.5; good for slightly alkaline water." },
  { id: "fe_eddha", name: "Fe-EDDHA (iron EDDHA chelate)", molarMass: 600.0, ions: { Fe: 1 }, recommendedTank: "B", costPerKg: 45.0, sourceNotes: "Most stable chelate for high-pH solutions (pH 7-9); often used in alkaline soils." },
  { id: "zn_edta", name: "Zn-EDTA", molarMass: 349.5, ions: { Zn: 1 }, recommendedTank: "B", costPerKg: 10.0, sourceNotes: "Chelated zinc; better retention than sulfate at neutral pH." },
  { id: "mn_edta", name: "Mn-EDTA", molarMass: 331.0, ions: { Mn: 1 }, recommendedTank: "B", costPerKg: 9.0, sourceNotes: "Chelated manganese; prevents precipitation with phosphates." },
  { id: "zn_so4", name: "Zinc sulfate (ZnSO4)", molarMass: 161.47, ions: { Zn: 1 }, recommendedTank: "B", costPerKg: 6.0, sourceNotes: "Inexpensive but less stable in alkaline conditions." },
  { id: "cu_so4", name: "Copper sulfate (CuSO4)", molarMass: 159.61, ions: { Cu: 1 }, recommendedTank: "B", costPerKg: 7.0, sourceNotes: "Useful but phytotoxic at low concentrations if overdosed." },
  { id: "mn_so4", name: "Manganese sulfate (MnSO4)", molarMass: 169.01, ions: { Mn: 1 }, recommendedTank: "B", costPerKg: 6.5, sourceNotes: "Inexpensive source of Mn; can precipitate with phosphates at high conc." },
  { id: "boric_acid", name: "Boric acid (H3BO3)", molarMass: 61.83, ions: { B: 1 }, recommendedTank: "B", costPerKg: 4.0, sourceNotes: "Primary B source; low solubility but sufficient for ppm-level dosing." },
  { id: "na2mo", name: "Sodium molybdate (Na2MoO4)", molarMass: 205.95, ions: { Mo: 1 }, recommendedTank: "B", costPerKg: 30.0, sourceNotes: "Mo required at very low ppm; use sparingly." },
  { id: "trace_mix", name: "Trace mix (commercial concentrate)", molarMass: 100.0, ions: { Fe: 0.15, Mn: 0.05, Zn: 0.03, Cu: 0.01, B: 0.03, Mo: 0.005 }, recommendedTank: "B", costPerKg: 25.0, sourceNotes: "Commercial trace mixes vary; enter datasheet values for accuracy." },
];

const PRESETS = {
  Lettuce: { N: 150, P: 40, K: 200, Ca: 160, Mg: 40, S: 60, Fe: 2.0, B: 0.5, Mn: 0.5, Zn: 0.05, Cu: 0.05, Mo: 0.05 },
  Tomato: { N: 200, P: 50, K: 300, Ca: 200, Mg: 50, S: 80, Fe: 2.5, B: 0.4, Mn: 0.5, Zn: 0.1, Cu: 0.05, Mo: 0.05 },
  Strawberry: { N: 160, P: 50, K: 250, Ca: 180, Mg: 60, S: 80, Fe: 2.0, B: 0.6, Mn: 0.6, Zn: 0.06, Cu: 0.04, Mo: 0.05 },
  Cucumber: { N: 180, P: 45, K: 250, Ca: 170, Mg: 45, S: 70, Fe: 2.0, B: 0.5, Mn: 0.5, Zn: 0.06, Cu: 0.04, Mo: 0.03 },
  Pepper: { N: 180, P: 50, K: 280, Ca: 190, Mg: 50, S: 75, Fe: 2.2, B: 0.5, Mn: 0.5, Zn: 0.06, Cu: 0.04, Mo: 0.04 },
  Basil: { N: 160, P: 40, K: 200, Ca: 150, Mg: 40, S: 60, Fe: 1.8, B: 0.4, Mn: 0.4, Zn: 0.04, Cu: 0.03, Mo: 0.02 },
  Spinach: { N: 180, P: 50, K: 220, Ca: 170, Mg: 45, S: 70, Fe: 3.0, B: 0.6, Mn: 0.6, Zn: 0.08, Cu: 0.05, Mo: 0.06 },
  CannabisVeg: { N: 180, P: 50, K: 250, Ca: 170, Mg: 50, S: 80, Fe: 2.5, B: 0.5, Mn: 0.5, Zn: 0.06, Cu: 0.04, Mo: 0.05 },
  CannabisBloom: { N: 120, P: 60, K: 300, Ca: 160, Mg: 60, S: 90, Fe: 2.5, B: 0.6, Mn: 0.6, Zn: 0.06, Cu: 0.04, Mo: 0.05 },
};

function gramsIonPerGramSalt(salt) {
  const res = {};
  const mm = salt.molarMass || 1.0;
  for (const ion of IONS) {
    const count = salt.ions[ion] || 0;
    if (count > 0) {
      const gramsPerMoleIon = count * (AW[ion] || 0);
      res[ion] = gramsPerMoleIon / mm; // g ion per g salt
    } else {
      if (salt.ions[ion] && salt.ions[ion] < 1) res[ion] = salt.ions[ion];
      else res[ion] = 0;
    }
  }
  return res;
}

const SALT_COMPOSITION = SALTS.map((s) => ({ ...s, comp: gramsIonPerGramSalt(s) }));

function solveNNLSMultiplicative(A, b, maxIter = 2000) {
  const n = A.length;
  if (n === 0) return [];
  const m = A[0].length;
  let x = new Array(m).fill(1.0);
  const eps = 1e-9;
  for (let it = 0; it < maxIter; it++) {
    const Ax = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) Ax[i] += A[i][j] * x[j];
    const numerator = new Array(m).fill(0);
    const denominator = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { num += A[i][j] * b[i]; den += A[i][j] * Ax[i]; }
      numerator[j] = num + eps; denominator[j] = den + eps;
    }
    let maxChange = 0;
    for (let j = 0; j < m; j++) {
      const factor = numerator[j] / denominator[j];
      const newx = x[j] * factor;
      maxChange = Math.max(maxChange, Math.abs(newx - x[j]));
      x[j] = newx;
    }
    if (maxChange < 1e-6) break;
  }
  for (let j = 0; j < m; j++) if (x[j] < 0) x[j] = 0;
  return x;
}

function minimizeCostHeuristic(availableSalts, totalIonGrams) {
  const A = IONS.map((ion) => availableSalts.map((s) => s.comp[ion] || 0));
  const x0 = solveNNLSMultiplicative(A, totalIonGrams, 2000);
  const costs = availableSalts.map((s) => s.costPerKg || 0).map((c) => c / 1000.0); // cost per gram
  let bestX = x0.slice();
  let bestCost = bestX.reduce((sum, xi, i) => sum + xi * costs[i], 0);
  let improved = true;
  for (let pass = 0; pass < 5 && improved; pass++) {
    improved = false;
    for (let j = 0; j < availableSalts.length; j++) {
      if ((bestX[j] || 0) <= 1e-9) continue;
      const keepIdx = availableSalts.map((_, i) => i).filter((i) => i !== j);
      if (keepIdx.length === 0) continue;
      const keptSalts = keepIdx.map((i) => availableSalts[i]);
      const Ak = IONS.map((ion) => keptSalts.map((s) => s.comp[ion] || 0));
      const xk = solveNNLSMultiplicative(Ak, totalIonGrams, 2000);
      const fullX = availableSalts.map(() => 0);
      keepIdx.forEach((idx, r) => (fullX[idx] = xk[r] || 0));
      const costk = fullX.reduce((sum, xi, i) => sum + xi * costs[i], 0);
      const delivered = IONS.map((ion, ii) => availableSalts.reduce((s, salt, jj) => s + (salt.comp[ion] || 0) * fullX[jj], 0));
      const feasible = delivered.every((d, ii) => d + 1e-6 >= totalIonGrams[ii] * 0.99);
      if (feasible && costk < bestCost - 1e-9) {
        bestCost = costk; bestX = fullX; improved = true;
      }
    }
  }
  return { masses: bestX, cost: bestCost };
}

export default function NutrientSolutionCalculator() {
  const [volumeL, setVolumeL] = useState(100);
  const [presetName, setPresetName] = useState("Lettuce");
  const [targetsMgL, setTargetsMgL] = useState(PRESETS["Lettuce"] || {});
  const [includeMicros, setIncludeMicros] = useState(true);
  const [autoOptimizeCost, setAutoOptimizeCost] = useState(true);

  const [saltOverrides, setSaltOverrides] = useState({});

  const onSelectPreset = (name) => { setPresetName(name); setTargetsMgL({ ...(PRESETS[name] || {}) }); };

  const targetsInMgL = targetsMgL;
  const totalIonGrams = useMemo(() => IONS.map((ion) => ((targetsInMgL[ion] || 0) * volumeL) / 1000.0), [targetsInMgL, volumeL]);

  const saltsWithOverrides = useMemo(() => {
    return SALTS.map((s) => {
      const ov = saltOverrides[s.id] || {};
      const mm = ov.molarMass || s.molarMass;
      const cost = ov.costPerKg || s.costPerKg;
      const comp = gramsIonPerGramSalt({ ...s, molarMass: mm });
      return { ...s, molarMass: mm, costPerKg: cost, comp };
    });
  }, [saltOverrides]);

  const availableSalts = useMemo(() => saltsWithOverrides.filter((s) => includeMicros ? true : !["fe_edta","fe_dtpA","fe_eddha","zn_edta","mn_edta","zn_so4","cu_so4","mn_so4","boric_acid","na2mo","trace_mix"].includes(s.id)), [saltsWithOverrides, includeMicros]);

  const optimization = useMemo(() => {
    const result = minimizeCostHeuristic(availableSalts, totalIonGrams);
    const masses = result.masses || [];
    const salts = availableSalts;
    const output = salts.map((s, i) => ({ ...s, grams: masses[i] || 0, gramsPerL: (masses[i] || 0) / Math.max(volumeL, 1) }));
    return { output, cost: result.cost };
  }, [availableSalts, totalIonGrams, volumeL]);

  const deliveredIonGrams = useMemo(() => {
    const delivered = new Array(IONS.length).fill(0);
    for (let j = 0; j < optimization.output.length; j++) {
      const salt = optimization.output[j];
      const mass = salt.grams || 0;
      for (let i = 0; i < IONS.length; i++) {
        const ion = IONS[i];
        delivered[i] += (salt.comp[ion] || 0) * mass;
      }
    }
    return delivered;
  }, [optimization]);

  function updateSaltOverride(id, field, value) {
    setSaltOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: Number(value) } }));
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
      <h1 className="text-2xl font-bold">Nutrient Audit + Chelates + Cost Optimizer</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Solution volume (L)</label>
              <input type="number" value={volumeL} onChange={(e) => setVolumeL(Number(e.target.value))} className="mt-1 p-2 rounded border w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium">Crop preset</label>
              <select value={presetName} onChange={(e) => onSelectPreset(e.target.value)} className="mt-1 p-2 rounded border w-full">
                {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h2 className="font-semibold">Targets (mg/L)</h2>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {IONS.map((ion) => (
                <div key={ion}>
                  <label className="text-sm">{ion}</label>
                  <input type="number" value={targetsMgL[ion] || 0} onChange={(e) => setTargetsMgL({ ...targetsMgL, [ion]: Number(e.target.value) })} className="mt-1 p-2 rounded border w-full" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex items-center">
                <input type="checkbox" className="mr-2" checked={includeMicros} onChange={(e) => setIncludeMicros(e.target.checked)} />
                Include micronutrients
              </label>
              <label className="inline-flex items-center">
                <input type="checkbox" className="mr-2" checked={autoOptimizeCost} onChange={(e) => setAutoOptimizeCost(e.target.checked)} />
                Use cost optimizer (heuristic)
              </label>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h2 className="font-semibold">Salt overrides (match product datasheets)</h2>
            <div className="text-xs text-gray-600 mb-2">If you have a product datasheet, enter exact molar mass (if different) and cost per kg so the optimizer matches procurement reality.</div>
            <div className="grid grid-cols-1 gap-2 max-h-80 overflow-auto">
              {SALT_COMPOSITION.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b py-2">
                  <div className="w-64">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-gray-600">Default MM: {s.molarMass} g/mol — Default cost: {s.costPerKg} €/kg</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-xs">MM (g/mol)</label>
                    <input type="number" className="p-1 border rounded text-xs w-24" onChange={(e) => updateSaltOverride(s.id, 'molarMass', e.target.value)} />
                    <label className="text-xs">Cost €/kg</label>
                    <input type="number" className="p-1 border rounded text-xs w-24" onChange={(e) => updateSaltOverride(s.id, 'costPerKg', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h2 className="font-semibold">Optimization result (heuristic)</h2>
            <div className="text-sm">Estimated cost for {volumeL} L: <strong>{optimization.cost.toFixed(4)}</strong> (currency units)</div>
            <table className="w-full text-sm mt-3">
              <thead><tr className="text-left"><th>Salt</th><th>grams total</th><th>g/L</th><th>cost (€/kg)</th></tr></thead>
              <tbody>
                {optimization.output.map((s) => (
                  <tr key={s.id} className="border-t"><td className="py-1">{s.name}</td><td className="py-1">{s.grams.toFixed(4)}</td><td className="py-1">{s.gramsPerL.toFixed(6)}</td><td className="py-1">{s.costPerKg.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 text-xs text-gray-600">
              <strong>Notes on chelate stability:</strong>
              <ul className="list-disc ml-5">
                <li>Fe-EDTA: stable roughly up to pH 6.5 — inexpensive but loses Fe at higher pH.</li>
                <li>Fe-DTPA: stable up to ~pH 7.5; better for near-neutral waters.</li>
                <li>Fe-EDDHA: most stable for alkaline solutions (pH 7–9), recommended when water pH is high.</li>
                <li>Zn/Mn/Cu chelates (EDTA): more stable than sulfates in neutral pH; sulfates are cheaper but can precipitate with phosphates.</li>
              </ul>
            </div>

            <div className="mt-3 text-xs text-gray-600">
              <strong>Exact optimization:</strong> For provably optimal minimal-cost mixes (subject to linear constraints) you can plug this problem into a small LP solver (glpk.js or OR-Tools WASM). The repository can be extended to call a WASM LP solver for exact solutions. I can generate that repo if you want.
            </div>

          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold">Delivery check</h3>
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-left"><th>Ion</th><th>Target mg/L</th><th>Delivered mg/L</th><th>Residual mg/L</th></tr></thead>
              <tbody>
                {IONS.map((ion, i) => {
                  const target = targetsInMgL[ion] || 0;
                  const deliveredMgL = (deliveredIonGrams[i] * 1000) / Math.max(volumeL, 1);
                  const residual = (deliveredMgL - target).toFixed(3);
                  return (<tr key={ion} className="border-t"><td className="py-1">{ion}</td><td className="py-1">{target.toFixed(3)}</td><td className="py-1">{deliveredMgL.toFixed(3)}</td><td className="py-1">{residual}</td></tr>);
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-sm">
            <h3 className="font-semibold">How to get exact minimal-cost mixes (recommended)</h3>
            <ol className="list-decimal ml-5 mt-2">
              <li>Collect product datasheets: exact % element, water of crystallization, and price per kg.</li>
              <li>Use a small LP solver (glpk.js, OR-Tools WASM or a backend endpoint) with objective minimize cost, constraints: delivered_ions >= targets, x >= 0.</li>
              <li>If you want, I can produce a ready-to-deploy serverless function (Node + glpk.js) or a WASM-based frontend bundle that solves LPs exactly in-browser.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
