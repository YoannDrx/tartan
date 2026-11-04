// Monorepo pnpm : Metro surveille la racine pour résoudre packages/* et le magasin .pnpm.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [...new Set([...config.watchFolders, workspaceRoot])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Le serveur web et la base locale écrivent sans arrêt : inutile de les surveiller.
const ignored = [/apps\/web\/\.next\/.*/, /\.local\/.*/];
const existing = config.resolver.blockList;
config.resolver.blockList = existing ? [...[].concat(existing), ...ignored] : ignored;

module.exports = config;
