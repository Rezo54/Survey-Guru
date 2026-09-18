import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { productEvidence, evidenceNumber } = await import(pathToFileURL(path.resolve('packages/domain/src/product-evidence.js')).href);
test('custom question IDs resolve prices through labels and preserve row alignment', () => {
  const questions = [{id:'q1',label:'Brand'}, {id:'q2',label:'Product size'}, {id:'q3',label:'Purchase price (R)'}, {id:'q4',label:'Selling price'}, {id:'q5',label:'Daily sales volume'}];
  const rows=productEvidence({q1:['Blue Ribbon','Blue Ribbon'],q2:['White 700g','Brown 700g'],q3:['R 12,50',0],q4:['15.75',''],q5:[16,20]},questions);
  assert.deepEqual(rows,[{brand:'Blue Ribbon',product:'White 700g',purchasePrice:12.5,sellingPrice:15.75,dailySalesVolume:16},{brand:'Blue Ribbon',product:'Brown 700g',purchasePrice:0,sellingPrice:null,dailySalesVolume:20}]);
});
test('standard product rows and currency strings retain captured values',()=>{
  assert.equal(productEvidence({brandProducts:[{brand:'A',product:'B',purchasePrice:'2 000,45',sellingPrice:2200.45,dailySalesVolume:3}]})[0].purchasePrice,2000.45);
  assert.equal(evidenceNumber(''),null);assert.equal(evidenceNumber('unavailable'),null);assert.equal(evidenceNumber('0.00'),0);
});
test('unknown questions are not inferred as zero or copied into another product',()=>{
  const rows=productEvidence({brand:['A','B'],product:['X','Y'],q1:['12.5']},[{id:'q1',label:'Purchase price'}]);
  assert.equal(rows[0].purchasePrice,12.5);assert.equal(rows[1].purchasePrice,null);assert.equal(rows[0].sellingPrice,null);
});
