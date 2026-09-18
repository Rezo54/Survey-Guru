import test from 'node:test';
import assert from 'node:assert/strict';
import { summariseStoreEvidence } from '../src/store-insights.js';
test('insights exclude pending QA, preserve zero, and compare only matching products',()=>{
 const p={brand:'Bread',product:'700g',purchasePrice:10,sellingPrice:15,dailySalesVolume:0};
 const result=summariseStoreEvidence([{id:'a',accepted:true,day:'2026-09-18',products:[p]},{id:'b',accepted:true,day:'2026-09-11',products:[{...p,purchasePrice:null,sellingPrice:20,dailySalesVolume:2}]},{id:'c',accepted:false,day:'2026-09-18',products:[{...p,sellingPrice:1000}]},{id:'d',accepted:true,day:'2026-09-18',products:[{...p,product:'400g',sellingPrice:5}]}],'2026-09-18');
 assert.equal(result.products[0].sellingMean,17.5);assert.equal(result.products[0].meanUnitSpread,5);assert.equal(result.products[0].reportedUnits,2);assert.equal(result.products[0].volumeSamples,2);assert.equal(result.products.length,2);assert.equal(result.pricedRows,2);assert.equal(result.recentSubmissions,3);assert.equal(result.previousSubmissions,1);
});
test('empty evidence has no invented price or volume',()=>{const r=summariseStoreEvidence([],'2026-09-18');assert.equal(r.products.length,0);assert.equal(r.trend.length,14);assert.equal(r.recentSubmissions,0);});
