const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const snippets = {}; // In-memory store for shareable code (use DB in prod)

app.post("/run", (req, res) => {
  const { files, input, entryFile } = req.body;

  const folder = path.join(__dirname, `temp_${Date.now()}`);
  fs.mkdirSync(folder);

  // Write each file
  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(folder, filename), content);
  }

  const pythonProcess = spawn("python3", [path.join(folder, entryFile)]);

  // Set timeout: kill process after 5 seconds
  const timeout = setTimeout(() => {
    pythonProcess.kill("SIGKILL");
  }, 5000);

  if (input) {
    input.split(/\r?\n/).forEach(line => {
      pythonProcess.stdin.write(line + "\n");
    });
  }
  pythonProcess.stdin.end();

  let stdout = "", stderr = "";

  pythonProcess.stdout.on("data", data => stdout += data.toString());
  pythonProcess.stderr.on("data", data => stderr += data.toString());

  pythonProcess.on("close", (code) => {
    clearTimeout(timeout);
    fs.rmSync(folder, { recursive: true, force: true });
    res.send({ stdout, stderr, exitCode: code });
  });
});

// Shareable code
app.post("/share", (req, res) => {
  const id = uuidv4();
  snippets[id] = req.body;
  res.send({ id });
});

app.get("/share/:id", (req, res) => {
  const snippet = snippets[req.params.id];
  if (snippet) res.send(snippet);
  else res.status(404).send({ error: "Snippet not found" });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
