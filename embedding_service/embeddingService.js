import { spawn } from "child_process";

// Spawn the Python embedding worker as a persistent child process
const pyProcess = spawn("python", ["./embedding_service/embedding_worker.py"]);

// Buffer to accumulate output and a queue to match responses with requests
let responseBuffer = "";
const callbacks = [];

// Listen for data from the Python process
pyProcess.stdout.on("data", (data) => {
    responseBuffer += data.toString();
    // Split by newlines; each line is a complete JSON response
    const lines = responseBuffer.split("\n");
    responseBuffer = lines.pop(); // Keep the last, possibly incomplete line in the buffer
    for (const line of lines) {
        if (line.trim()) {
            try {
                const response = JSON.parse(line);
                if (callbacks.length > 0) {
                    const cb = callbacks.shift();
                    cb(null, response);
                }
            } catch (error) {
                if (callbacks.length > 0) {
                    const cb = callbacks.shift();
                    cb(error, null);
                }
            }
        }
    }
});

// Function to send a text input to the Python process and receive embeddings
export function getEmbeddings(text) {
    return new Promise((resolve, reject) => {
        const request = JSON.stringify({ text }) + "\n";
        // Push a callback to handle the next response from the child process
        callbacks.push((err, response) => {
            if (err) {
                reject(err);
            } else {
                resolve(response);
            }
        });
        pyProcess.stdin.write(request, (err) => {
            if (err) {
                reject(err);
            }
        });
    });
}
