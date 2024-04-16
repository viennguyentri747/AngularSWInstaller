import { CONFIG } from '@config/common_config'
import fs from 'fs';

const proxyConfig = Object.values(CONFIG.apiPaths).reduce((acc, url) => ({
    ...acc,
    ...createProxyConfig(url)
}), {})

fs.writeFileSync('./src/config/custom_proxy_config.json', JSON.stringify(proxyConfig, null, 2));

function createProxyConfig(url: any) {
    return {
        [url]: {
            "target": "http://localhost:3000",
            "secure": false,
            "changeOrigin": true
        }
    };
}