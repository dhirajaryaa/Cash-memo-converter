import assert from "node:assert/strict";
import { cleanName, shortenAddress } from "./core/address.js";

const cases: [string[], string][] = [
  [["S/o Late Mangal Ram", "Gopi Indra, Dariyapur", "Dariyapur, Kurthaul, Patna", "Patna,PATNA", "Bihar-804453"], "Gopi Indra, Dariyapur, Kurthaul"],
  [["S/O KRIPA SHANKAR RAM C/O SIM", "MO-DARIYAPUR, PO-MITTANCHA", "PS-PARSA BAZAR,PATNA", "PATNA,PATNA", "Bihar-804453"], "Dariyapur, Mittancha"],
  [["C/ Manju Devi", "Adarsh Colony, Dariyapur Road", "Kurthaul, Patna", "Patna,PATNA", "Bihar-804453"], "Adarsh Colony, Dariyapur Road, Kurthaul"],
  [["1880A GR FLOOR", "H/O Devanti Devi, Devi Mandir Road New Dasrat"], "1880A Gr Floor, Devi Mandir Road New Dasrat"],
  [["301, H/oravindra Kumar, Geetanjali Appartment"], "301, Geetanjali Appartment"],
  [["NILL PRAGATI NAGAR SIPARA", "Dhelwan, IOC ROAD Dhelwan"], "Pragati Nagar Sipara, IOC Road Dhelwan"],
  [["W/O - RAKESH THAKUR", "DARIYAPUR", "PS - PARSA BAZAR, PO -MITTANC"], "Dariyapur, Mittanc"],
  [["G/o Nitish Kumar", '" Aashirwad", Behind Of Shubham Utsav, IOC Road'], "Aashirwad, Behind Of Shubham Utsav, IOC Road"],
  [["W/O Jitendra Saw", "Khairatali, Mittanchak, Gopalpur", "Patna,PATNA", "Bihar-804453"], "Khairatali, Mittanchak, Gopalpur"],
];
for (const [i, o] of cases) assert.equal(shortenAddress(i), o, `address case ${i}: ${JSON.stringify(i)}`);

assert.equal(shortenAddress(cases[0][0], 1), "Gopi Indra");
assert.equal(shortenAddress(cases[0][0], 2), "Gopi Indra, Dariyapur");
assert.equal(shortenAddress(cases[0][0], 9), "Gopi Indra, Dariyapur, Kurthaul");

assert.equal(cleanName("ROHAN KUMAR A"), "Rohan Kumar");
assert.equal(cleanName("Tamnna ."), "Tamnna");
assert.equal(cleanName("Subhash kumar A"), "Subhash Kumar");
assert.equal(cleanName("Mr Subhash K Singh A"), "Subhash K Singh");
assert.equal(cleanName("SHYAM PYARI DEVI"), "Shyam Pyari Devi");

console.log("address tests ok");
