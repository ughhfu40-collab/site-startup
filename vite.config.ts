import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{allowedHosts:['terminal.local'],fs:{allow:['/workspace/sites/studyhour-node','/workspace/sites/studyhour']}},build:{outDir:'dist'}});
