const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const snippets = {}; // In-memory store for snippets (replace with DB in production)

const server = app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  let pythonProcess = null;
  let folder = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "start") {
        const { files, entryFile } = data;

        folder = path.join(__dirname, `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
        fs.mkdirSync(folder);

        for (const [filename, content] of Object.entries(files)) {
          fs.writeFileSync(path.join(folder, filename), content);
        }

        // Important: '-u' for unbuffered output
        pythonProcess = spawn("python3", ["-u", path.join(folder, entryFile)]);

        pythonProcess.stdout.on("data", (data) => {
          ws.send(JSON.stringify({ type: "stdout", data: data.toString() }));
        });

        pythonProcess.stderr.on("data", (data) => {
          ws.send(JSON.stringify({ type: "stderr", data: data.toString() }));
        });

        pythonProcess.on("close", (code) => {
          if (folder) {
            fs.rmSync(folder, { recursive: true, force: true });
            folder = null;
          }
          ws.send(JSON.stringify({ type: "exit", code }));
          pythonProcess = null;
        });
      } else if (data.type === "stdin") {
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.stdin.write(data.data);
        }
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "stderr", data: `[Server error]: ${err.message}\n` }));
    }
  });

  ws.on("close", () => {
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill();
    }
    if (folder) {
      fs.rmSync(folder, { recursive: true, force: true });
      folder = null;
    }
  });
});

// Share code snippet endpoints
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
