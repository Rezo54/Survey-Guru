import test from 'node:test';
import assert from 'node:assert/strict';
import {readPhotoStorage,PhotoStorageError} from '../src/photo-storage.js';
test('photo storage preserves successful bytes and classifies failures without exposing details',async()=>{
 const bytes=Buffer.from('image');assert.equal(await readPhotoStorage(async()=>bytes),bytes);
 for(const [code,status] of [[404,404],[403,503],[401,503],[500,503]])await assert.rejects(readPhotoStorage(async()=>{throw {code,message:'private bucket detail'};}),(e:unknown)=>e instanceof PhotoStorageError&&e.statusCode===status&&!e.message.includes('private bucket detail'));
});
