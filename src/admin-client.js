export async function adminFetch(url,options={}){
 const response=await fetch(url,{...options,credentials:'same-origin',cache:'no-store',headers:{'X-Amorim-Request':'1',...options.headers}});
 const data=await response.json();
 if(!response.ok){
  if(response.status===401)setTimeout(()=>window.dispatchEvent(new Event('admin-session-expired')),0);
  throw Error(data.error||'Seu acesso expirou. Entre novamente.');
 }
 return data;
}
