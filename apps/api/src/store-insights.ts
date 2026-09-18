import type { ProductEvidence } from '../../../packages/domain/src/product-evidence.js';
type Capture = { id:string; accepted:boolean; day:string; products:ProductEvidence[] };
export function summariseStoreEvidence(captures:Capture[], endDay:string) {
  const accepted=captures.filter(c=>c.accepted);
  const groups=new Map<string,{brand:string;product:string;stores:Set<string>;buy:number[];sell:number[];volume:number[];spread:number[]}>();
  let rows=0,priced=0,volumeRows=0;
  for(const capture of accepted) for(const p of capture.products){
    if(!p.brand.trim()&&!p.product.trim())continue;
    rows++;if(p.purchasePrice!==null&&p.sellingPrice!==null)priced++;if(p.dailySalesVolume!==null)volumeRows++;
    const key=JSON.stringify([p.brand.trim().toLowerCase(),p.product.trim().toLowerCase()]);
    let g=groups.get(key);if(!g){g={brand:p.brand,product:p.product,stores:new Set(),buy:[],sell:[],volume:[],spread:[]};groups.set(key,g);}
    g.stores.add(capture.id);
    if(p.purchasePrice!==null)g.buy.push(p.purchasePrice);
    if(p.sellingPrice!==null)g.sell.push(p.sellingPrice);
    if(p.dailySalesVolume!==null)g.volume.push(p.dailySalesVolume);
    if(p.purchasePrice!==null&&p.sellingPrice!==null)g.spread.push(p.sellingPrice-p.purchasePrice);
  }
  const avg=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const products=[...groups.values()].map(g=>({brand:g.brand,product:g.product,stores:g.stores.size,purchaseMean:avg(g.buy),sellingMean:avg(g.sell),sellingMin:g.sell.length?Math.min(...g.sell):null,sellingMax:g.sell.length?Math.max(...g.sell):null,priceSamples:g.sell.length,meanUnitSpread:avg(g.spread),spreadSamples:g.spread.length,reportedUnits:g.volume.length?g.volume.reduce((x,y)=>x+y,0):null,volumeSamples:g.volume.length})).sort((a,b)=>b.stores-a.stores||a.brand.localeCompare(b.brand));
  const end=new Date(endDay+'T12:00:00Z');
  const trend=Array.from({length:14},(_,i)=>{const date=new Date(end);date.setUTCDate(date.getUTCDate()-13+i);const day=date.toISOString().slice(0,10);const found=captures.filter(c=>c.day===day);return {day,submitted:found.length,accepted:found.filter(c=>c.accepted).length};});
  return {acceptedStores:accepted.length,storesWithProducts:accepted.filter(c=>c.products.length>0).length,productRows:rows,pricedRows:priced,volumeRows,products,trend,recentSubmissions:trend.slice(7).reduce((n,d)=>n+d.submitted,0),previousSubmissions:trend.slice(0,7).reduce((n,d)=>n+d.submitted,0)};
}
