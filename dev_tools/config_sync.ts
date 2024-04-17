import { CONFIG } from '@config/common_config'
import fs from 'fs';


syncProxyConfig('./src/config/custom_proxy_config.json')

function syncProxyConfig(cfg_path: string): void {
    try {
        const proxyConfig = Object.values(CONFIG.apiPaths).reduce((acc: object, url: string) => ({
            ...acc,
            ...createProxyConfig(url)
        }), {});

        fs.writeFileSync(cfg_path, JSON.stringify(proxyConfig, null, 2));

        console.log(`Proxy configuration has been successfully written to \`${cfg_path}\`.`);
    } catch (error) {
        // Catch and log any errors that occur during the execution
        console.error("Error writing proxy configuration:", error);
    }
}

function createProxyConfig(url: string): object {
    return {
        [url]: {
            "target": "http://localhost:3000",
            "secure": false,
            "changeOrigin": true
        }
    };
}