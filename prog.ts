// This is a possible js code that uses async/await and Promise.all to perform the task
// It is not tested or guaranteed to work
async function requestTargetUrl(parmobj) {

  let iparr = parmobj.ips.map((ip) => ip.ip);

  let results = await makeConcurrentRequests(iparr, parmobj.uniqueName,parmobj);
  //let success = results.filter((item) => item?.data[suckey] === sucvalue);
  //let failed = results.filter((item) => item?.data[suckey] !== sucvalue);
  let ckres=checkResult(results,parmobj);
  let {success,failed}=ckres;
  
  let failedName = failed.map((item) =>  item.uniqueName);
  let failed_ips = failed.map((item) =>  item.ip);
  let okips = delFailedIp(iparr, failed_ips); // 将 Set 转换回数组

  let retries = 0;
  
  while (failedName.length > 0) {
    if (retries >= parmobj.retrynum) {console.log("over! is do retry Num:" + retries+' have failed:' + failedName.length);break;}
    retries++;
    console.log("do retry:" + retries);
    if (okips.length === 0) {
      console.log("all ip failed! retry num:" + retries);
      break;
    }
  
    let retry_results = await makeConcurrentRequests(okips, failedName,parmobj);
    const ckres=checkResult(retry_results,parmobj);
    let retry_success = ckres.success;
    let retry_failed = ckres.failed;
    //let retry_success = retry_results.filter((item) => item?.data[suckey] === sucvalue);
    //let retry_failed = retry_results.filter((item) => item?.data[suckey] !== sucvalue);
    
    success.push(...retry_success);
    failedName = retry_failed.map((item) =>  item.uniqueName);
    let retry_failed_ips = retry_failed.map((item) => item.ip);
    failed_ips.push(...retry_failed_ips);
    okips = delFailedIp(okips, retry_failed_ips);
  }
  let k=new Set(failed_ips);
  const failedips=Array.from(k)
  iparr=null;
  results=null;
  failed_ips=null;
  k=null;
  ckres=null;
  return { success, failed, okips, failedips,failedName };
}

async function makeRequest(ip, uniqueName,parmobj) {
let params = new URLSearchParams();

for (let i = 0; i < parmobj.parm?.length; i++) {
    let key = parmobj.parm[i];
    //timestamp
    if (parmobj[key] === "timestamp") {
    params.append(key, Date.now().toString());
    continue;
    }
    //cricle data
    if (typeof parmobj[key] === "object") {
    params.append(key, uniqueName);
    continue;
    }
    //other no change
    params.append(key, parmobj[key]);
}
let query = params.toString();
params=null;
// Construct the full url with the query string
let dourl = `${parmobj.targurl}?${query}`;

let client = Deno.createHttpClient({
    proxy: { url: "http://" + ip },
});
let controller = new AbortController();
const signal  = controller.signal;
let init = { headers:parmobj.headers ,client,signal};
//console.log(headers);

const timeoutId = setTimeout(() => {
    controller.abort(); // 超时后中断请求
}, parmobj.timeout*1000);
// Use fetch API to make the request with the ip as a proxy
// Use try/catch block to handle errors
try {
    let response = await fetch(dourl, init);
    clearTimeout(timeoutId); // 清除超时计时器

    if(isNaN(response.status)) {
    throw new Error(`request connection error!`);
    }
    const state=response.status;
    //coensole.log("status:" + response.status);
    // Await for the response data as json
    let data = await response.json();
    //console.log(data);
    // Check if the response data has code 0
    response=null;
    init=null;
    return { uniqueName, data, ip,state };
} catch (error) {
    //console.log("is error here````"+uniqueName+'-->'+ error.massage);
    let data = { err:{stack:error.stack,msg:error.massage} };
    //console.log(data);
    return { uniqueName, data, ip };
} finally{
    controller.abort(); // 超时后中断请求
    client=null;
}
}

async function makeMultipleRequests(ip, uniqueNames,parmobj) {
let promises = [];
for (let i = 0; i < uniqueNames.length; i++) {
    // Make the request with the ip
    parmobj.headadd.map((item)=>{
    let key=Object.keys(item)[0];
    let value=item[key];
    if(value==='uuid4'){
        value=crypto.randomUUID();
        parmobj.headers[key]=value;
    }
    })
    promises.push(makeRequest(ip, uniqueNames[i], parmobj));
    // Wait for 150ms
    //let timeoutId;
    //await new Promise((resolve) => {timeoutId=setTimeout(resolve, parmobj.do_span)});
    //clearTimeout(timeoutId); // 清除超时计时器
    await delay(parmobj.do_span);
}
    let res=await Promise.all(promises); 
    promises=null;
    return res;
}

async function delay(ms) {
    let timeoutId;
    await new Promise((resolve) => {timeoutId=setTimeout(resolve, ms)});
    clearTimeout(timeoutId); // 清除超时计时器
    timeoutId=null;
}

async function makeConcurrentRequests(iparr, uniqueNames,parmobj) {
let chunks = [];
let currentChunk = [];

for (let i = 0; i < uniqueNames.length; i++) {
    currentChunk.push(uniqueNames[i]);
    // Check if the currentChunk has reached the maximum request limit for each IP
    if (
    currentChunk.length === parmobj.each_ip_donum ||
    i === uniqueNames.length - 1
    ) {
    chunks.push(currentChunk);
    currentChunk = [];
    }
}

let promises=[];
for(let i=0;i<chunks.length;i++){
    let ip=iparr[i];
    if(i===iparr.length-1){
        let lat_chunks = chunks.slice(i, chunks.length);
        promises.push(makeMultipleRequests(ip, lat_chunks.flat(),parmobj));
        break;
    }
    promises.push(makeMultipleRequests(ip, chunks[i],parmobj))
    //let timeoutId;
    //await new Promise((resolve) => {timeoutId=setTimeout(resolve, parmobj.ip_span)});
    //clearTimeout(timeoutId); // 清除超时计时器
    await delay(parmobj.ip_span);
}
let results = await Promise.all(promises);
 chunks = null;
 currentChunk = null;
 promises=null;
return results.flat(); // Flatten the array of results
}

function delFailedIp(allips, failed_ips) {
let sSet = new Set(allips); // 将数组 s 转换为 Set
for (let i = 0; i < failed_ips.length; i++) {
    sSet.delete(failed_ips[i]); // 从 Set 中删除数组 d 中的元素
}
let res=Array.from(sSet)
sSet=null;
return res ; // 将 Set 转换回数组
}
function checkResult(results,parmobj){
let success = [];
let failed = [];
for (let i = 0; i < results.length; i++) {
    const item = results[i];
    if (!item?.data)continue;
    if(item?.data[parmobj.suckey] === parmobj.sucvalue) {
    success.push(item);
    } else {
    failed.push(item);
    }
}
return {success,failed}
}
export { requestTargetUrl };