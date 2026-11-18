import assert from "node:assert/strict";
import { shortenAddress, cleanName } from "./address.js";

const cases: [string[], string][] = [
  [["S/o Late Mangal Ram", "Gopi Indra, Dariyapur", "Dariyapur, Kurthaul, Patna", "Patna,PATNA", "Bihar-804453"], "Gopi Indra, Dariyapur, Kurthaul"],
  [["S/O KRIPA SHANKAR RAM C/O SIM", "MO-DARIYAPUR, PO-MITTANCHA", "PS-PARSA BAZAR,PATNA", "PATNA,PATNA", "Bihar-804453"], "Dariyapur, Mittancha"],
  [["C/ Manju Devi", "Adarsh Colony, Dariyapur Road", "Kurthaul, Patna", "Patna,PATNA", "Bihar-804453"], "Adarsh Colony, Dariyapur Road, Kurthaul"],
  [["1880A GR FLOOR", "H/O Devanti Devi, Devi Mandir Road New Dasrat"], "1880A Gr Floor, Devi Mandir Road New Dasrat"],
  [["301, H/oravindra Kumar, Geetanjali Appartment"], "301, Geetanjali Appartment"],
  [["NILL PRAGATI NAGAR SIPARA", "Dhelwan, IOC ROAD Dhelwan"], "Pragati Nagar Sipara, IOC Road Dhelwan"],
];
for (const [i, o] of cases) assert.equal(shortenAddress(i), o);
assert.equal(cleanName("ROHAN KUMAR A"), "Rohan Kumar");
assert.equal(cleanName("Tamnna ."), "Tamnna");
console.log("address tests ok");
