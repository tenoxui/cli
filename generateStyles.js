const fs = require("fs");
const glob = require("glob");
const cheerio = require("cheerio");
const chokidar = require("chokidar");

function generateStyles(config = {}) {
  // Load configuration
  try {
    config = require("./tenoxui.config");
  } catch (err) {
    console.log("Configuration file not found!");
  }

  const { inputStyles, inputFiles, outputStyles } = config;

  function extractClosestClassName(selector) {
    // Match the first class name in the selector
    const match = selector.match(/\.([^\s>+~]+)/);
    return match ? match[1] : null;
  }

  function scanHtml(htmlFilePaths, styles) {
    const usedStyles = {};

    htmlFilePaths.forEach((filePath) => {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const $ = cheerio.load(fileContent);

      const usedSelectors = new Set();
      $("[class]").each((index, element) => {
        const classes = $(element).attr("class").split(" ");
        classes.forEach((className) => usedSelectors.add(className));
      });

      Object.entries(styles).forEach(([selector, style]) => {
        const closestClassName = extractClosestClassName(selector);
        if (closestClassName && usedSelectors.has(closestClassName)) {
          usedStyles[selector] = style;
        }
      });
    });

    return usedStyles;
  }

  function getTimeStamp() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    return `\x1b[32m[\x1b[34m${hours}:${minutes}:${seconds}\x1b[32m]\x1b[0m`;
  }

  function generateOutput(changedFilePath = null) {
    let htmlFilePaths = [];
    if (changedFilePath) {
      htmlFilePaths = [changedFilePath];
    } else {
      htmlFilePaths = glob.sync(inputFiles);
    }

    const usedStyles = scanHtml(htmlFilePaths, inputStyles);

    // Create the output directory if it doesn't exist
    const outputDir = outputStyles.substring(0, outputStyles.lastIndexOf("/"));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      outputStyles,
      `const styles = ${JSON.stringify(usedStyles, null, 2)};\nmakeStyles(styles)`,
    );

    if (changedFilePath) {
      console.log(
        `${getTimeStamp()} File \x1b[33m${changedFilePath}\x1b[0m changed. Regenerating styles...`,
      );
    } else {
      console.log(
        `${getTimeStamp()} Styles extracted and saved to \x1b[33m${outputStyles}\x1b[0m`,
      );
    }
  }

  // Check if watch mode is enabled
  const watchMode =
    process.argv.includes("-w") || process.argv.includes("--watch");

  // Watch mode
  if (watchMode) {
    console.log(
      `${getTimeStamp()} -w flag detected.\x1b[0m Using watch mode...`,
    );
    const watcher = chokidar.watch(inputFiles);
    watcher.on("change", (changedFilePath) => {
      generateOutput(changedFilePath);
      console.log(
        `${getTimeStamp()} Style for \x1b[33m${changedFilePath}\x1b[0m generated successfully!`,
      );
    });
  } else {
    generateOutput();
    console.log(
      `${getTimeStamp()} \x1b[32mStyles generated successfully!\x1b[0m`,
    );
  }
}

module.exports = generateStyles;