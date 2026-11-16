// Servidor local simples (com gzip): node servir.js <pasta> <porta>
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const [,, pasta, porta]=process.argv;
const raiz=path.resolve(pasta);
const tipos={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p.endsWith('/'))p+='index.html';
  const f=path.resolve(path.join(raiz,p));
  if(!f.startsWith(raiz)){r.writeHead(403);return r.end();}
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end('nao encontrado');}
    const h={'Content-Type':tipos[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'};
    if(/gzip/.test(q.headers['accept-encoding']||'') && d.length>2000){ h['Content-Encoding']='gzip'; d=zlib.gzipSync(d); }
    r.writeHead(200,h); r.end(d);});
}).listen(+porta,'127.0.0.1');
