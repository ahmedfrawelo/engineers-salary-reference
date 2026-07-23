const fs = require("fs");
const path = require("path");
const root = path.join("src","app","pages","in-hand");
function collect(dir){
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })){
    if (entry.isDirectory()) out.push(...collect(path.join(dir, entry.name)));
    else if (entry.isFile() && entry.name.endsWith(".component.ts")) out.push(path.join(dir, entry.name));
  }
  return out;
}
function toTemplateLiteral(str){
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
const files = collect(root);
for (const tsPath of files){
  const dir = path.dirname(tsPath);
  const base = path.basename(tsPath, ".component.ts");
  const htmlPath = path.join(dir, base + ".component.html");
  if (!fs.existsSync(htmlPath)) continue;
  const cssPath = path.join(dir, base + ".component.css");
  const htmlRaw = fs.readFileSync(htmlPath, "utf8").trim();
  const cssRaw = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8").trim() : "";
  let ts = fs.readFileSync(tsPath, "utf8");
  const htmlLiteral = toTemplateLiteral(htmlRaw);
  const cssLiteral = toTemplateLiteral(cssRaw);
  const templateBlock = "  template: `\n" + htmlLiteral.split("\n").map(line => "    " + line).join("\n") + "\n  `,";
  const stylesBlock = cssRaw
    ? "  styles: [\n    `" + cssLiteral.split("\n").join("\n    ") + "`\n  ],"
    : "  styles: [],";
  if (/templateUrl\s*:/.test(ts)){
    ts = ts.replace(/templateUrl\s*:\s*['\"].*?['\"],?/, templateBlock);
  } else {
    console.warn("No templateUrl in", tsPath);
    continue;
  }
  if (/styleUrls\s*:/.test(ts)){
    ts = ts.replace(/styleUrls\s*:\s*\[[^\]]*\],?/, stylesBlock);
  } else {
    ts = ts.replace(/(@Component\s*\(\{)/, "$1\n" + stylesBlock + "\n");
  }
  fs.writeFileSync(tsPath, ts);
  fs.unlinkSync(htmlPath);
  if (fs.existsSync(cssPath)) fs.unlinkSync(cssPath);
  console.log("Inlined", tsPath);
}
