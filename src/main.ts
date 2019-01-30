import * as yaml from "js-yaml";
import * as fs from "fs";
import * as http from "http";
import * as url from "url";

namespace UTIL {
  // 覆盖 让source中的属性覆盖target中的属性
  export function overlap(target: any, source: any) {
    for (let key in source) {
      if (key in target) {
        target[key] = source[key];
      }
    }
  }
}

namespace PROXY_CONFIG {
  export const ENCODING = "utf-8";
  export const PORT = 9000;
  export const CONFIG_PATH = "./config/common.yaml";

  export function readConfig() {
    return yaml.safeLoad(
      fs.readFileSync(PROXY_CONFIG.CONFIG_PATH, {
        encoding: PROXY_CONFIG.ENCODING
      })
    );
  }
}

let config = PROXY_CONFIG.readConfig();
// 配置文件修改时立即更新
fs.watchFile(
  PROXY_CONFIG.CONFIG_PATH,
  { persistent: true, interval: 500 },
  () => {
    config = PROXY_CONFIG.readConfig();
  }
);

const server = http.createServer((req, res) => {
  req.setEncoding(PROXY_CONFIG.ENCODING);
  var { hostname, port, path } = url.parse(req.url || "");
  let { method, headers } = req;

  let options = {
    protocol: "http:",
    hostname,
    port: port || 80,
    path: path || "",
    method,
    headers
  };

  var { hostname, port, path } = url.parse(req.headers["referer"] || "");
  let refererParsedUrl = {
    hostname,
    port: port || 80,
    path: path || ""
  };

  // 检查 config
  for (let configUrl in config) {
    let { hostname, port, path } = url.parse(configUrl);
    const configParsedUrl = {
      hostname,
      port: port || 80,
      path: path || ""
    };

    let matchReferer: Boolean =
      configParsedUrl.hostname == refererParsedUrl.hostname &&
      configParsedUrl.port == refererParsedUrl.port &&
      refererParsedUrl.path.indexOf(configParsedUrl.path) == 0;
    let matchUrl: Boolean =
      configParsedUrl.hostname == options.hostname &&
      configParsedUrl.port == options.port &&
      options.path.indexOf(configParsedUrl.path) == 0;
    if (
      options.hostname === configParsedUrl.hostname &&
      (matchReferer || matchUrl)
    ) {
      UTIL.overlap(options, config[configUrl]);
      break;
    }
  }
  const proxyClient = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyClient.on("error", e => {
    res.end(JSON.stringify({ switchman: e }));
  });
  req.pipe(proxyClient);
});

server.on("connect", (req, socket, header) => {});

server.on("listening", () => {
  console.log("switchman started on", PROXY_CONFIG.PORT);
});

server.listen(PROXY_CONFIG.PORT);
