import { defineConfig } from 'vite';
import { localApiPlugin } from './server/api.mjs';
export default defineConfig({
 plugins:[localApiPlugin()],
 server:{host:'127.0.0.1',fs:{deny:['**/.local/**','**/.git/**','**/.env','**/.env.*','**/*.{crt,pem}']}},
 preview:{host:'127.0.0.1'}
});
