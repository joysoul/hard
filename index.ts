import { Hono } from "https://deno.land/x/hono/mod.ts";
import { serve } from "https://deno.land/std/http/server.ts";
import { requestTargetUrl } from "./prog.ts";

const app = new Hono({ strict: false });

app.notFound((c) => {
  return c.text("Is 404 Message:Not Found", 404);
});

app.onError((err, c) => {
  console.error(`${err}`);
  return c.text("Custom Error Message", 500);
});

//http://123.60.143.98:7890
app.get("/t/:pip", async (c) => {
  const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299",
  };
  let init = {headers};

  const ip=c.req.param('pip');
  const client = Deno.createHttpClient({
    proxy: { url: 'http://'+ip },
  });
  //const response = await fetch("https://myserver.com", );
  init["client"] = client;
  //let ssx = "https://api-ipv4.ip.sb/ip ";
  //let ssx='https://ifconfig.me/all.json';
  //let ssx = "https://www.cloudflare.com/cdn-cgi/trace";
  let ssx = "https://ifconfig.me/all";
  let ss = await fetch(ssx);
  // let s = await ss.json();
  let xx = await ss.text();
  console.log("real:");
  console.log(xx);
  let dd = await fetch(ssx, init);
  let redd=await dd.text();
  let resp=xx+'<h2>---------------下面是原始的------------</h2>'+redd;
  return new Response(resp);
});

app.post("/get", async (c) => {
  const before = Deno.memoryUsage();
  
  let parmobj = await c.req.json()

  let s = Date.now();
  console.log('is here start:' + s);
  let results = await requestTargetUrl(parmobj);
  let e = Date.now();
  console.log("Run Time:" + (e - s));
  results['time']=e - s;
  parmobj=null;
  const after = Deno.memoryUsage();
  //console.log('Memory usage before:', before);
  //console.log('Memory usage after:', after);
  
  const usedHeapSizeDiff = after.heapUsed - before.heapUsed;
  console.log('Used heap size difference:', usedHeapSizeDiff);
  // 打印有效结果和失败的id数组
  //console.log(results);
  //console.log('run Time:' + e-s);
  //await Deno.core.opSync("gc");
  //manualGC();
  return c.json(results);
});

serve(app.fetch);


