import Papa from "papaparse";

async function run() {
  const url = `https://docs.google.com/spreadsheets/d/19EllcHpSDAANnoXcTCYI8LIR9TE7b_e_Cst0KMgveO0/gviz/tq?tqx=out:csv&sheet=assets_inventory`;
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true });
  console.log("Columns:", Object.keys(parsed.data[0] || {}));
  console.log("Total entries:", parsed.data.length);
  console.log("Raw items:", JSON.stringify(parsed.data.slice(0, 2), null, 2));
}

run();
