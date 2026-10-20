import {build} from 'esbuild';
await build({entryPoints:['src/dashboard.js'],bundle:true,minify:true,format:'esm',outfile:'dist/dashboard.js',target:'es2022'});
