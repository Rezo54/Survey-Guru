export class PhotoStorageError extends Error {
  constructor(public statusCode:number,public code:string,message:string, cause:unknown){super(message,{cause});}
}
export async function readPhotoStorage<T>(read:()=>Promise<T>):Promise<T>{
  try{return await read();}catch(error){
    const code=Number((error as {code?:unknown})?.code);
    if(code===404)throw new PhotoStorageError(404,'photo_not_found','The photo or configured storage bucket was not found. An administrator should check the API storage bucket and uploaded file.',error);
    if(code===401||code===403)throw new PhotoStorageError(503,'photo_storage_access','The API cannot access photo storage. An administrator should check the Cloud Run service account and storage permissions.',error);
    throw new PhotoStorageError(503,'photo_storage_unavailable','Photo storage is temporarily unavailable. Retry, or ask an administrator to check the API logs.',error);
  }
}
