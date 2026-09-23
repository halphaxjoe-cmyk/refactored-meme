import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import "node:process";

const root=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(root,"public");
const port=Number(process.env.PORT||3000);
const provider=process.env.AI_PROVIDER||"anthropic";
const apiKey=process.env.ANTHROPIC_API_KEY||process.env.OPENAI_API_KEY||"";
const model=process.env.AI_MODEL||"claude-3-5-haiku-latest";

const system=`Ou se JARVIS, asistan pèsonèl AI itilizatè a. Reponn nan lang itilizatè a mande a; si li pa presize, itilize Kreyòl ayisyen. Fè repons yo klè, natirèl, itil. Ou ka chwazi yon tool sèlman lè sa nesesè. Pou aksyon ki chanje aparèy oswa kominike ak lòt moun, retounen yon tool call epi frontend lan ap mande konfimasyon. Pa envante aksyon ou pa ka fè.`;

const tools=[
{name:"open_url",description:"Open a URL in the user's browser.",input_schema:{type:"object",properties:{url:{type:"string"}},required:["url"]}},
{name:"call_phone",description:"Open the phone dialer with a number.",input_schema:{type:"object",properties:{number:{type:"string"}},required:["number"]}},
{name:"send_sms",description:"Open SMS composer with recipient and message.",input_schema:{type:"object",properties:{number:{type:"string"},message:{type:"string"}},required:["number","message"]}},
{name:"send_whatsapp",description:"Open WhatsApp web with a message.",input_schema:{type:"object",properties:{number:{type:"string"},message:{type:"string"}},required:["number","message"]}},
{name:"open_email",description:"Open email composer.",input_schema:{type:"object",properties:{to:{type:"string"},subject:{type:"string"},body:{type:"string"}},required:["to"]}},
{name:"note",description:"Save a local note.",input_schema:{type:"object",properties:{text:{type:"string"}},required:["text"]}},
{name:"remember",description:"Save a non-sensitive user preference in local memory.",input_schema:{type:"object",properties:{text:{type:"string"}},required:["text"]}},
{name:"notify",description:"Show a browser notification.",input_schema:{type:"object",properties:{text:{type:"string"}},required:["text"]}}
];

function json(res,status,obj){const s=JSON.stringify(obj);res.writeHead(status,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"});res.end(s)}
async function body(req){let d="";for await(const c of req)d+=c;if(d.length>1e6)throw Error("body too large");return JSON.parse(d||"{}")}
async function chatAnthropic(p){
 const messages=(p.history||[]).map(x=>({role:x.role==="assistant"?"assistant":"user",content:String(x.content)}));
 messages.push({role:"user",content:String(p.message||"")});
 const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model,max_tokens:700,system,tools,messages})});
 if(!r.ok)throw Error("AI provider HTTP "+r.status+" "+await r.text());
 const j=await r.json();let text="",tool=null;
 for(const b of j.content||[]){if(b.type==="text")text+=b.text;if(b.type==="tool_use")tool={name:b.name,arguments:b.input}}
 return {text,tool};
}
async function chatOpenAI(p){
 const messages=[{role:"system",content:system},...(p.history||[]).map(x=>({role:x.role,content:String(x.content)})),{role:"user",content:String(p.message||"")}];
 const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+apiKey},body:JSON.stringify({model,temperature:.2,messages,tools:tools.map(t=>({type:"function",function:{name:t.name,description:t.description,parameters:t.input_schema}})),tool_choice:"auto"})});
 if(!r.ok)throw Error("AI provider HTTP "+r.status+" "+await r.text());
 const j=await r.json(),m=j.choices?.[0]?.message||{};let tool=null;if(m.tool_calls?.[0]){const c=m.tool_calls[0];tool={name:c.function.name,arguments:JSON.parse(c.function.arguments||"{}")}}return {text:m.content||"",tool};
}
function serve(req,res){
 let u=new URL(req.url,"http://localhost");let f=u.pathname==="/"?"index.html":u.pathname.slice(1);if(f.includes(".."))return json(res,400,{error:"bad path"});let p=path.join(publicDir,f);
 fs.readFile(p,(e,d)=>{if(e)return json(res,404,{error:"not found"});const ext=path.extname(p);const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".webmanifest":"application/manifest+json"};res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Cache-Control":"no-cache"});res.end(d)})
}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==="GET"&&req.url.startsWith("/api/health"))return json(res,200,{ok:true,provider,configured:!!apiKey});
  if(req.method==="POST"&&req.url.startsWith("/api/chat")){if(!apiKey)return json(res,503,{error:"AI key is not configured. Set an AI provider key in Railway variables."});const p=await body(req);return json(res,200,provider==="openai"?await chatOpenAI(p):await chatAnthropic(p))}
  if(req.method==="GET")return serve(req,res);return json(res,405,{error:"method not allowed"});
 }catch(e){return json(res,500,{error:e.message})}
});
server.listen(port,()=>console.log(`JARVIS listening on port ${port}`));