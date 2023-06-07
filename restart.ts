//import { ChildProcess } from 'https://deno.land/std/child_process.ts';

let proc: ChildProcess; // variable to store the child process

function startProcess(): void {
   proc = Deno.run({
  cmd: ["deno", "run", "--allow-net", "--allow-env", "--unstable", "index.ts"],
});
  console.log('Started xxx.ts process');
}

function stopProcess(): void {
  if (proc) {
    proc.close();
    console.log('Stopped xxx.ts process');
  }
}

// start process every minute on the 50th second
setInterval(() => {
    let second =new Date().getSeconds();
    //console.log(second);
    if(second!==59)return;
  if (proc) {
    stopProcess();
  }
  startProcess();
}, 1000);
