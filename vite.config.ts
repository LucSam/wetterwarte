import {defineConfig} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export default defineConfig({
 base:process.env.WETTER_BASE??'/',
 server:process.env.WETTER_BASE?{hmr:{clientPort:5174}}:{},
 build:{manifest:true},
 plugins:[{name:'version-offline-shell',async closeBundle(){
  const [manifest,html,worker]=await Promise.all([readFile('dist/.vite/manifest.json','utf8'),readFile('dist/index.html','utf8'),readFile('public/sw.js','utf8')]);
  const version=createHash('sha256').update(manifest+html+worker).digest('hex').slice(0,12);
  await writeFile('dist/sw.js',worker.replace('__WETTERWARTE_SHELL__',`wetterwarte-shell-${version}`));
 }}],
});
