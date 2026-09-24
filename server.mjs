import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(root,"public");
const port=Number(process.env.PORT||3000);
const provider=process.env.AI_PROVIDER||"gemini";
const apiKey=process.env.GEMINI_API_KEY||process.env.ANTHROPIC_API_KEY||process.env.OPENAI_API_KEY||"";
const model=process.env.AI_MODEL||"gemini-3.5-flash";

const system=`Ou se JARVIS, asistan pèsonèl AI itilizatè a. Reponn nan lang itilizatè a mande a; si li pa presize, itilize Kreyòl ayisyen. Fè repons yo klè, natirèl, kout lè kestyon an senp. Pa envante aksyon ou pa ka fè. Ou se yon asistan ki respekte vi prive epi ki pa ekspoze sekrè.`;

function json(res,status,obj){const s=JSON.stringify(obj);res.writeHead(status,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Cache-Control":"no-store"});res.end(s)}
async function body(req){let d="";for await(const c of req)d+=c;if(d.length>1e6)throw Error("body too large");return JSON.parse(d||"{}")}

async function chatGemini(p){
 const history=(p.history||[]).slice(-12).map(x=>({role:x.role==="assistant"?"model":"user",parts:[{text:String(x.content||"")}] }));
 const contents=[...history,{role:"user",parts:[{text:String(p.message||"")}]}];
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
  method:"POST",
  headers:{"content-type":"application/json","x-goog-api-key":apiKey},
  body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:.35,maxOutputTokens:900}})
 });
 if(!r.ok)throw Error("Gemini HTTP "+r.status+" "+await r.text());
 const j=await r.json();
 const text=(j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||"").join("").trim();
 return {text:text||"M pa jwenn repons lan kounye a.",tool:null};
}

async function chatAnthropic(p){
 const messages=(p.history||[]).map(x=>({role:x.role==="assistant"?"assistant":"user",content:String(x.content)}));
 messages.push({role:"user",content:String(p.message||"")});
 const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model,max_tokens:900,system,messages})});
 if(!r.ok)throw Error("AI provider HTTP "+r.status+" "+await r.text());
 const j=await r.json();return {text:(j.content||[]).map(b=>b.text||"").join(""),tool:null};
}

async function chatOpenAI(p){
 const messages=[{role:"system",content:system},...(p.history||[]).map(x=>({role:x.role,content:String(x.content)})),{role:"user",content:String(p.message||"")}];
 const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+apiKey},body:JSON.stringify({model,temperature:.2,messages})});
 if(!r.ok)throw Error("AI provider HTTP "+r.status+" "+await r.text());
 const j=await r.json();return {text:j.choices?.[0]?.message?.content||"",tool:null};
}

function serve(req,res){
 const u=new URL(req.url,"http://localhost");
 let f=u.pathname==="/"?"index.html":u.pathname.slice(1);
 if(f.includes(".."))return json(res,400,{error:"bad path"});
 const p=path.join(publicDir,f);
 fs.readFile(p,(e,d)=>{if(e)return json(res,404,{error:"not found"});const ext=path.extname(p);const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".webmanifest":"application/manifest+json"};res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Cache-Control":"no-cache"});res.end(d)})
}

const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==="GET"&&req.url.startsWith("/api/health"))return json(res,200,{ok:true,provider,model,configured:!!apiKey});
  if(req.method==="POST"&&req.url.startsWith("/api/chat")){
   if(!apiKey)return json(res,503,{error:"Gemini API key is not configured. Add GEMINI_API_KEY in Railway Variables."});
   const p=await body(req);
   const result=provider==="openai"?await chatOpenAI(p):provider==="anthropic"?await chatAnthropic(p):await chatGemini(p);
   return json(res,200,result);
  }
  if(req.method==="GET")return serve(req,res);
  return json(res,405,{error:"method not allowed"});
 }catch(e){console.error(e);return json(res,500,{error:e.message})}
});
server.listen(port,()=>console.log(`JARVIS listening on port ${port} | provider=${provider} | model=${model}`));