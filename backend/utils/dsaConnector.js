const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Spawns the C++ DSA Engine executable, writes JSON payload to stdin,
 * and parses the stdout response.
 * 
 * @param {Object} payload Input JSON object
 * @returns {Promise<Object>} Output JSON object from C++ engine
 */
function runDsaEngine(payload) {
  return new Promise((resolve) => {
    // Locate the engine executable relative to this file
    const isWin = process.platform === 'win32';
    let enginePath = path.join(__dirname, '..', '..', 'dsa-engine', isWin ? 'engine.exe' : 'engine');
    
    if (!fs.existsSync(enginePath)) {
      const altPath = path.join(__dirname, '..', '..', 'dsa-engine', isWin ? 'engine' : 'engine.exe');
      if (fs.existsSync(altPath)) {
        enginePath = altPath;
      }
    }
    
    let child;
    try {
      child = spawn(enginePath, []);
    } catch (spawnErr) {
      return resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
    }
    
    let stdoutData = '';
    let stderrData = '';
    let resolved = false;

    // 5000ms timeout logic to prevent process hanging
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          child.kill();
        } catch (e) {}
        resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
      }
    }, 5000);
    
    // Prevent unhandled process crashes from bubble throwing
    child.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
      }
    });

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (resolved) return;
      resolved = true;

      if (code !== 0) {
        return resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
      }

      try {
        const trimmed = stdoutData.trim();
        if (!trimmed) {
          return resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
        }
        const result = JSON.parse(trimmed);
        resolve({ status: 'success', ...result });
      } catch (err) {
        resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
      }
    });
    
    try {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    } catch (writeErr) {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ status: 'error', message: 'Recommendation engine temporarily unavailable' });
      }
    }
  });
}

module.exports = { runDsaEngine };
