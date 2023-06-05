// This is a possible js code that uses async/await and Promise.all to perform the task
// It is not tested or guaranteed to work
// It is based on the information from  and
async function requestTargetUrl(parmobj) {
  // Destructure the parameters from the object
  let {
    each_ip_donum,
    do_span,
    ip_span,
    targurl,
    parm,
    t,
    limit,
    timeout,
    uniqueName,
    ips,
    retrynum,
    headers,
    headadd,
    suckey,
    sucvalue
  } = parmobj;
  let iparr = ips.map((ip) => ip.ip);
 

  // Define a helper function to make a single request with a given ip and uniqueName
  async function makeRequest(ip, uniqueName, cii,headers) {
    // Construct the query string with the parameters and values
    const params = new URLSearchParams();
    for (let i = 0; i < parm?.length; i++) {
      let key = parm[i];
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
    // Construct the full url with the query string
    let dourl = `${targurl}?${query}`;
    //console.log(cii + "-->" + new Date().toJSON() + "-->" + ip);
  
    const client = Deno.createHttpClient({
      proxy: { url: "http://" + ip },
    });
    const controller = new AbortController();
    const signal  = controller.signal;
    let init = { headers ,client,signal};
    //console.log(headers);
    
    const timeoutId = setTimeout(() => {
      controller.abort(); // 超时后中断请求
    }, timeout*1000);
    // Use fetch API to make the request with the ip as a proxy
    // Use try/catch block to handle errors
    try {
      let response = await fetch(dourl, init);
      clearTimeout(timeoutId); // 清除超时计时器
      
      //console.log(dourl);
 
      if(isNaN(response.status)) {
        throw new Error(`request connection error!`);
      }
      const state=response.status;
      //coensole.log("status:" + response.status);
      
      
      // Await for the response data as json
      let data = await response.json();
      //console.log(data);
      // Check if the response data has code 0
      return { uniqueName, data, ip,state };
    } catch (err) {
      console.log("is error here````"+uniqueName+'-->'+err.stack);
      let data = { err };
      //console.log(data);
      return { uniqueName, data, ip };
    }
  }

  // Define a helper function to make multiple requests with a given ip and an array of uniqueNames
  async function makeMultipleRequests(ip, uniqueNames) {
    let promises = [];
    for (let i = 0; i < uniqueNames.length; i++) {
      // Make the request with the ip
      headadd.map((item)=>{
        let key=Object.keys(item)[0];
        let value=item[key];
        if(value==='uuid4'){
          value=crypto.randomUUID();
          headers[key]=value;
        }
      })
      promises.push(makeRequest(ip, uniqueNames[i], i, headers));
      // Wait for 150ms
      await new Promise((resolve) => setTimeout(resolve, do_span));
    }
    return await Promise.all(promises);
  }

  // Define a helper function to make concurrent requests with multiple ips and an array of uniqueNames
  async function makeConcurrentRequests(iparr, uniqueNames) {
    let chunks = [];
    let currentChunk = [];

    for (let i = 0; i < uniqueNames.length; i++) {
      currentChunk.push(uniqueNames[i]);
      // Check if the currentChunk has reached the maximum request limit for each IP
      if (
        currentChunk.length === each_ip_donum ||
        i === uniqueNames.length - 1
      ) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    // Create an array of promises by mapping each ip and chunk of uniqueNames to multiple requests
    let promises=[];
    for(let i=0;i<chunks.length;i++){
      let ip=iparr[i];
      if(i===iparr.length-1){
         let lat_chunks = chunks.slice(i, chunks.length);
         promises.push(makeMultipleRequests(ip, lat_chunks.flat()));
      }
      promises.push(makeMultipleRequests(ip, chunks[i]))
      await new Promise((resolve) => setTimeout(resolve, ip_span));
    }
    
    // Use Promise.all to wait for all promises to resolve or reject
    let results = await Promise.all(promises);
    return results.flat(); // Flatten the array of results
  }

  function delFailedIp(allips, failed_ips) {
    let sSet = new Set(allips); // 将数组 s 转换为 Set
    for (let i = 0; i < failed_ips.length; i++) {
      sSet.delete(failed_ips[i]); // 从 Set 中删除数组 d 中的元素
    }
    return Array.from(sSet); // 将 Set 转换回数组
  }
  function checkResult(results){
    let success = [];
    let failed = [];
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (!item?.data)continue;
      if(item?.data[suckey] === sucvalue) {
        success.push(item);
      } else {
        failed.push(item);
      }
    }
    return {success,failed}
  }
  // Start by making concurrent requests with all ips and all uniqueNames
  let results = await makeConcurrentRequests(iparr, uniqueName);
  //let success = results.filter((item) => item?.data[suckey] === sucvalue);
  //let failed = results.filter((item) => item?.data[suckey] !== sucvalue);
  const ckres=checkResult(results);
  let {success,failed}=ckres;
  
  let failedName = failed.map((item) =>  item.uniqueName);
  let failed_ips = failed.map((item) =>  item.ip);
  let okips = delFailedIp(iparr, failed_ips); // 将 Set 转换回数组

  let retries = 0;
  
  while (failedName.length > 0) {
    if (retries >= retrynum) {console.log("over! is do retry Num:" + retries);break;}
    retries++;
    console.log("do retry:" + retries);
    if (okips.length === 0) {
      console.log("all ip failed! retry num:" + retries);
      break;
    }
  
    let retry_results = await makeConcurrentRequests(okips, failedName);
    const ckres=checkResult(retry_results);
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
  const k=new Set(failed_ips);
  const failedips=Array.from(k)
  // Return an object with success and failed arrays
  return { success, failed, okips, failedips,failedName };
}
export { requestTargetUrl };
