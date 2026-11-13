const fs = require("fs");
const path = require("path");

const targets = [
  path.join(__dirname, "../node_modules/zod/index.js"),
  path.join(__dirname, "../node_modules/zod/index.cjs"),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    let content = fs.readFileSync(target, "utf8");
    if (!content.includes("prefault")) {
      content += "\nz.ZodType.prototype.prefault = function(d){return this.default(d);};\n";
      fs.writeFileSync(target, content);
      console.log(`[patch-zod] Applied prefault polyfill to ${target}`);
    }
  }
}
