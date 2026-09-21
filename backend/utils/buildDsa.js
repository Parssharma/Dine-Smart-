const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const engineDir = path.join(__dirname, '..', '..', 'dsa-engine');
const isWin = process.platform === 'win32';
const targetExe = path.join(engineDir, isWin ? 'engine.exe' : 'engine');
const srcPath = path.join(engineDir, 'src', 'main.cpp');

function build() {
  console.log('Building C++ DSA Engine...');
  try {
    const cmd = `g++ -std=c++17 "${srcPath}" -o "${targetExe}"`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`Successfully compiled C++ DSA Engine at: ${targetExe}`);
  } catch (err) {
    console.error('Failed to compile C++ DSA Engine using g++:', err.message);
    if (!fs.existsSync(targetExe)) {
      console.warn('Warning: C++ DSA engine executable not found and compilation failed.');
    } else {
      console.log('Pre-compiled engine binary exists, proceeding.');
    }
  }
}

if (require.main === module) {
  build();
}

module.exports = { build };
